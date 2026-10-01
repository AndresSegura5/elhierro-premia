import { randomInt } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { addDays, BONO_CENTS, couponStatus, todayInCanary } from "./bonos";
import { chooseLeastAssignedBusiness } from "./coupon-assignment";
import { businesses, raceDefaults } from "./data";
import type { Business, Coupon, ManagedBusiness, Municipality, Race, Redemption } from "./types";

type RaceRow = { id: string; coupon_quantity: number; start_date: string; validity_days: number };
type CouponRow = { code: string; race_id: string; business_id: string; amount_cents: number; used_cents: number };
type RedemptionRow = { id: number; code: string; business_id: string; amount_cents: number; balance_after_cents: number; created_at: string };
type BusinessRow = {
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
  active: number;
};

let database: DatabaseSync | undefined;

const COUPON_LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ";
const COUPON_DIGITS = "123456789";

function generateCouponCode(prefix: string) {
  const letter = () => COUPON_LETTERS[randomInt(COUPON_LETTERS.length)];
  const digit = () => COUPON_DIGITS[randomInt(COUPON_DIGITS.length)];
  return `EH-${prefix}-${letter()}${digit()}${letter()}${digit()}${digit()}${digit()}${letter()}`;
}

function migrateLegacyCouponCodes(db: DatabaseSync) {
  const legacyFormat = /^EH-(BES|BIM|MER)-[A-HJ-KM-NP-Z][1-9][A-HJ-KM-NP-Z][1-9]{2}$/i;
  const prefixByRace: Record<string, string> = { bestial: "BES", bimbache: "BIM", meridiano: "MER" };
  const coupons = db.prepare("SELECT code, race_id FROM coupons").all() as Array<{ code: string; race_id: string }>;
  const legacyCoupons = coupons.filter((coupon) => legacyFormat.test(coupon.code));
  if (!legacyCoupons.length) return;

  const reservedCodes = new Set(coupons.map((coupon) => coupon.code.toUpperCase()));
  const changes = legacyCoupons.map((coupon) => {
    const prefix = prefixByRace[coupon.race_id];
    if (!prefix) throw new Error(`No se reconoce la carrera del bono ${coupon.code}.`);
    let nextCode = generateCouponCode(prefix);
    while (reservedCodes.has(nextCode)) nextCode = generateCouponCode(prefix);
    reservedCodes.add(nextCode);
    return { previousCode: coupon.code, nextCode };
  });

  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec("PRAGMA defer_foreign_keys = ON");
    const updateRedemptions = db.prepare("UPDATE redemptions SET code = ? WHERE code = ?");
    const updateCoupon = db.prepare("UPDATE coupons SET code = ? WHERE code = ?");
    for (const { previousCode, nextCode } of changes) {
      updateRedemptions.run(nextCode, previousCode);
      updateCoupon.run(nextCode, previousCode);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function generateUniqueCouponCode(prefix: string) {
  const db = getDatabase();
  let code = generateCouponCode(prefix);
  while (db.prepare("SELECT 1 FROM coupons WHERE code = ?").get(code)) {
    code = generateCouponCode(prefix);
  }
  return code;
}

export function getDatabase() {
  if (database) return database;
  const filename = demoWritesEnabled() ? process.env.BONOS_DB_PATH ?? join(process.cwd(), ".data", "bonos.sqlite") : ":memory:";
  if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  const hadBusinessesTable = !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'businesses'").get();
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS races (
      id TEXT PRIMARY KEY,
      coupon_quantity INTEGER NOT NULL CHECK (coupon_quantity BETWEEN 1 AND 10000),
      start_date TEXT NOT NULL,
      validity_days INTEGER NOT NULL CHECK (validity_days BETWEEN 1 AND 365)
    );
    CREATE TABLE IF NOT EXISTS coupons (
      code TEXT PRIMARY KEY,
      race_id TEXT NOT NULL REFERENCES races(id),
      business_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
      used_cents INTEGER NOT NULL DEFAULT 0 CHECK (used_cents >= 0 AND used_cents <= amount_cents)
    );
    CREATE INDEX IF NOT EXISTS coupons_race_id ON coupons(race_id);
    CREATE TABLE IF NOT EXISTS redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL REFERENCES coupons(code),
      business_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
      balance_after_cents INTEGER NOT NULL CHECK (balance_after_cents >= 0),
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS redemptions_code ON redemptions(code);
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'merchant')),
      business_id TEXT UNIQUE,
      demo_business_id TEXT,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT
    );
    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      municipality TEXT NOT NULL,
      area TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      opening_hours TEXT NOT NULL,
      description TEXT NOT NULL,
      image TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS geocoding_cache (
      cache_key TEXT PRIMARY KEY,
      lat REAL NOT NULL,
      lng REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id);
  `);
  const raceColumns = db.prepare("PRAGMA table_info(races)").all() as Array<{ name: string }>;
  const couponColumns = db.prepare("PRAGMA table_info(coupons)").all() as Array<{ name: string }>;
  if (raceColumns.some((column) => column.name === "participants")) {
    db.exec("ALTER TABLE races RENAME COLUMN participants TO coupon_quantity");
  }
  if (couponColumns.some((column) => column.name === "bib")) db.exec("ALTER TABLE coupons DROP COLUMN bib");
  if (couponColumns.some((column) => column.name === "issue_label")) db.exec("ALTER TABLE coupons DROP COLUMN issue_label");
  const userColumns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  if (!userColumns.some((column) => column.name === "demo_business_id")) {
    db.exec("ALTER TABLE users ADD COLUMN demo_business_id TEXT");
  }
  if (!userColumns.some((column) => column.name === "first_name")) db.exec("ALTER TABLE users ADD COLUMN first_name TEXT");
  if (!userColumns.some((column) => column.name === "last_name")) db.exec("ALTER TABLE users ADD COLUMN last_name TEXT");
  if (!userColumns.some((column) => column.name === "email")) db.exec("ALTER TABLE users ADD COLUMN email TEXT");
  if (!userColumns.some((column) => column.name === "must_change_password")) db.exec("ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email COLLATE NOCASE) WHERE email IS NOT NULL");
  const businessColumns = db.prepare("PRAGMA table_info(businesses)").all() as Array<{ name: string }>;
  if (!businessColumns.some((column) => column.name === "active")) db.exec("ALTER TABLE businesses ADD COLUMN active INTEGER NOT NULL DEFAULT 1");
  const seed = db.prepare("INSERT OR IGNORE INTO races (id, coupon_quantity, start_date, validity_days) VALUES (?, ?, ?, ?)");
  for (const race of raceDefaults) seed.run(race.id, race.couponQuantity, race.startDate, race.validityDays);
  if (!hadBusinessesTable) {
    const insertBusiness = db.prepare("INSERT OR IGNORE INTO businesses (id, name, category, municipality, area, phone, address, lat, lng, opening_hours, description, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    for (const business of businesses) insertBusiness.run(business.id, business.name, business.category, business.municipality, business.area, business.phone, business.address, business.lat, business.lng, business.openingHours, business.description, business.image);
  }
  migrateLegacyCouponCodes(db);
  database = db;
  return db;
}

function mapRace(row: RaceRow): Race {
  const defaults = raceDefaults.find((race) => race.id === row.id);
  if (!defaults) throw new Error("Carrera no reconocida.");
  return { ...defaults, couponQuantity: row.coupon_quantity, startDate: row.start_date, validityDays: row.validity_days };
}

function mapCoupon(row: CouponRow, race: Race): Coupon {
  return {
    code: row.code,
    raceId: row.race_id,
    businessId: row.business_id,
    amountCents: row.amount_cents,
    usedCents: row.used_cents,
    startDate: race.startDate,
    expiresAt: addDays(race.startDate, race.validityDays),
    status: couponStatus(race.startDate, race.validityDays, row.amount_cents, row.used_cents),
  };
}

function mapRedemption(row: RedemptionRow): Redemption {
  return {
    id: row.id,
    code: row.code,
    businessId: row.business_id,
    amountCents: row.amount_cents,
    balanceAfterCents: row.balance_after_cents,
    createdAt: row.created_at,
  };
}

export function listRaces() {
  const rows = getDatabase().prepare("SELECT * FROM races").all() as RaceRow[];
  return raceDefaults.map((race) => mapRace(rows.find((row) => row.id === race.id)!));
}

function mapBusiness(row: BusinessRow): Business {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    municipality: row.municipality,
    area: row.area,
    phone: row.phone,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    openingHours: row.opening_hours,
    description: row.description,
    image: row.image,
  };
}

export function listBusinesses() {
  const query = "SELECT * FROM businesses WHERE active = 1 ORDER BY name COLLATE NOCASE";
  return (getDatabase().prepare(query).all() as BusinessRow[]).map(mapBusiness);
}

export function listAllBusinesses() {
  return (getDatabase().prepare("SELECT * FROM businesses ORDER BY name COLLATE NOCASE").all() as BusinessRow[]).map(mapBusiness);
}

export function listManagedBusinesses(): ManagedBusiness[] {
  return (getDatabase().prepare("SELECT * FROM businesses ORDER BY active DESC, name COLLATE NOCASE").all() as BusinessRow[])
    .map((row) => ({ business: mapBusiness(row), isActive: row.active === 1 }));
}

export function getBusinessRecord(id: string | null | undefined) {
  if (!id) return undefined;
  const row = getDatabase().prepare("SELECT * FROM businesses WHERE id = ?").get(id) as BusinessRow | undefined;
  return row ? mapBusiness(row) : undefined;
}

export function isBusinessActive(id: string | null | undefined) {
  if (!id) return false;
  const row = getDatabase().prepare("SELECT active FROM businesses WHERE id = ?").get(id) as { active: number } | undefined;
  return row?.active === 1;
}

export function updateBusinessRecord(business: Business) {
  const result = getDatabase().prepare(`UPDATE businesses SET name = ?, category = ?, municipality = ?, area = ?, phone = ?, address = ?, lat = ?, lng = ?, opening_hours = ?, description = ?, image = ? WHERE id = ?`)
    .run(business.name, business.category, business.municipality, business.area, business.phone, business.address, business.lat, business.lng, business.openingHours, business.description, business.image, business.id);
  if (!result.changes) throw new Error("No se encontró el comercio que quieres editar.");
}

export function getGeocodingCache(cacheKey: string) {
  return getDatabase().prepare("SELECT lat, lng FROM geocoding_cache WHERE cache_key = ?").get(cacheKey) as { lat: number; lng: number } | undefined;
}

export function saveGeocodingCache(cacheKey: string, location: { lat: number; lng: number }) {
  getDatabase().prepare("INSERT OR REPLACE INTO geocoding_cache (cache_key, lat, lng) VALUES (?, ?, ?)").run(cacheKey, location.lat, location.lng);
}

export function makeBusinessId(name: string) {
  const base = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "comercio";
  const db = getDatabase();
  let id = base;
  let suffix = 2;
  while (db.prepare("SELECT 1 FROM businesses WHERE id = ?").get(id)) id = `${base}-${suffix++}`;
  return id;
}

export function getRace(id: string) {
  const row = getDatabase().prepare("SELECT * FROM races WHERE id = ?").get(id) as RaceRow | undefined;
  return row ? mapRace(row) : undefined;
}

export function listRaceCoupons(raceId: string) {
  const race = getRace(raceId);
  if (!race) return [];
  const rows = getDatabase().prepare("SELECT * FROM coupons WHERE race_id = ? ORDER BY rowid").all(raceId) as CouponRow[];
  return rows.map((row) => mapCoupon(row, race));
}

export function listRaceRedemptions(raceId: string) {
  const rows = getDatabase().prepare(`
    SELECT r.* FROM redemptions r JOIN coupons c ON c.code = r.code
    WHERE c.race_id = ? ORDER BY r.created_at DESC, r.id DESC
  `).all(raceId) as RedemptionRow[];
  return rows.map(mapRedemption);
}

export function listBusinessRedemptions(businessId: string) {
  const rows = getDatabase().prepare(`
    SELECT * FROM redemptions WHERE business_id = ? ORDER BY created_at DESC, id DESC
  `).all(businessId) as RedemptionRow[];
  return rows.map(mapRedemption);
}

export function getCouponDetails(code: string) {
  const db = getDatabase();
  const row = db.prepare("SELECT * FROM coupons WHERE code = ? COLLATE NOCASE").get(code.trim()) as CouponRow | undefined;
  if (!row) return undefined;
  const race = getRace(row.race_id);
  if (!race) return undefined;
  const redemptions = db.prepare("SELECT * FROM redemptions WHERE code = ? ORDER BY created_at DESC, id DESC").all(row.code) as RedemptionRow[];
  return { coupon: mapCoupon(row, race), race, redemptions: redemptions.map(mapRedemption) };
}

export function saveRaceConfiguration(id: string, couponQuantity: number, startDate: string, validityDays: number) {
  const db = getDatabase();
  if (!getRace(id)) throw new Error("Carrera no reconocida.");
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(startDate) && !Number.isNaN(Date.parse(`${startDate}T00:00:00Z`))
    && new Date(`${startDate}T00:00:00Z`).toISOString().slice(0, 10) === startDate;
  if (!Number.isInteger(couponQuantity) || couponQuantity < 1 || couponQuantity > 10000) throw new Error("Indica entre 1 y 10.000 bonos.");
  if (!validDate) throw new Error("Indica una fecha de inicio válida.");
  if (!Number.isInteger(validityDays) || validityDays < 1 || validityDays > 365) throw new Error("La vigencia debe estar entre 1 y 365 días.");
  db.exec("BEGIN IMMEDIATE");
  try {
    const issued = db.prepare("SELECT COUNT(*) AS total FROM coupons WHERE race_id = ?").get(id) as { total: number };
    if (couponQuantity < issued.total) throw new Error(`Ya hay ${issued.total} bonos emitidos; la cantidad prevista no puede ser menor.`);
    db.prepare("UPDATE races SET coupon_quantity = ?, start_date = ?, validity_days = ? WHERE id = ?")
      .run(couponQuantity, startDate, validityDays, id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function issueMissingCoupons(raceId: string) {
  const db = getDatabase();
  const currentBusinesses = listBusinesses();
  if (!currentBusinesses.length) throw new Error("No hay comercios a los que asignar los bonos.");
  const prefix = { bestial: "BES", bimbache: "BIM", meridiano: "MER" }[raceId as "bestial" | "bimbache" | "meridiano"];
  if (!prefix) throw new Error("Carrera no reconocida.");
  db.exec("BEGIN IMMEDIATE");
  try {
    const race = getRace(raceId);
    if (!race) throw new Error("Carrera no reconocida.");
    const count = (db.prepare("SELECT COUNT(*) AS total FROM coupons WHERE race_id = ?").get(raceId) as { total: number }).total;
    const existingAssignments = db.prepare("SELECT business_id, COUNT(*) AS total FROM coupons WHERE race_id = ? GROUP BY business_id").all(raceId) as Array<{ business_id: string; total: number }>;
    const assignedCoupons = new Map(currentBusinesses.map(({ id }) => [id, 0]));
    for (const assignment of existingAssignments) {
      if (assignedCoupons.has(assignment.business_id)) assignedCoupons.set(assignment.business_id, Number(assignment.total));
    }
    const insert = db.prepare("INSERT INTO coupons (code, race_id, business_id, amount_cents) VALUES (?, ?, ?, ?)");
    for (let serial = count + 1; serial <= race.couponQuantity; serial++) {
      const business = chooseLeastAssignedBusiness(currentBusinesses, assignedCoupons);
      const code = generateUniqueCouponCode(prefix);
      insert.run(code, raceId, business.id, BONO_CENTS);
      assignedCoupons.set(business.id, (assignedCoupons.get(business.id) ?? 0) + 1);
    }
    db.exec("COMMIT");
    return race.couponQuantity - count;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function deleteRaceCoupons(raceId: string) {
  const db = getDatabase();
  const race = getRace(raceId);
  if (!race) throw new Error("Carrera no reconocida.");

  db.exec("BEGIN IMMEDIATE");
  try {
    const previousCoupons = (db.prepare("SELECT COUNT(*) AS total FROM coupons WHERE race_id = ?").get(raceId) as { total: number }).total;
    if (!previousCoupons) throw new Error("Esta carrera todavía no tiene bonos emitidos.");
    const previousRedemptions = (db.prepare("SELECT COUNT(*) AS total FROM redemptions WHERE code IN (SELECT code FROM coupons WHERE race_id = ?)").get(raceId) as { total: number }).total;
    db.prepare("DELETE FROM redemptions WHERE code IN (SELECT code FROM coupons WHERE race_id = ?)").run(raceId);
    db.prepare("DELETE FROM coupons WHERE race_id = ?").run(raceId);
    db.exec("COMMIT");
    return { removedCoupons: previousCoupons, removedRedemptions: previousRedemptions };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function redeemCoupon(code: string, businessId: string, amountCents: number, now = new Date()) {
  const db = getDatabase();
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error("Introduce un importe mayor que cero.");
  db.exec("BEGIN IMMEDIATE");
  try {
    const row = db.prepare("SELECT * FROM coupons WHERE code = ? COLLATE NOCASE").get(code.trim()) as CouponRow | undefined;
    if (!row) throw new Error("Bono no encontrado.");
    if (row.business_id !== businessId) throw new Error("Este bono pertenece a otro comercio.");
    const race = getRace(row.race_id);
    if (!race) throw new Error("Carrera no reconocida.");
    const status = couponStatus(race.startDate, race.validityDays, row.amount_cents, row.used_cents, todayInCanary(now));
    if (status === "not-started") throw new Error("Este bono aún no está vigente.");
    if (status === "expired") throw new Error("Este bono ha caducado.");
    if (status === "redeemed") throw new Error("Este bono ya no tiene saldo.");
    const balance = row.amount_cents - row.used_cents;
    if (amountCents > balance) throw new Error("El importe supera el saldo disponible.");
    const newBalance = balance - amountCents;
    db.prepare("UPDATE coupons SET used_cents = used_cents + ? WHERE code = ?").run(amountCents, row.code);
    db.prepare("INSERT INTO redemptions (code, business_id, amount_cents, balance_after_cents, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(row.code, businessId, amountCents, newBalance, now.toISOString());
    db.exec("COMMIT");
    return getCouponDetails(row.code)!;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function demoWritesEnabled() {
  return process.env.NODE_ENV === "development";
}
