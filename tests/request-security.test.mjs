import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { trustedClientAddress, isSameOriginMutation, validIdempotencyKey } from "../lib/request-security.ts";
import { generateCouponCode } from "../lib/coupon-token.ts";
import { isValidCouponCode } from "../lib/coupon-code.ts";

const moduleUrl = text => `data:text/javascript;base64,${Buffer.from(text).toString("base64")}`;
const compile = file => ts.transpileModule(readFileSync(new URL(`../lib/${file}.ts`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace('import "server-only";', "");
const security = moduleUrl(compile("request-security"));
const postgres = moduleUrl("export function hasPostgresDatabase(){return false} export function getPostgres(){throw Error('No remote DB in tests')}");
const limits = await import(moduleUrl(compile("request-limit").replace('from "./request-security"', `from "${security}"`).replace('from "./postgres"', `from "${postgres}"`)));

test("client-supplied IP headers cannot bypass the Vercel bucket", () => {
  const headers = new Headers({ "x-forwarded-for": "203.0.113.1", "x-real-ip": "203.0.113.2", "cf-connecting-ip": "203.0.113.3" });
  assert.equal(trustedClientAddress(headers, true), "203.0.113.1");
  assert.equal(trustedClientAddress(headers, false), "local");
  assert.equal(trustedClientAddress(new Headers({ "cf-connecting-ip": "203.0.113.3" }), true), "unknown");
  assert.equal(trustedClientAddress(new Headers({ "x-forwarded-for": "2001:db8:1:2::1" }), true), trustedClientAddress(new Headers({ "x-forwarded-for": "2001:db8:1:2::ffff" }), true));
  assert.equal(trustedClientAddress(new Headers({ "x-forwarded-for": "::ffff:203.0.113.1" }), true), "203.0.113.1");
});

test("mutations reject cross-origin and missing-origin requests", () => {
  assert.equal(isSameOriginMutation(new Request("https://example.test/api/bonos/code", { headers: { origin: "https://example.test" } })), true);
  for (const headers of [{}, { origin: "https://attacker.test" }, { origin: "https://example.test", "sec-fetch-site": "cross-site" }]) {
    assert.equal(isSameOriginMutation(new Request("https://example.test/api/bonos/code", { headers })), false);
  }
});

test("the eleventh lookup is denied and the counter never reopens before expiry", async () => {
  for (let attempt = 1; attempt <= 30; attempt++) {
    const result = await limits.consumeRequestLimit("coupon-public", "unit-test-client", 10, 900, 1000000);
    assert.equal(result.allowed, attempt <= 10);
    if (attempt > 10) assert.equal(result.retryAfterSeconds, 900);
  }
  assert.equal((await limits.consumeRequestLimit("coupon-public", "unit-test-client", 10, 900, 1900000)).allowed, true);
});

test("concurrent limits admit only the permitted number of calls", async () => {
  const results = await Promise.all(Array.from({ length: 50 }, () => limits.consumeRequestLimit("login-account", "concurrent-account", 10, 900, 2000000)));
  assert.equal(results.filter(result => result.allowed).length, 10);
});

test("new codes have twelve random characters and old printed codes remain valid", () => {
  const codes = new Set(Array.from({ length: 1000 }, () => generateCouponCode("BES")));
  assert.equal(codes.size, 1000);
  assert.ok([...codes].every(code => code.length === 19 && isValidCouponCode(code)));
  assert.equal(isValidCouponCode("EH-BES-A1B234C"), true);
  assert.equal(isValidCouponCode("EH-BES-123"), false);
  assert.equal(isValidCouponCode("EH-OTHER-A1B234C"), false);
});

test("a purchase requires a bounded UUID operation key", () => {
  assert.equal(validIdempotencyKey("28e1f1df-055f-4f62-9f72-5a13a239614c"), true);
  assert.equal(validIdempotencyKey(null), false);
  assert.equal(validIdempotencyKey("arbitrary-value"), false);
});
