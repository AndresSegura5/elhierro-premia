import test from "node:test";
import assert from "node:assert/strict";
import { addDays, couponStatus, parseEuros, todayInCanary } from "../lib/bonos.ts";

test("la vigencia termina al final del día configurado", () => {
  assert.equal(addDays("2026-10-03", 7), "2026-10-10");
  assert.equal(couponStatus("2026-10-03", 7, 3000, 0, "2026-10-02"), "not-started");
  assert.equal(couponStatus("2026-10-03", 7, 3000, 0, "2026-10-10"), "available");
  assert.equal(couponStatus("2026-10-03", 7, 3000, 0, "2026-10-11"), "expired");
});

test("un bono admite varios gastos hasta agotar el saldo", () => {
  assert.equal(couponStatus("2026-10-03", 7, 3000, 1250, "2026-10-05"), "partial");
  assert.equal(couponStatus("2026-10-03", 7, 3000, 3000, "2026-10-05"), "redeemed");
  assert.equal(couponStatus("2026-10-03", 7, 3000, 1250, "2026-10-11"), "expired");
});

test("los importes se convierten a céntimos sin redondeos flotantes", () => {
  assert.equal(parseEuros("12,50"), 1250);
  assert.equal(parseEuros("0.01"), 1);
  assert.equal(parseEuros("0"), null);
  assert.equal(parseEuros("12.345"), null);
  assert.equal(parseEuros("abc"), null);
});

test("la fecha actual usa el huso de Canarias", () => {
  assert.equal(todayInCanary(new Date("2026-07-01T00:30:00Z")), "2026-07-01");
  assert.equal(todayInCanary(new Date("2026-01-01T00:30:00Z")), "2026-01-01");
});
