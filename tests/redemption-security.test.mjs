import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import ts from "typescript";

// Run the actual SQLite redemption transaction in an isolated in-memory database.
const moduleUrl = text => `data:text/javascript;base64,${Buffer.from(text).toString("base64")}`;
const compile = file => ts.transpileModule(readFileSync(new URL(`../lib/${file}.ts`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const dependencies = Object.fromEntries(["bonos", "data", "coupon-token", "coupon-assignment"].map(file => [`./${file}`, moduleUrl(compile(file))]));
process.env.NODE_ENV = "test";
const store = await import(moduleUrl(compile("store-sqlite").replace(/from "([^"]+)"/g, (original, name) => dependencies[name] ? `from "${dependencies[name]}"` : original)));

test("redemptions enforce ownership, validity, balance and duplicate-operation safety", () => {
  const db = store.getDatabase();
  db.exec("DELETE FROM redemptions; DELETE FROM coupons; UPDATE races SET start_date='2026-10-01', validity_days=7 WHERE id='bestial';");
  const business = db.prepare("SELECT id FROM businesses LIMIT 1").get().id;
  db.prepare("INSERT INTO coupons(code,race_id,business_id,amount_cents) VALUES(?,?,?,3000)").run("EH-BES-A1B234C", "bestial", business);
  const now = new Date("2026-10-02T12:00:00Z");
  const key = randomUUID();
  assert.throws(() => store.redeemCoupon("EH-BES-A1B234C", "other-shop", 100, now, randomUUID()), /otro comercio/);
  assert.throws(() => store.redeemCoupon("EH-BES-A1B234C", business, 0, now, randomUUID()), /mayor que cero/);
  assert.throws(() => store.redeemCoupon("EH-BES-A1B234C", business, 3001, now, randomUUID()), /supera el saldo/);
  assert.throws(() => store.redeemCoupon("EH-BES-A1B234C", business, 100, new Date("2026-09-30T12:00:00Z"), randomUUID()), /no está vigente/);
  assert.throws(() => store.redeemCoupon("EH-BES-A1B234C", business, 100, new Date("2026-10-09T12:00:00Z"), randomUUID()), /caducado/);
  store.redeemCoupon("EH-BES-A1B234C", business, 1250, now, key);
  store.redeemCoupon("EH-BES-A1B234C", business, 1250, now, key);
  assert.equal(db.prepare("SELECT used_cents FROM coupons").get().used_cents, 1250);
  assert.equal(db.prepare("SELECT count(*) AS total FROM redemptions").get().total, 1);
  assert.throws(() => store.redeemCoupon("EH-BES-A1B234C", business, 1000, now, key), /otros datos/);
  db.prepare("UPDATE businesses SET active=0 WHERE id=?").run(business);
  assert.throws(() => store.redeemCoupon("EH-BES-A1B234C", business, 100, now, randomUUID()), /no está activo/);
  db.prepare("UPDATE businesses SET active=1 WHERE id=?").run(business);
  store.redeemCoupon("EH-BES-A1B234C", business, 1750, now, randomUUID());
  assert.throws(() => store.redeemCoupon("EH-BES-A1B234C", business, 1, now, randomUUID()), /no tiene saldo/);
  assert.equal(db.prepare("SELECT used_cents FROM coupons").get().used_cents, 3000);
});
