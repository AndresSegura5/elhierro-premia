import test from "node:test";
import assert from "node:assert/strict";
import { canSeeLiveScope, liveScope, needsSession, parseLiveScope } from "../lib/live-scopes.ts";
import { nextValidityChange, validityInstants } from "../lib/bonos.ts";

const admin = { role: "admin" };
const shop = (businessId) => ({ role: "merchant", businessId });

test("los ámbitos válidos se interpretan y los inválidos se rechazan", () => {
  assert.deepEqual(parseLiveScope("admin"), { kind: "admin" });
  assert.deepEqual(parseLiveScope("public"), { kind: "public" });
  assert.deepEqual(parseLiveScope("merchants"), { kind: "merchants" });
  assert.deepEqual(parseLiveScope("business:los-mocanes"), { kind: "business", id: "los-mocanes" });
  assert.deepEqual(parseLiveScope("race:bestial"), { kind: "race", id: "bestial" });
  assert.deepEqual(parseLiveScope("coupon:EH-BES-ABCDEFGHJKMN"), { kind: "coupon", code: "EH-BES-ABCDEFGHJKMN" });
  for (const bad of ["", "x", "admin:1", "business:", "business:UPPER", "business:a b", "business:a--b", "business:../etc", "coupon:eh-bes-abcdefghjkmn", "coupon:EH-XXX-ABCDEFGHJKMN", "race:", "race:a'b", "BUSINESS:x", "business:" + "a".repeat(81)]) {
    assert.equal(parseLiveScope(bad), null, bad);
  }
});

test("el generador de ámbitos produce valores que se pueden interpretar", () => {
  assert.deepEqual(parseLiveScope(liveScope.business("los-mocanes")), { kind: "business", id: "los-mocanes" });
  assert.deepEqual(parseLiveScope(liveScope.coupon(" eh-bes-abcdefghjkmn ")), { kind: "coupon", code: "EH-BES-ABCDEFGHJKMN" });
  assert.deepEqual(parseLiveScope(liveScope.race("bimbache")), { kind: "race", id: "bimbache" });
});

test("cada persona solo puede ver los ámbitos que le corresponden", () => {
  const scopes = {
    admin: parseLiveScope("admin"),
    merchants: parseLiveScope("merchants"),
    own: parseLiveScope("business:los-mocanes"),
    other: parseLiveScope("business:sabores-pinar"),
    pub: parseLiveScope("public"),
    race: parseLiveScope("race:bestial"),
    coupon: parseLiveScope("coupon:EH-BES-ABCDEFGHJKMN"),
  };
  // Visitante: solo lo público.
  assert.deepEqual(Object.entries(scopes).filter(([, scope]) => canSeeLiveScope(scope, null)).map(([name]) => name), ["pub", "race", "coupon"]);
  // Comercio: lo público, el aviso general a comercios y solo su propio ámbito.
  assert.deepEqual(Object.entries(scopes).filter(([, scope]) => canSeeLiveScope(scope, shop("los-mocanes"))).map(([name]) => name), ["merchants", "own", "pub", "race", "coupon"]);
  // Administrador: todo.
  assert.equal(Object.values(scopes).every((scope) => canSeeLiveScope(scope, admin)), true);
});

test("solo los ámbitos privados exigen sesión", () => {
  assert.equal(needsSession(parseLiveScope("admin")), true);
  assert.equal(needsSession(parseLiveScope("merchants")), true);
  assert.equal(needsSession(parseLiveScope("business:x")), true);
  assert.equal(needsSession(parseLiveScope("public")), false);
  assert.equal(needsSession(parseLiveScope("race:bestial")), false);
  assert.equal(needsSession(parseLiveScope("coupon:EH-BES-ABCDEFGHJKMN")), false);
});

test("los instantes de cambio de estado respetan 00:01 y el final del último día (verano)", () => {
  const { opensAt, closesAt } = validityInstants("2026-07-01", 7);
  assert.equal(opensAt.toISOString(), "2026-06-30T23:01:00.000Z"); // 00:01 en Canarias (UTC+1)
  assert.equal(closesAt.toISOString(), "2026-07-08T23:00:00.000Z"); // 00:00 del 9 de julio en Canarias
});

test("los instantes de cambio de estado respetan el horario de invierno", () => {
  const { opensAt, closesAt } = validityInstants("2026-12-01", 7);
  assert.equal(opensAt.toISOString(), "2026-12-01T00:01:00.000Z");
  assert.equal(closesAt.toISOString(), "2026-12-09T00:00:00.000Z");
});

test("los instantes son correctos el día del cambio de hora", () => {
  // 25-oct-2026: Canarias pasa de UTC+1 a UTC+0 a las 02:00. 00:01 sigue en UTC+1.
  assert.equal(validityInstants("2026-10-25", 3).opensAt.toISOString(), "2026-10-24T23:01:00.000Z");
  // El último día cae ya en invierno: 29-oct 00:00 es UTC+0.
  assert.equal(validityInstants("2026-10-25", 3).closesAt.toISOString(), "2026-10-29T00:00:00.000Z");
  // Cambio a verano (28-mar-2027, 01:00 pasa a 02:00): 00:01 es todavía UTC+0.
  assert.equal(validityInstants("2027-03-28", 1).opensAt.toISOString(), "2027-03-28T00:01:00.000Z");
  assert.equal(validityInstants("2027-03-28", 1).closesAt.toISOString(), "2027-03-29T23:00:00.000Z");
});

test("el siguiente cambio de estado se calcula respecto al instante actual", () => {
  const before = new Date("2026-06-30T20:00:00Z");
  assert.equal(nextValidityChange("2026-07-01", 7, before).toISOString(), "2026-06-30T23:01:00.000Z");
  const during = new Date("2026-07-03T12:00:00Z");
  assert.equal(nextValidityChange("2026-07-01", 7, during).toISOString(), "2026-07-08T23:00:00.000Z");
  const after = new Date("2026-07-09T00:00:00Z");
  assert.equal(nextValidityChange("2026-07-01", 7, after), null);
});

test("el cambio de estado calculado coincide con el estado real del bono", async () => {
  const { couponStatus } = await import("../lib/bonos.ts");
  for (const [start, days] of [["2026-07-01", 7], ["2026-12-01", 3], ["2026-10-25", 3], ["2027-03-28", 1]]) {
    const { opensAt, closesAt } = validityInstants(start, days);
    const second = 1000;
    assert.equal(couponStatus(start, days, 3000, 0, new Date(opensAt.getTime() - second)), "not-started", `${start} justo antes de abrir`);
    assert.equal(couponStatus(start, days, 3000, 0, opensAt), "available", `${start} al abrir`);
    assert.equal(couponStatus(start, days, 3000, 0, new Date(closesAt.getTime() - second)), "available", `${start} justo antes de cerrar`);
    assert.equal(couponStatus(start, days, 3000, 0, closesAt), "expired", `${start} al cerrar`);
  }
});
