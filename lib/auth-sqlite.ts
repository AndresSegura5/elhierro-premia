import "server-only";

import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Business } from "./types";
import { initialBusinessUsername } from "./business-credentials";
import { demoWritesEnabled, getBusinessRecord, getDatabase, isBusinessActive, makeBusinessId } from "./store-sqlite";

const scrypt = promisify(scryptCallback);
const COOKIE = "bonos_session";
const SESSION_HOURS = 12;

type Role = "admin" | "merchant";
type UserRow = {
  id: number;
  username: string;
  password_hash: string;
  role: Role;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  must_change_password: number;
  business_id: string | null;
  failed_attempts: number;
  locked_until: string | null;
};
export type SessionUser = Pick<UserRow, "id" | "username" | "role"> & {
  businessId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  mustChangePassword: boolean;
};

async function passwordHash(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${hash.toString("hex")}`;
}

async function passwordMatches(password: string, stored: string) {
  const [algorithm, salt, encoded] = stored.split(":");
  if (algorithm !== "scrypt" || !salt || !encoded) return false;
  const expected = Buffer.from(encoded, "hex");
  if (expected.length !== 64) return false;
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return timingSafeEqual(actual, expected);
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function adminExists() {
  return !!getDatabase().prepare("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1").get();
}

export async function createFirstAdmin(username: string, password: string) {
  if (!demoWritesEnabled()) throw new Error("La configuración inicial solo está disponible en el entorno local.");
  const normalized = username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{4,40}$/.test(normalized)) throw new Error("El usuario debe tener entre 4 y 40 letras, números, puntos o guiones.");
  if (password.length < 12 || password.length > 200) throw new Error("La contraseña debe tener entre 12 y 200 caracteres.");
  const hash = await passwordHash(password);
  const db = getDatabase();
  db.exec("BEGIN IMMEDIATE");
  try {
    if (adminExists()) throw new Error("La cuenta de administración ya está creada.");
    db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')").run(normalized, hash);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export async function signIn(username: string, password: string, role: Role) {
  const normalized = username.trim().toLowerCase();
  if (!normalized || !password || password.length > 200) return false;
  const db = getDatabase();
  const user = role === "admin"
    ? db.prepare("SELECT * FROM users WHERE (username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE) AND role = 'admin'").get(normalized, normalized) as UserRow | undefined
    : db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE AND role = 'merchant'").get(normalized) as UserRow | undefined;
  if (!user || (user.locked_until && user.locked_until > new Date().toISOString())) return false;
  const passwordIsValid = await passwordMatches(password, user.password_hash);
  if (!passwordIsValid) {
    const attempts = user.failed_attempts + 1;
    db.prepare("UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?")
      .run(attempts >= 5 ? 0 : attempts, attempts >= 5 ? new Date(Date.now() + 15 * 60_000).toISOString() : null, user.id);
    return false;
  }
  if (role === "merchant" && (!user.business_id || !isBusinessActive(user.business_id))) return false;
  const jar = await cookies();
  const previousToken = jar.get(COOKIE)?.value;
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_HOURS * 60 * 60_000);
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?").run(user.id);
    db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
      .run(tokenHash(token), user.id, expires.toISOString());
    if (previousToken) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(previousToken));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
  return true;
}

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = getDatabase().prepare(`
    SELECT u.id, u.username, u.role, u.business_id,
      u.first_name, u.last_name, u.email, u.must_change_password
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).get(tokenHash(token), new Date().toISOString()) as Pick<UserRow, "id" | "username" | "role" | "business_id" | "first_name" | "last_name" | "email" | "must_change_password"> | undefined;
  return row ? {
    id: row.id,
    username: row.username,
    role: row.role,
    businessId: row.role === "merchant" ? row.business_id : null,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    mustChangePassword: row.must_change_password === 1,
  } : null;
}

export async function requireAdmin() {
  const session = await getSession();
  if (session?.role !== "admin") redirect("/admin/login");
  if (session.mustChangePassword) redirect("/admin/primer-acceso");
  return session;
}

export async function requireMerchant() {
  const session = await getSession();
  if (session?.role !== "merchant" || !session.businessId || !isBusinessActive(session.businessId)) redirect("/comercio/login");
  return session;
}

export async function signOut() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) getDatabase().prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(token));
  jar.delete(COOKIE);
}

export type AdminAccountSummary = {
  id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  must_change_password: number;
};

export function listAdminAccounts() {
  return getDatabase().prepare(`
    SELECT id, username, first_name, last_name, email, must_change_password
    FROM users WHERE role = 'admin'
    ORDER BY first_name COLLATE NOCASE, last_name COLLATE NOCASE, username COLLATE NOCASE
  `).all() as AdminAccountSummary[];
}

export async function createAdminAccount(firstName: string, lastName: string, email: string) {
  if (!demoWritesEnabled()) throw new Error("La gestión de administradores necesita una base de datos persistente.");
  const cleanFirstName = firstName.trim();
  const cleanLastName = lastName.trim();
  const normalizedEmail = email.trim().toLowerCase();
  if (cleanFirstName.length < 2 || cleanFirstName.length > 80) throw new Error("Indica un nombre válido.");
  if (cleanLastName.length < 2 || cleanLastName.length > 100) throw new Error("Indica apellidos válidos.");
  if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error("Indica un correo electrónico válido.");

  const db = getDatabase();
  if (db.prepare("SELECT 1 FROM users WHERE email = ? COLLATE NOCASE OR username = ? COLLATE NOCASE LIMIT 1").get(normalizedEmail, normalizedEmail)) {
    throw new Error("Ya existe una cuenta con ese correo.");
  }
  const temporaryPassword = randomBytes(18).toString("base64url");
  const hash = await passwordHash(temporaryPassword);
  try {
    db.prepare(`
      INSERT INTO users (username, password_hash, role, first_name, last_name, email, must_change_password)
      VALUES (?, ?, 'admin', ?, ?, ?, 1)
    `).run(normalizedEmail, hash, cleanFirstName, cleanLastName, normalizedEmail);
  } catch {
    throw new Error("No se pudo crear la cuenta. Comprueba que el correo no esté ya registrado.");
  }
  return { temporaryPassword };
}

export async function resetAdminPassword(targetUserId: number, actingAdminId: number) {
  if (!demoWritesEnabled()) throw new Error("La gestión de administradores necesita una base de datos persistente.");
  if (!Number.isSafeInteger(targetUserId) || targetUserId <= 0 || targetUserId === actingAdminId) {
    throw new Error("Selecciona otro administrador para restablecer su contraseña.");
  }
  const db = getDatabase();
  const target = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'admin'").get(targetUserId) as { id: number } | undefined;
  if (!target) throw new Error("No se encontró ese administrador.");
  const temporaryPassword = randomBytes(18).toString("base64url");
  const hash = await passwordHash(temporaryPassword);
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("UPDATE users SET password_hash = ?, must_change_password = 1, failed_attempts = 0, locked_until = NULL WHERE id = ? AND role = 'admin'").run(hash, targetUserId);
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(targetUserId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { temporaryPassword };
}

export async function completeAdminPasswordSetup(password: string) {
  const session = await getSession();
  if (!session || session.role !== "admin" || !session.mustChangePassword) throw new Error("Esta cuenta no necesita configurar una contraseña.");
  if (password.length < 12 || password.length > 200) throw new Error("La contraseña debe tener entre 12 y 200 caracteres.");
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) throw new Error("La sesión ha caducado. Inicia sesión de nuevo.");
  const hash = await passwordHash(password);
  const db = getDatabase();
  db.prepare("UPDATE users SET password_hash = ?, must_change_password = 0, failed_attempts = 0, locked_until = NULL WHERE id = ? AND role = 'admin'").run(hash, session.id);
  db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").run(session.id, tokenHash(token));
}

export async function changeAdminPassword(currentPassword: string, newPassword: string) {
  const session = await getSession();
  if (!session || session.role !== "admin" || session.mustChangePassword) throw new Error("Inicia sesión para cambiar tu contraseña.");
  if (newPassword.length < 12 || newPassword.length > 200) throw new Error("La nueva contraseña debe tener entre 12 y 200 caracteres.");
  const db = getDatabase();
  const user = db.prepare("SELECT password_hash FROM users WHERE id = ? AND role = 'admin'").get(session.id) as { password_hash: string } | undefined;
  if (!user || !(await passwordMatches(currentPassword, user.password_hash))) throw new Error("La contraseña actual no es correcta.");
  const hash = await passwordHash(newPassword);
  const token = (await cookies()).get(COOKIE)?.value;
  db.prepare("UPDATE users SET password_hash = ?, failed_attempts = 0, locked_until = NULL WHERE id = ? AND role = 'admin'").run(hash, session.id);
  if (token) db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").run(session.id, tokenHash(token));
}

export function listMerchantAccounts() {
  return getDatabase().prepare("SELECT username, business_id FROM users WHERE role = 'merchant'").all() as Array<{ username: string; business_id: string }>;
}

function businessUsername(name: string) {
  return initialBusinessUsername(name);
}

function uniqueMerchantUsername(name: string, exceptUserId?: number) {
  const db = getDatabase();
  const base = businessUsername(name);
  let username = base;
  let suffix = 2;
  while (db.prepare("SELECT 1 FROM users WHERE username = ? COLLATE NOCASE AND id != COALESCE(?, -1)").get(username, exceptUserId ?? null)) username = `${base}-${suffix++}`;
  return username;
}

export async function syncMerchantUsername(businessId: string, name: string) {
  const db = getDatabase();
  const accounts = db.prepare("SELECT id, username FROM users WHERE business_id = ? AND role = 'merchant'").all(businessId) as Array<{ id: number; username: string }>;
  if (!accounts.length) return;
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const account of accounts) {
      const username = uniqueMerchantUsername(name, account.id);
      if (username !== account.username) {
        db.prepare("UPDATE users SET username = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?").run(username, account.id);
        db.prepare("DELETE FROM sessions WHERE user_id = ?").run(account.id);
      }
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export async function createBusinessWithMerchant(business: Omit<Business, "id">) {
  const db = getDatabase();
  const password = randomBytes(18).toString("base64url");
  const hash = await passwordHash(password);
  db.exec("BEGIN IMMEDIATE");
  try {
    const id = makeBusinessId(business.name);
    const username = uniqueMerchantUsername(business.name);
    db.prepare("INSERT INTO businesses (id, name, category, municipality, area, phone, address, lat, lng, opening_hours, description, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, business.name, business.category, business.municipality, business.area, business.phone, business.address, business.lat, business.lng, business.openingHours, business.description, business.image);
    db.prepare("INSERT INTO users (username, password_hash, role, business_id) VALUES (?, ?, 'merchant', ?)").run(username, hash, id);
    db.exec("COMMIT");
    return { business: { ...business, id }, username, password };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function deleteBusinessAndAccess(businessId: string) {
  const db = getDatabase();
  db.exec("BEGIN IMMEDIATE");
  try {
    const linked = db.prepare("SELECT COUNT(*) AS total FROM coupons WHERE business_id = ?").get(businessId) as { total: number };
    const merchantIds = db.prepare("SELECT id FROM users WHERE business_id = ? AND role = 'merchant'").all(businessId) as Array<{ id: number }>;
    for (const merchant of merchantIds) db.prepare("DELETE FROM sessions WHERE user_id = ?").run(merchant.id);
    db.prepare("DELETE FROM users WHERE business_id = ? AND role = 'merchant'").run(businessId);
    const result = linked.total
      ? db.prepare("UPDATE businesses SET active = 0 WHERE id = ?").run(businessId)
      : db.prepare("DELETE FROM businesses WHERE id = ?").run(businessId);
    if (!result.changes) throw new Error("No se encontró el comercio que quieres borrar.");
    db.exec("COMMIT");
    return linked.total > 0;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export async function restoreBusinessWithAccess(businessId: string) {
  const business = getBusinessRecord(businessId);
  if (!business || isBusinessActive(businessId)) throw new Error("El comercio ya está activo o no existe.");
  const db = getDatabase();
  const password = randomBytes(18).toString("base64url");
  const hash = await passwordHash(password);
  db.exec("BEGIN IMMEDIATE");
  try {
    const username = uniqueMerchantUsername(business.name);
    db.prepare("UPDATE businesses SET active = 1 WHERE id = ?").run(businessId);
    db.prepare("INSERT INTO users (username, password_hash, role, business_id) VALUES (?, ?, 'merchant', ?)").run(username, hash, businessId);
    db.exec("COMMIT");
    return { businessName: business.name, username, password };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export async function provisionMerchant(businessId: string) {
  const business = getBusinessRecord(businessId);
  if (!business || !isBusinessActive(businessId)) throw new Error("Comercio no disponible.");
  const db = getDatabase();
  const password = randomBytes(18).toString("base64url");
  const hash = await passwordHash(password);
  db.exec("BEGIN IMMEDIATE");
  try {
    const existing = db.prepare("SELECT id FROM users WHERE business_id = ? AND role = 'merchant'").get(businessId) as { id: number } | undefined;
    const username = uniqueMerchantUsername(business.name, existing?.id);
    if (existing) {
      db.prepare("UPDATE users SET username = ?, password_hash = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?").run(username, hash, existing.id);
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(existing.id);
    } else {
      db.prepare("INSERT INTO users (username, password_hash, role, business_id) VALUES (?, ?, 'merchant', ?)").run(username, hash, businessId);
    }
    db.exec("COMMIT");
    return { username, password };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
