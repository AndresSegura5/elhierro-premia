import test from "node:test";
import assert from "node:assert/strict";
import { addDays, couponStatus, parseEuros, todayInCanary, VALIDITY_CLOSES_LABEL, VALIDITY_OPENS_LABEL, VALIDITY_WINDOW_TEXT } from "../lib/bonos.ts";

// Canarias: WEST (UTC+1) en verano, WET (UTC+0) en invierno.
const at = (iso) => new Date(iso);
const status = (start, days, used, iso) => couponStatus(start, days, 3000, used, at(iso));

test("la vigencia termina al final del día configurado", () => {
  assert.equal(addDays("2026-10-03", 7), "2026-10-10");
  assert.equal(status("2026-10-03", 7, 0, "2026-10-02T12:00:00+01:00"), "not-started");
  assert.equal(status("2026-10-03", 7, 0, "2026-10-10T12:00:00+01:00"), "available");
  assert.equal(status("2026-10-03", 7, 0, "2026-10-11T12:00:00+01:00"), "expired");
});

test("un bono admite varios gastos hasta agotar el saldo", () => {
  assert.equal(couponStatus("2026-10-03", 7, 3000, 1250, at("2026-10-05T12:00:00+01:00")), "partial");
  assert.equal(couponStatus("2026-10-03", 7, 3000, 3000, at("2026-10-05T12:00:00+01:00")), "redeemed");
  assert.equal(couponStatus("2026-10-03", 7, 3000, 1250, at("2026-10-11T12:00:00+01:00")), "expired");
});

test("la vigencia empieza a las 00:01 del primer día (horario de verano)", () => {
  assert.equal(status("2026-07-01", 7, 0, "2026-06-30T23:59:59+01:00"), "not-started");
  assert.equal(status("2026-07-01", 7, 0, "2026-07-01T00:00:00+01:00"), "not-started");
  assert.equal(status("2026-07-01", 7, 0, "2026-07-01T00:00:59+01:00"), "not-started");
  assert.equal(status("2026-07-01", 7, 0, "2026-07-01T00:01:00+01:00"), "available");
});

test("la vigencia termina a las 23:59 del último día (horario de verano)", () => {
  assert.equal(status("2026-07-01", 7, 0, "2026-07-08T23:58:00+01:00"), "available");
  assert.equal(status("2026-07-01", 7, 0, "2026-07-08T23:59:00+01:00"), "available");
  assert.equal(status("2026-07-01", 7, 0, "2026-07-08T23:59:59+01:00"), "available");
  assert.equal(status("2026-07-01", 7, 0, "2026-07-09T00:00:00+01:00"), "expired");
});

test("los mismos límites se cumplen en horario de invierno", () => {
  assert.equal(status("2026-12-01", 7, 0, "2026-12-01T00:00:30+00:00"), "not-started");
  assert.equal(status("2026-12-01", 7, 0, "2026-12-01T00:01:00+00:00"), "available");
  assert.equal(status("2026-12-01", 7, 0, "2026-12-08T23:59:59+00:00"), "available");
  assert.equal(status("2026-12-01", 7, 0, "2026-12-09T00:00:00+00:00"), "expired");
});

test("los límites no dependen del huso del servidor (UTC distinto del día de Canarias)", () => {
  // 23:30 UTC del 30 de junio ya es 00:30 del 1 de julio en Canarias (UTC+1).
  assert.equal(status("2026-07-01", 7, 0, "2026-06-30T23:30:00Z"), "available");
  assert.equal(status("2026-07-01", 7, 0, "2026-06-30T22:59:59Z"), "not-started");
  // 22:59:59 UTC del 8 de julio es 23:59:59 en Canarias; un segundo después ya es el 9.
  assert.equal(status("2026-07-01", 7, 0, "2026-07-08T22:59:59Z"), "available");
  assert.equal(status("2026-07-01", 7, 0, "2026-07-08T23:00:00Z"), "expired");
});

test("el cambio de hora de octubre no desplaza los límites", () => {
  // El 25-oct-2026 Canarias pasa de UTC+1 a UTC+0 a las 02:00; 00:01 sigue siendo UTC+1.
  assert.equal(status("2026-10-25", 3, 0, "2026-10-25T00:00:30+01:00"), "not-started");
  assert.equal(status("2026-10-25", 3, 0, "2026-10-25T00:01:00+01:00"), "available");
  assert.equal(status("2026-10-25", 3, 0, "2026-10-28T23:59:59+00:00"), "available");
  assert.equal(status("2026-10-25", 3, 0, "2026-10-29T00:00:00+00:00"), "expired");
});

test("un bono totalmente gastado figura como canjeado aunque esté fuera de vigencia", () => {
  assert.equal(status("2026-07-01", 7, 3000, "2026-07-20T12:00:00+01:00"), "redeemed");
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

test("el texto de vigencia que ve el público coincide con los límites reales", () => {
  assert.equal(VALIDITY_OPENS_LABEL, "00:01");
  assert.equal(VALIDITY_CLOSES_LABEL, "23:59");
  assert.match(VALIDITY_WINDOW_TEXT, /00:01.*23:59/);
  assert.equal(status("2026-07-01", 7, 0, "2026-07-01T" + VALIDITY_OPENS_LABEL + ":00+01:00"), "available");
  assert.equal(status("2026-07-01", 7, 0, "2026-07-08T" + VALIDITY_CLOSES_LABEL + ":00+01:00"), "available");
});
