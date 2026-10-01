import "server-only";

import { randomInt } from "node:crypto";
import * as sqliteStore from "./store-sqlite";
import { hasPostgresDatabase, getPostgres } from "./postgres";
import { addDays, BONO_CENTS, couponStatus, todayInCanary } from "./bonos";
import { couponRules, siteContentDefaults } from "./data";
import { legalContentDefaults } from "./legal-content";
import { chooseLeastAssignedBusiness } from "./coupon-assignment";
import { businessCategories } from "./business-categories";
import type { Business, Coupon, ManagedBusiness, Municipality, Race, Redemption } from "./types";

type RaceRecord = {
  id: string;
  name: string;
  short_name: string;
  coupon_quantity: number;
  start_date: string | Date;
  validity_days: number;
  color: string;
  description: string;
  logo_path: string | null;
  card_image_path: string | null;
  card_image_position: string;
};
type BusinessRecord = {
  id: string;
  name: string;
  category: string;
  municipality: Municipality;
  area: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  opening_hours: string;
  description: string;
  image: string;
  active: boolean;
};
type CouponRecord = { code: string; race_id: string; business_id: string; amount_cents: number; used_cents: number };
type RedemptionRecord = { id: number; code: string; business_id: string; amount_cents: number; balance_after_cents: number; created_at: string | Date };

const COUPON_LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ";
const COUPON_DIGITS = "123456789";

function generateCouponCode(prefix: string) {
  const letter = () => COUPON_LETTERS[randomInt(COUPON_LETTERS.length)];
  const digit = () => COUPON_DIGITS[randomInt(COUPON_DIGITS.length)];
  return `EH-${prefix}-${letter()}${digit()}${letter()}${digit()}${digit()}${digit()}${letter()}`;
}

function dateString(value: string | Date) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function mapRace(row: RaceRecord): Race {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    couponQuantity: Number(row.coupon_quantity),
    startDate: dateString(row.start_date),
    validityDays: Number(row.validity_days),
    color: row.color,
    description: row.description,
    logoPath: row.logo_path ?? "",
    cardImagePath: row.card_image_path ?? "",
    cardImagePosition: row.card_image_position ?? "center",
  };
}

function mapBusiness(row: BusinessRecord): Business {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    municipality: row.municipality,
    area: row.area,
    phone: row.phone,
    address: row.address,
    lat: Number(row.lat),
    lng: Number(row.lng),
    openingHours: row.opening_hours,
    description: row.description,
    image: row.image,
  };
}

function mapRedemption(row: RedemptionRecord): Redemption {
  return {
    id: Number(row.id),
    code: row.code,
    businessId: row.business_id,
    amountCents: Number(row.amount_cents),
    balanceAfterCents: Number(row.balance_after_cents),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}

async function getRemoteRace(id: string) {
  const [row] = await getPostgres()<RaceRecord[]>`SELECT * FROM public.races WHERE id = ${id}`;
  return row ? mapRace(row) : undefined;
}

function localCoupon(row: CouponRecord, race: Race): Coupon {
  return {
    code: row.code,
    raceId: row.race_id,
    businessId: row.business_id,
    amountCents: Number(row.amount_cents),
    usedCents: Number(row.used_cents),
    startDate: race.startDate,
    expiresAt: addDays(race.startDate, race.validityDays),
    status: couponStatus(race.startDate, race.validityDays, Number(row.amount_cents), Number(row.used_cents)),
  };
}

export function demoWritesEnabled() {
  return process.env.NODE_ENV === "development" || Boolean(process.env.DATABASE_URL);
}

export function getDatabase() {
  return sqliteStore.getDatabase();
}

export async function listRaces(): Promise<Race[]> {
  if (!hasPostgresDatabase()) return sqliteStore.listRaces();
  const rows = await getPostgres()<RaceRecord[]>`SELECT * FROM public.races ORDER BY start_date, id`;
  return rows.map(mapRace);
}

export async function listBusinesses(): Promise<Business[]> {
  if (!hasPostgresDatabase()) return sqliteStore.listBusinesses();
  const rows = await getPostgres()<BusinessRecord[]>`SELECT * FROM public.businesses WHERE active = true ORDER BY lower(name)`;
  return rows.map(mapBusiness);
}

export async function listBusinessCategories(): Promise<string[]> {
  if (!hasPostgresDatabase()) return [...businessCategories];
  const rows = await getPostgres()<Array<{ name: string }>>`SELECT name FROM public.business_categories WHERE active = true ORDER BY sort_order, lower(name)`;
  return rows.map((row) => row.name);
}

export async function listCouponRules(): Promise<string[]> {
  if (!hasPostgresDatabase()) return couponRules;
  const rows = await getPostgres()<Array<{ body: string }>>`SELECT body FROM public.coupon_rules WHERE active = true ORDER BY sort_order, id`;
  return rows.map((row) => row.body);
}

export async function getSiteContent<T = unknown>(key: string): Promise<T | undefined> {
  const defaults = { ...siteContentDefaults, ...legalContentDefaults } as unknown as Record<string, T>;
  if (!hasPostgresDatabase()) return defaults[key];
  const [row] = await getPostgres()<Array<{ content: T }>>`SELECT content FROM public.site_content WHERE content_key = ${key}`;
  return row?.content ?? defaults[key];
}

export async function listAllBusinesses(): Promise<Business[]> {
  if (!hasPostgresDatabase()) return sqliteStore.listAllBusinesses();
  const rows = await getPostgres()<BusinessRecord[]>`SELECT * FROM public.businesses ORDER BY lower(name)`;
  return rows.map(mapBusiness);
}

export async function listManagedBusinesses(): Promise<ManagedBusiness[]> {
  if (!hasPostgresDatabase()) return sqliteStore.listManagedBusinesses();
  const rows = await getPostgres()<BusinessRecord[]>`SELECT * FROM public.businesses ORDER BY active DESC, lower(name)`;
  return rows.map((row) => ({ business: mapBusiness(row), isActive: row.active }));
}

export async function getBusinessRecord(id: string | null | undefined): Promise<Business | undefined> {
  if (!id) return undefined;
  if (!hasPostgresDatabase()) return sqliteStore.getBusinessRecord(id);
  const [row] = await getPostgres()<BusinessRecord[]>`SELECT * FROM public.businesses WHERE id = ${id}`;
  return row ? mapBusiness(row) : undefined;
}

export async function isBusinessActive(id: string | null | undefined): Promise<boolean> {
  if (!id) return false;
  if (!hasPostgresDatabase()) return sqliteStore.isBusinessActive(id);
  const [row] = await getPostgres()<Array<{ active: boolean }>>`SELECT active FROM public.businesses WHERE id = ${id}`;
  return row?.active === true;
}

export async function updateBusinessRecord(business: Business) {
  if (!hasPostgresDatabase()) return sqliteStore.updateBusinessRecord(business);
  const result = await getPostgres()`
    UPDATE public.businesses SET name = ${business.name}, category = ${business.category}, municipality = ${business.municipality},
      area = ${business.area}, phone = ${business.phone}, address = ${business.address}, lat = ${business.lat}, lng = ${business.lng},
      opening_hours = ${business.openingHours}, description = ${business.description}, image = ${business.image}, updated_at = now()
    WHERE id = ${business.id}
  `;
  if (!result.count) throw new Error("No se encontró el comercio que quieres editar.");
}

export async function getGeocodingCache(cacheKey: string): Promise<{ lat: number; lng: number } | undefined> {
  if (!hasPostgresDatabase()) return sqliteStore.getGeocodingCache(cacheKey);
  const [row] = await getPostgres()<Array<{ lat: number; lng: number }>>`SELECT lat, lng FROM public.geocoding_cache WHERE cache_key = ${cacheKey}`;
  return row ? { lat: Number(row.lat), lng: Number(row.lng) } : undefined;
}

export async function saveGeocodingCache(cacheKey: string, location: { lat: number; lng: number }) {
  if (!hasPostgresDatabase()) return sqliteStore.saveGeocodingCache(cacheKey, location);
  await getPostgres()`
    INSERT INTO public.geocoding_cache (cache_key, lat, lng)
    VALUES (${cacheKey}, ${location.lat}, ${location.lng})
    ON CONFLICT (cache_key) DO UPDATE SET lat = excluded.lat, lng = excluded.lng, updated_at = now()
  `;
}

export async function makeBusinessId(name: string) {
  if (!hasPostgresDatabase()) return sqliteStore.makeBusinessId(name);
  const base = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "comercio";
  const sql = getPostgres();
  let id = base;
  let suffix = 2;
  while ((await sql`SELECT 1 FROM public.businesses WHERE id = ${id}`).length) id = `${base}-${suffix++}`;
  return id;
}

export async function getRace(id: string): Promise<Race | undefined> {
  if (!hasPostgresDatabase()) return sqliteStore.getRace(id);
  return getRemoteRace(id);
}

export async function listRaceCoupons(raceId: string): Promise<Coupon[]> {
  if (!hasPostgresDatabase()) return sqliteStore.listRaceCoupons(raceId);
  const race = await getRemoteRace(raceId);
  if (!race) return [];
  const rows = await getPostgres()<CouponRecord[]>`SELECT * FROM public.coupons WHERE race_id = ${raceId} ORDER BY created_at, code`;
  return rows.map((row) => localCoupon(row, race));
}

export async function listRaceRedemptions(raceId: string): Promise<Redemption[]> {
  if (!hasPostgresDatabase()) return sqliteStore.listRaceRedemptions(raceId);
  const rows = await getPostgres()<RedemptionRecord[]>`
    SELECT r.* FROM public.redemptions r JOIN public.coupons c ON c.code = r.code
    WHERE c.race_id = ${raceId} ORDER BY r.created_at DESC, r.id DESC
  `;
  return rows.map(mapRedemption);
}

export async function listBusinessRedemptions(businessId: string): Promise<Redemption[]> {
  if (!hasPostgresDatabase()) return sqliteStore.listBusinessRedemptions(businessId);
  const rows = await getPostgres()<RedemptionRecord[]>`
    SELECT * FROM public.redemptions WHERE business_id = ${businessId} ORDER BY created_at DESC, id DESC
  `;
  return rows.map(mapRedemption);
}

export async function getCouponDetails(code: string) {
  if (!hasPostgresDatabase()) return sqliteStore.getCouponDetails(code);
  const normalized = code.trim().toUpperCase();
  const [row] = await getPostgres()<CouponRecord[]>`SELECT * FROM public.coupons WHERE code = ${normalized}`;
  if (!row) return undefined;
  const race = await getRemoteRace(row.race_id);
  if (!race) return undefined;
  const detailRows = await getPostgres()<RedemptionRecord[]>`SELECT * FROM public.redemptions WHERE code = ${row.code} ORDER BY created_at DESC, id DESC`;
  return { coupon: localCoupon(row, race), race, redemptions: detailRows.map(mapRedemption) };
}

function validateRaceConfiguration(couponQuantity: number, startDate: string, validityDays: number) {
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(startDate) && !Number.isNaN(Date.parse(`${startDate}T00:00:00Z`))
    && new Date(`${startDate}T00:00:00Z`).toISOString().slice(0, 10) === startDate;
  if (!Number.isInteger(couponQuantity) || couponQuantity < 1 || couponQuantity > 10000) throw new Error("Indica entre 1 y 10.000 bonos.");
  if (!validDate) throw new Error("Indica una fecha de inicio válida.");
  if (!Number.isInteger(validityDays) || validityDays < 1 || validityDays > 365) throw new Error("La vigencia debe estar entre 1 y 365 días.");
}

export async function saveRaceConfiguration(id: string, couponQuantity: number, startDate: string, validityDays: number) {
  if (!hasPostgresDatabase()) return sqliteStore.saveRaceConfiguration(id, couponQuantity, startDate, validityDays);
  validateRaceConfiguration(couponQuantity, startDate, validityDays);
  const sql = getPostgres();
  await sql.begin(async (tx) => {
    const [race] = await tx`SELECT id FROM public.races WHERE id = ${id} FOR UPDATE`;
    if (!race) throw new Error("Carrera no reconocida.");
    const [issued] = await tx`SELECT count(*)::int AS total FROM public.coupons WHERE race_id = ${id}`;
    if (couponQuantity < Number(issued.total)) throw new Error(`Ya hay ${issued.total} bonos emitidos; la cantidad prevista no puede ser menor.`);
    await tx`UPDATE public.races SET coupon_quantity = ${couponQuantity}, start_date = ${startDate}, validity_days = ${validityDays} WHERE id = ${id}`;
  });
}

export async function issueMissingCoupons(raceId: string) {
  if (!hasPostgresDatabase()) return sqliteStore.issueMissingCoupons(raceId);
  const sql = getPostgres();
  return sql.begin(async (tx) => {
    const [raceRow] = await tx<RaceRecord[]>`SELECT * FROM public.races WHERE id = ${raceId} FOR UPDATE`;
    if (!raceRow) throw new Error("Carrera no reconocida.");
    const race = mapRace(raceRow);
    const currentBusinesses = await tx<BusinessRecord[]>`SELECT * FROM public.businesses WHERE active = true ORDER BY lower(name)`;
    if (!currentBusinesses.length) throw new Error("No hay comercios a los que asignar los bonos.");
    const prefix = { bestial: "BES", bimbache: "BIM", meridiano: "MER" }[raceId as "bestial" | "bimbache" | "meridiano"];
    if (!prefix) throw new Error("Carrera no reconocida.");
    const [countRow] = await tx`SELECT count(*)::int AS total FROM public.coupons WHERE race_id = ${raceId}`;
    const count = Number(countRow.total);
    const existingAssignments = await tx<Array<{ business_id: string; total: number }>>`
      SELECT c.business_id, count(*)::int AS total
      FROM public.coupons c
      JOIN public.businesses b ON b.id = c.business_id
      WHERE c.race_id = ${raceId} AND b.active = true
      GROUP BY c.business_id
    `;
    const assignedCoupons = new Map(currentBusinesses.map(({ id }) => [id, 0]));
    for (const assignment of existingAssignments) {
      if (assignedCoupons.has(assignment.business_id)) assignedCoupons.set(assignment.business_id, Number(assignment.total));
    }
    let generated = 0;
    for (let serial = count + 1; serial <= race.couponQuantity; serial++) {
      const business = chooseLeastAssignedBusiness(currentBusinesses, assignedCoupons);
      let inserted = false;
      for (let attempt = 0; attempt < 8 && !inserted; attempt++) {
        const code = generateCouponCode(prefix);
        const result = await tx`
          INSERT INTO public.coupons (code, race_id, business_id, amount_cents)
          VALUES (${code}, ${raceId}, ${business.id}, ${BONO_CENTS})
          ON CONFLICT (code) DO NOTHING RETURNING code
        `;
        inserted = result.length > 0;
      }
      if (!inserted) throw new Error("No se pudo generar un código único tras varios intentos.");
      assignedCoupons.set(business.id, (assignedCoupons.get(business.id) ?? 0) + 1);
      generated += 1;
    }
    return generated;
  });
}

export async function deleteRaceCoupons(raceId: string) {
  if (!hasPostgresDatabase()) return sqliteStore.deleteRaceCoupons(raceId);
  const sql = getPostgres();
  return sql.begin(async (tx) => {
    const [race] = await tx`SELECT id FROM public.races WHERE id = ${raceId} FOR UPDATE`;
    if (!race) throw new Error("Carrera no reconocida.");
    const [coupons] = await tx`SELECT count(*)::int AS total FROM public.coupons WHERE race_id = ${raceId}`;
    const previousCoupons = Number(coupons.total);
    if (!previousCoupons) throw new Error("Esta carrera todavía no tiene bonos emitidos.");
    const [redemptions] = await tx`
      SELECT count(*)::int AS total FROM public.redemptions r JOIN public.coupons c ON c.code = r.code WHERE c.race_id = ${raceId}
    `;
    await tx`DELETE FROM public.redemptions r USING public.coupons c WHERE r.code = c.code AND c.race_id = ${raceId}`;
    await tx`DELETE FROM public.coupons WHERE race_id = ${raceId}`;
    return { removedCoupons: previousCoupons, removedRedemptions: Number(redemptions.total) };
  });
}

export async function redeemCoupon(code: string, businessId: string, amountCents: number, now = new Date()) {
  if (!hasPostgresDatabase()) return sqliteStore.redeemCoupon(code, businessId, amountCents, now);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error("Introduce un importe mayor que cero.");
  const normalized = code.trim().toUpperCase();
  const sql = getPostgres();
  await sql.begin(async (tx) => {
    const [row] = await tx<Array<CouponRecord & { start_date: string | Date; validity_days: number }>>`
      SELECT c.*, r.start_date, r.validity_days FROM public.coupons c JOIN public.races r ON r.id = c.race_id
      WHERE c.code = ${normalized} FOR UPDATE OF c
    `;
    if (!row) throw new Error("Bono no encontrado.");
    if (row.business_id !== businessId) throw new Error("Este bono pertenece a otro comercio.");
    const startDate = dateString(row.start_date);
    const status = couponStatus(startDate, Number(row.validity_days), Number(row.amount_cents), Number(row.used_cents), todayInCanary(now));
    if (status === "not-started") throw new Error("Este bono aún no está vigente.");
    if (status === "expired") throw new Error("Este bono ha caducado.");
    if (status === "redeemed") throw new Error("Este bono ya no tiene saldo.");
    const balance = Number(row.amount_cents) - Number(row.used_cents);
    if (amountCents > balance) throw new Error("El importe supera el saldo disponible.");
    const newBalance = balance - amountCents;
    await tx`UPDATE public.coupons SET used_cents = used_cents + ${amountCents} WHERE code = ${normalized}`;
    await tx`INSERT INTO public.redemptions (code, business_id, amount_cents, balance_after_cents, created_at)
      VALUES (${normalized}, ${businessId}, ${amountCents}, ${newBalance}, ${now.toISOString()})`;
  });
  return getCouponDetails(normalized);
}
