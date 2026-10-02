import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";

// Exercise the real auth functions with isolated database and Next request adapters.
// The PostgreSQL adapter translates the exercised SQL into this in-memory database;
// these tests never connect to Supabase or change a real account.
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const adapters = {
  "next/headers": moduleUrl("export async function cookies(){return globalThis.__authSessionFixture.jar}"),
  "next/navigation": moduleUrl("export function redirect(path){throw new Error('redirect:'+path)}"),
  "./postgres": moduleUrl("export function hasPostgresDatabase(){return true} export function getPostgres(){return globalThis.__authSessionFixture.sql}"),
  "./store": moduleUrl("export function isBusinessActive(id){return !!globalThis.__authSessionFixture.db.prepare('SELECT active FROM businesses WHERE id = ?').get(id)?.active} export function getBusinessRecord(){} export function makeBusinessId(){}"),
  "./store-sqlite": moduleUrl("export function getDatabase(){return globalThis.__authSessionFixture.db} export function demoWritesEnabled(){return true} export function isBusinessActive(id){return !!getDatabase().prepare('SELECT active FROM businesses WHERE id = ?').get(id)?.active} export function getBusinessRecord(){} export function makeBusinessId(){}"),
  "./business-credentials": moduleUrl("export function initialBusinessUsername(name){return name}"),
  "./auth-sqlite": moduleUrl("export {}"),
};

async function loadAuth(filename) {
  const source = ts.transpileModule(readFileSync(new URL(`../lib/${filename}.ts`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText.replace('import "server-only";', "").replace(/from "([^"]+)"/g, (original, name) => adapters[name] ? `from "${adapters[name]}"` : original);
  return import(moduleUrl(source));
}

function fixture(postgres) {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, password_hash TEXT, role TEXT, business_id TEXT, demo_business_id TEXT, first_name TEXT, last_name TEXT, email TEXT, must_change_password INTEGER DEFAULT 0, is_superuser INTEGER DEFAULT 0, failed_attempts INTEGER DEFAULT 0, locked_until TEXT, archived_at TEXT, archived_by INTEGER);
    CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER, expires_at TEXT);
    CREATE TABLE login_events (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, username TEXT, role TEXT, session_token_hash TEXT UNIQUE, signed_in_at TEXT, signed_out_at TEXT);
    CREATE TABLE businesses (id TEXT PRIMARY KEY, active INTEGER);
    INSERT INTO businesses VALUES ('mocanes', 1);`);
  const password = randomBytes(20).toString("hex");
  const salt = randomBytes(16).toString("hex");
  const hash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
  // Keep the legacy admin link in the fixture to ensure it cannot grant access.
  db.prepare("INSERT INTO users (id, username, password_hash, role, demo_business_id) VALUES (1, 'admin', ?, 'admin', 'mocanes')").run(hash);
  db.prepare("INSERT INTO users (id, username, password_hash, role, business_id) VALUES (2, 'tienda-los-mocanes', ?, 'merchant', 'mocanes')").run(hash);
  const values = new Map();
  const jar = { get: (name) => values.has(name) ? { value: values.get(name) } : undefined, set: (name, value) => values.set(name, value), delete: (name) => values.delete(name) };
  const sql = async (strings, ...parameters) => {
    const query = strings.join("?").replaceAll("public.", "").replaceAll("now() + interval '15 minutes'", `'${new Date(Date.now() + 900000).toISOString()}'`).replaceAll("now()", `'${new Date().toISOString()}'`);
    const statement = db.prepare(query);
    if (/^\s*SELECT/i.test(query) || /RETURNING/i.test(query)) return statement.all(...parameters).map(row => postgres && "must_change_password" in row ? { ...row, must_change_password: !!row.must_change_password } : row);
    statement.run(...parameters);
    return [];
  };
  sql.begin = async (operation) => {
    db.exec("BEGIN IMMEDIATE");
    try { const result = await operation(sql); db.exec("COMMIT"); return result; }
    catch (error) { db.exec("ROLLBACK"); throw error; }
  };
  return { db, jar, sql, password };
}

for (const backend of ["auth-sqlite", "auth"]) {
  const auth = await loadAuth(backend);
  test(`${backend}: five concurrent password failures lock the account`, async () => {
    const state = fixture(backend === "auth");
    globalThis.__authSessionFixture = state;
    try {
      const results = await Promise.all(Array.from({ length: 5 }, () => auth.signInDetailed("tienda-los-mocanes", "wrong-password", "merchant")));
      assert.ok(results.every(result => !result.success));
      const row = state.db.prepare("SELECT locked_until FROM users WHERE id = 2").get();
      assert.ok(new Date(row.locked_until).getTime() > Date.now());
      assert.deepEqual(await auth.signInDetailed("tienda-los-mocanes", state.password, "merchant"), { success: false, reason: "locked" });
      assert.equal(state.db.prepare("SELECT count(*) AS total FROM sessions").get().total, 0);
    } finally { state.db.close(); }
  });
  test(`${backend}: admin and merchant logins are exclusive and enforce roles`, async () => {
    const state = fixture(backend === "auth");
    globalThis.__authSessionFixture = state;
    try {
      assert.equal(await auth.signIn("admin", state.password, "merchant"), false);
      assert.equal(await auth.signIn("tienda-los-mocanes", state.password, "admin"), false);
      assert.equal(await auth.signIn("admin", state.password, "admin"), true);
      const adminToken = state.jar.get("bonos_session").value;
      assert.equal((await auth.getSession()).businessId, null);
      await assert.rejects(auth.requireMerchant(), /redirect:\/comercio\/login/);
      assert.equal((await auth.requireAdmin()).role, "admin");

      // A failed switch must leave the currently authenticated session intact.
      assert.equal(await auth.signIn("admin", state.password, "merchant"), false);
      assert.equal(state.jar.get("bonos_session").value, adminToken);

      assert.equal(await auth.signIn("tienda-los-mocanes", state.password, "merchant"), true);
      const merchantToken = state.jar.get("bonos_session").value;
      assert.notEqual(merchantToken, adminToken);
      assert.equal((await auth.requireMerchant()).businessId, "mocanes");
      await assert.rejects(auth.requireAdmin(), /redirect:\/admin\/login/);
      state.jar.set("bonos_session", adminToken);
      assert.equal(await auth.getSession(), null, "old admin token is revoked in the database");
      state.jar.set("bonos_session", merchantToken);

      assert.equal(await auth.signIn("admin", state.password, "admin"), true);
      const newAdminToken = state.jar.get("bonos_session").value;
      assert.equal((await auth.getSession()).role, "admin");
      state.jar.set("bonos_session", merchantToken);
      assert.equal(await auth.getSession(), null, "old merchant token is revoked in the database");
      state.jar.set("bonos_session", newAdminToken);
      assert.equal(state.db.prepare("SELECT count(*) AS total FROM sessions").get().total, 1);
      await auth.signOut();
      assert.equal(await auth.getSession(), null);
      assert.equal(state.db.prepare("SELECT count(*) AS total FROM sessions").get().total, 0);
    } finally { state.db.close(); }
  });

  test(`${backend}: inactive stores cannot replace an admin session`, async () => {
    const state = fixture(backend === "auth");
    globalThis.__authSessionFixture = state;
    try {
      await auth.signIn("admin", state.password, "admin");
      const token = state.jar.get("bonos_session").value;
      state.db.exec("UPDATE businesses SET active = 0");
      assert.equal(await auth.signIn("tienda-los-mocanes", state.password, "merchant"), false);
      assert.equal(state.jar.get("bonos_session").value, token);
      assert.equal((await auth.getSession()).role, "admin");
    } finally { state.db.close(); }
  });

  test(`${backend}: archived merchant accounts keep their history but cannot sign in`, async () => {
    const state = fixture(backend === "auth");
    globalThis.__authSessionFixture = state;
    try {
      state.db.exec("UPDATE users SET archived_at = '2026-10-02T00:00:00.000Z', archived_by = 1 WHERE id = 2");
      assert.deepEqual(await auth.signInDetailed("tienda-los-mocanes", state.password, "merchant"), { success: false, reason: "invalid" });
      assert.equal(state.db.prepare("SELECT count(*) AS total FROM users WHERE id = 2").get().total, 1);
      assert.equal(state.db.prepare("SELECT archived_at FROM users WHERE id = 2").get().archived_at, "2026-10-02T00:00:00.000Z");
    } finally { state.db.close(); }
  });

  test(`${backend}: failed session creation rolls back without logging out the current account`, async () => {
    const state = fixture(backend === "auth");
    globalThis.__authSessionFixture = state;
    try {
      await auth.signIn("admin", state.password, "admin");
      const token = state.jar.get("bonos_session").value;
      state.db.exec("CREATE TRIGGER reject_session BEFORE INSERT ON sessions BEGIN SELECT RAISE(ABORT, 'session insert failed'); END;");
      await assert.rejects(auth.signIn("tienda-los-mocanes", state.password, "merchant"), /session insert failed/);
      assert.equal(state.jar.get("bonos_session").value, token);
      assert.equal((await auth.getSession()).role, "admin");
      assert.equal(state.db.prepare("SELECT count(*) AS total FROM sessions").get().total, 1);
    } finally { state.db.close(); }
  });

  test(`${backend}: admins still have to complete first access and never inherit store access`, async () => {
    const state = fixture(backend === "auth");
    globalThis.__authSessionFixture = state;
    try {
      state.db.exec("UPDATE users SET must_change_password = 1 WHERE role = 'admin'");
      await auth.signIn("admin", state.password, "admin");
      assert.equal((await auth.getSession()).mustChangePassword, true);
      await assert.rejects(auth.requireAdmin(), /redirect:\/admin\/primer-acceso/);
      await assert.rejects(auth.requireMerchant(), /redirect:\/comercio\/login/);
    } finally { state.db.close(); }
  });
}
