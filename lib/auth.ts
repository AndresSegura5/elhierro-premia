import "server-only";

import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Business } from "./types";
import * as sqliteAuth from "./auth-sqlite";
import { hasPostgresDatabase, getPostgres } from "./postgres";
import { getBusinessRecord, isBusinessActive, makeBusinessId } from "./store";
import { initialBusinessUsername } from "./business-credentials";
import type { SignInResult } from "./auth-result";

const scrypt = promisify(scryptCallback);
const COOKIE = "bonos_session";
const SESSION_HOURS = 12;
type Role = "admin" | "merchant";
type UserRow = {
  id: number;
  username: string;
  password_hash: string;
  role: Role;
  is_superuser: boolean;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  must_change_password: boolean;
  business_id: string | null;
  failed_attempts: number;
  locked_until: string | Date | null;
};

export type SessionUser = Pick<UserRow, "id" | "username" | "role"> & {
  businessId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  mustChangePassword: boolean;
  isSuperuser: boolean;
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

function temporaryPassword() {
  return randomBytes(24).toString("base64url");
}

function mapSession(row: Pick<UserRow, "id" | "username" | "role" | "business_id" | "first_name" | "last_name" | "email" | "must_change_password" | "is_superuser">): SessionUser {
  return {
    id: Number(row.id),
    username: row.username,
    role: row.role,
    businessId: row.role === "merchant" ? row.business_id : null,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    mustChangePassword: row.must_change_password === true,
    isSuperuser: row.is_superuser === true,
  };
}

export async function adminExists() {
  if (!hasPostgresDatabase()) return sqliteAuth.adminExists();
  const [row] = await getPostgres()`SELECT 1 FROM public.users WHERE role = 'admin' LIMIT 1`;
  return Boolean(row);
}

export async function createFirstAdmin(username: string, password: string) {
  if (!hasPostgresDatabase()) return sqliteAuth.createFirstAdmin(username, password);
  const normalized = username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{4,40}$/.test(normalized)) throw new Error("El usuario debe tener entre 4 y 40 letras, números, puntos o guiones.");
  if (password.length < 12 || password.length > 200) throw new Error("La contraseña debe tener entre 12 y 200 caracteres.");
  const hash = await passwordHash(password);
  const sql = getPostgres();
  try {
    await sql.begin(async (tx) => {
      const [existing] = await tx`SELECT id FROM public.users WHERE role = 'admin' LIMIT 1 FOR UPDATE`;
      if (existing) throw new Error("La cuenta de administración ya está creada.");
      await tx`INSERT INTO public.users (username, password_hash, role, is_superuser) VALUES (${normalized}, ${hash}, 'admin', true)`;
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("administración")) throw error;
    throw new Error("No se pudo crear la cuenta. Comprueba que el usuario esté disponible.");
  }
}

export async function signIn(username: string, password: string, role: Role) {
  return (await signInDetailed(username, password, role)).success;
}

export async function signInDetailed(username: string, password: string, role: Role): Promise<SignInResult> {
  if (!hasPostgresDatabase()) return sqliteAuth.signInDetailed(username, password, role);
  const normalized = username.trim().toLowerCase();
  if (!normalized || normalized.length > 254 || !password || password.length > 200) return { success: false, reason: "invalid" };
  const sql = getPostgres();
  const rows = role === "admin"
    ? await sql<UserRow[]>`SELECT * FROM public.users WHERE (lower(username) = ${normalized} OR lower(email) = ${normalized}) AND role = 'admin'`
    : await sql<UserRow[]>`SELECT * FROM public.users WHERE lower(username) = ${normalized} AND role = 'merchant'`;
  const user = rows[0];
  if (!user) {
    await passwordMatches(password, `scrypt:unknown-account:${"0".repeat(128)}`);
    return { success: false, reason: "invalid" };
  }
  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) return { success: false, reason: "locked" };
  if (!(await passwordMatches(password, user.password_hash))) {
    const [failure] = await sql`
      UPDATE public.users
      SET failed_attempts = CASE WHEN failed_attempts >= 4 THEN 0 ELSE failed_attempts + 1 END,
          locked_until = CASE WHEN locked_until > now() THEN locked_until WHEN failed_attempts >= 4 THEN now() + interval '15 minutes' ELSE NULL END
      WHERE id = ${user.id} RETURNING locked_until
    `;
    return { success: false, reason: failure?.locked_until ? "locked" : "invalid" };
  }
  if (role === "merchant" && (!user.business_id || !(await isBusinessActive(user.business_id)))) return { success: false, reason: "unavailable" };

  const jar = await cookies();
  const previousToken = jar.get(COOKIE)?.value;
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_HOURS * 60 * 60_000);
  await sql.begin(async (tx) => {
    await tx`UPDATE public.users SET failed_attempts = 0, locked_until = NULL WHERE id = ${user.id}`;
    await tx`INSERT INTO public.sessions (token_hash, user_id, expires_at) VALUES (${tokenHash(token)}, ${user.id}, ${expires.toISOString()})`;
    if (previousToken) {
      await tx`UPDATE public.login_events SET signed_out_at = COALESCE(signed_out_at, now()) WHERE session_token_hash = ${tokenHash(previousToken)}`;
      await tx`DELETE FROM public.sessions WHERE token_hash = ${tokenHash(previousToken)}`;
    }
    await tx`INSERT INTO public.login_events (user_id, username, role, session_token_hash, signed_in_at) VALUES (${user.id}, ${user.username}, ${user.role}, ${tokenHash(token)}, now())`;
  });
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
  return { success: true };
}

export async function getSession(): Promise<SessionUser | null> {
  if (!hasPostgresDatabase()) return sqliteAuth.getSession();
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const [row] = await getPostgres()<UserRow[]>`
    SELECT u.id, u.username, u.role, u.business_id,
      u.first_name, u.last_name, u.email, u.must_change_password, u.is_superuser
    FROM public.sessions s JOIN public.users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash(token)} AND s.expires_at > now()
  `;
  return row ? mapSession(row) : null;
}

export async function requireAdmin() {
  const session = await getSession();
  if (session?.role !== "admin") redirect("/admin/login");
  if (session.mustChangePassword) redirect("/admin/primer-acceso");
  return session;
}

export async function requireSuperAdmin() {
  const session = await requireAdmin();
  if (!session.isSuperuser) redirect("/admin/carreras");
  return session;
}

export async function requireMerchant() {
  const session = await getSession();
  if (session?.role !== "merchant" || !session.businessId || !(await isBusinessActive(session.businessId))) redirect("/comercio/login");
  return session;
}

export async function signOut() {
  if (!hasPostgresDatabase()) return sqliteAuth.signOut();
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await getPostgres()`UPDATE public.login_events SET signed_out_at = COALESCE(signed_out_at, now()) WHERE session_token_hash = ${tokenHash(token)}`;
    await getPostgres()`DELETE FROM public.sessions WHERE token_hash = ${tokenHash(token)}`;
  }
  jar.delete(COOKIE);
}

export type AdminAccountSummary = {
  id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  must_change_password: number;
  is_superuser: boolean;
};

export async function listAdminAccounts(): Promise<AdminAccountSummary[]> {
  if (!hasPostgresDatabase()) return sqliteAuth.listAdminAccounts();
  const rows = await getPostgres()<Array<Omit<AdminAccountSummary, "must_change_password" | "is_superuser"> & { must_change_password: boolean; is_superuser: boolean }>>`
    SELECT id, username, first_name, last_name, email, must_change_password, is_superuser
    FROM public.users WHERE role = 'admin'
    ORDER BY lower(first_name), lower(last_name), lower(username)
  `;
  return rows.map((row) => ({ ...row, id: Number(row.id), must_change_password: row.must_change_password ? 1 : 0, is_superuser: row.is_superuser }));
}

export async function createAdminAccount(firstName: string, lastName: string, email: string) {
  if (!hasPostgresDatabase()) return sqliteAuth.createAdminAccount(firstName, lastName, email);
  const cleanFirstName = firstName.trim();
  const cleanLastName = lastName.trim();
  const normalizedEmail = email.trim().toLowerCase();
  if (cleanFirstName.length < 2 || cleanFirstName.length > 80) throw new Error("Indica un nombre válido.");
  if (cleanLastName.length < 2 || cleanLastName.length > 100) throw new Error("Indica apellidos válidos.");
  if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error("Indica un correo electrónico válido.");
  const password = temporaryPassword();
  const hash = await passwordHash(password);
  try {
    await getPostgres()`
      INSERT INTO public.users (username, password_hash, role, first_name, last_name, email, must_change_password)
      VALUES (${normalizedEmail}, ${hash}, 'admin', ${cleanFirstName}, ${cleanLastName}, ${normalizedEmail}, true)
    `;
  } catch {
    throw new Error("No se pudo crear la cuenta. Comprueba que el correo no esté ya registrado.");
  }
  return { temporaryPassword: password };
}

export async function resetAdminPassword(targetUserId: number, actingAdminId: number) {
  if (!hasPostgresDatabase()) return sqliteAuth.resetAdminPassword(targetUserId, actingAdminId);
  if (!Number.isSafeInteger(targetUserId) || targetUserId <= 0 || targetUserId === actingAdminId) throw new Error("Selecciona otro administrador para restablecer su contraseña.");
  const password = temporaryPassword();
  const hash = await passwordHash(password);
  const sql = getPostgres();
  await sql.begin(async (tx) => {
    const [target] = await tx`SELECT id FROM public.users WHERE id = ${targetUserId} AND role = 'admin' FOR UPDATE`;
    if (!target) throw new Error("No se encontró ese administrador.");
    await tx`UPDATE public.users SET password_hash = ${hash}, must_change_password = true, failed_attempts = 0, locked_until = NULL WHERE id = ${targetUserId}`;
    await tx`DELETE FROM public.sessions WHERE user_id = ${targetUserId}`;
  });
  return { temporaryPassword: password };
}

export async function completeAdminPasswordSetup(password: string) {
  if (!hasPostgresDatabase()) return sqliteAuth.completeAdminPasswordSetup(password);
  const session = await getSession();
  if (!session || session.role !== "admin" || !session.mustChangePassword) throw new Error("Esta cuenta no necesita configurar una contraseña.");
  if (password.length < 12 || password.length > 200) throw new Error("La contraseña debe tener entre 12 y 200 caracteres.");
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) throw new Error("La sesión ha caducado. Inicia sesión de nuevo.");
  const hash = await passwordHash(password);
  await getPostgres().begin(async (tx) => {
    await tx`UPDATE public.users SET password_hash = ${hash}, must_change_password = false, failed_attempts = 0, locked_until = NULL WHERE id = ${session.id} AND role = 'admin'`;
    await tx`DELETE FROM public.sessions WHERE user_id = ${session.id} AND token_hash <> ${tokenHash(token)}`;
  });
}

export async function changeAdminPassword(currentPassword: string, newPassword: string) {
  if (!hasPostgresDatabase()) return sqliteAuth.changeAdminPassword(currentPassword, newPassword);
  const session = await getSession();
  if (!session || session.role !== "admin" || session.mustChangePassword) throw new Error("Inicia sesión para cambiar tu contraseña.");
  if (newPassword.length < 12 || newPassword.length > 200) throw new Error("La nueva contraseña debe tener entre 12 y 200 caracteres.");
  const [user] = await getPostgres()<Array<{ password_hash: string }>>`SELECT password_hash FROM public.users WHERE id = ${session.id} AND role = 'admin'`;
  if (!user || !(await passwordMatches(currentPassword, user.password_hash))) throw new Error("La contraseña actual no es correcta.");
  const hash = await passwordHash(newPassword);
  const token = (await cookies()).get(COOKIE)?.value;
  await getPostgres().begin(async (tx) => {
    await tx`UPDATE public.users SET password_hash = ${hash}, failed_attempts = 0, locked_until = NULL WHERE id = ${session.id} AND role = 'admin'`;
    if (token) await tx`DELETE FROM public.sessions WHERE user_id = ${session.id} AND token_hash <> ${tokenHash(token)}`;
  });
}

export async function listMerchantAccounts() {
  if (!hasPostgresDatabase()) return sqliteAuth.listMerchantAccounts();
  return getPostgres()<Array<{ username: string; business_id: string }>>`SELECT username, business_id FROM public.users WHERE role = 'merchant'`;
}

async function uniqueMerchantUsername(name: string, exceptUserId?: number) {
  const sql = getPostgres();
  const base = initialBusinessUsername(name);
  let username = base;
  let suffix = 2;
  while ((await sql`SELECT 1 FROM public.users WHERE lower(username) = lower(${username}) AND id <> ${exceptUserId ?? -1}`).length) username = `${base}-${suffix++}`;
  return username;
}

export async function syncMerchantUsername(businessId: string, name: string) {
  if (!hasPostgresDatabase()) return sqliteAuth.syncMerchantUsername(businessId, name);
  const sql = getPostgres();
  const accounts = await sql<Array<{ id: number; username: string }>>`SELECT id, username FROM public.users WHERE business_id = ${businessId} AND role = 'merchant'`;
  const renamed = await Promise.all(accounts.map(async (account) => ({
    ...account,
    nextUsername: await uniqueMerchantUsername(name, Number(account.id)),
  })));
  await sql.begin(async (tx) => {
    for (const account of renamed) {
      if (account.nextUsername !== account.username) {
        await tx`UPDATE public.users SET username = ${account.nextUsername}, failed_attempts = 0, locked_until = NULL WHERE id = ${account.id}`;
        await tx`DELETE FROM public.sessions WHERE user_id = ${account.id}`;
      }
    }
  });
}

export async function createBusinessWithMerchant(business: Omit<Business, "id">) {
  if (!hasPostgresDatabase()) return sqliteAuth.createBusinessWithMerchant(business);
  const id = await makeBusinessId(business.name);
  const username = await uniqueMerchantUsername(business.name);
  const password = temporaryPassword();
  const hash = await passwordHash(password);
  await getPostgres().begin(async (tx) => {
    await tx`
      INSERT INTO public.businesses (id, name, category, municipality, area, phone, address, lat, lng, opening_hours, description, image)
      VALUES (${id}, ${business.name}, ${business.category}, ${business.municipality}, ${business.area}, ${business.phone}, ${business.address}, ${business.lat}, ${business.lng}, ${business.openingHours}, ${business.description}, ${business.image})
    `;
    await tx`INSERT INTO public.users (username, password_hash, role, business_id) VALUES (${username}, ${hash}, 'merchant', ${id})`;
  });
  return { business: { ...business, id }, username, password };
}

export async function deleteBusinessAndAccess(businessId: string, actor?: { id: number; username: string }) {
  if (!hasPostgresDatabase()) return sqliteAuth.deleteBusinessAndAccess(businessId, actor);
  const sql = getPostgres();
  return sql.begin(async (tx) => {
    const [business] = await tx`SELECT id FROM public.businesses WHERE id = ${businessId} FOR UPDATE`;
    if (!business) throw new Error("No se encontró el comercio que quieres borrar.");
    const [coupons] = await tx`SELECT count(*)::int AS total FROM public.coupons WHERE business_id = ${businessId}`;
    await tx`DELETE FROM public.sessions WHERE user_id IN (SELECT id FROM public.users WHERE business_id = ${businessId} AND role = 'merchant')`;
    await tx`DELETE FROM public.users WHERE business_id = ${businessId} AND role = 'merchant'`;
        await tx`UPDATE public.businesses SET active = false, updated_at = now() WHERE id = ${businessId}`;
        await tx`INSERT INTO public.audit_events (actor_user_id, actor_username, action, entity_type, entity_id, details, created_at)
          VALUES (${actor?.id ?? null}, ${actor?.username ?? null}, 'delete_business', 'business', ${businessId}, ${`${Number(coupons.total)} bonos asociados; comercio archivado`}, now())`;
    return true;
  });
}

export async function restoreBusinessWithAccess(businessId: string) {
  if (!hasPostgresDatabase()) return sqliteAuth.restoreBusinessWithAccess(businessId);
  const business = await getBusinessRecord(businessId);
  if (!business || await isBusinessActive(businessId)) throw new Error("El comercio ya está activo o no existe.");
  const username = await uniqueMerchantUsername(business.name);
  const password = temporaryPassword();
  const hash = await passwordHash(password);
  await getPostgres().begin(async (tx) => {
    const [current] = await tx`SELECT active FROM public.businesses WHERE id = ${businessId} FOR UPDATE`;
    if (!current || current.active) throw new Error("El comercio ya está activo o no existe.");
    await tx`UPDATE public.businesses SET active = true, updated_at = now() WHERE id = ${businessId}`;
    await tx`INSERT INTO public.users (username, password_hash, role, business_id) VALUES (${username}, ${hash}, 'merchant', ${businessId})`;
  });
  return { businessName: business.name, username, password };
}

export async function provisionMerchant(businessId: string) {
  if (!hasPostgresDatabase()) return sqliteAuth.provisionMerchant(businessId);
  const business = await getBusinessRecord(businessId);
  if (!business || !(await isBusinessActive(businessId))) throw new Error("Comercio no disponible.");
  const password = temporaryPassword();
  const hash = await passwordHash(password);
  const sql = getPostgres();
  const [existingBefore] = await sql<Array<{ id: number }>>`SELECT id FROM public.users WHERE business_id = ${businessId} AND role = 'merchant'`;
  const username = await uniqueMerchantUsername(business.name, existingBefore ? Number(existingBefore.id) : undefined);
  await sql.begin(async (tx) => {
    const [existing] = await tx<Array<{ id: number }>>`SELECT id FROM public.users WHERE business_id = ${businessId} AND role = 'merchant' FOR UPDATE`;
    if (existing) {
      await tx`UPDATE public.users SET username = ${username}, password_hash = ${hash}, failed_attempts = 0, locked_until = NULL WHERE id = ${existing.id}`;
      await tx`DELETE FROM public.sessions WHERE user_id = ${existing.id}`;
    } else {
      await tx`INSERT INTO public.users (username, password_hash, role, business_id) VALUES (${username}, ${hash}, 'merchant', ${businessId})`;
    }
  });
  return { username, password };
}
