import { randomBytes, scryptSync } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { access, mkdir, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import postgres from "postgres";
import { businessCategories } from "../lib/business-categories.ts";
import { couponRules, raceDefaults, siteContentDefaults } from "../lib/data.ts";

const target = process.env.DATA_MIGRATION_TARGET;
if (target !== "preview" && target !== "production") {
  throw new Error("Define DATA_MIGRATION_TARGET como preview o production.");
}
if (target === "production" && process.env.CONFIRM_PRODUCTION_DATA_IMPORT !== "yes") {
  throw new Error("Para producción define CONFIRM_PRODUCTION_DATA_IMPORT=yes y revisa antes que el proyecto sea el correcto.");
}
if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL.");
if (!process.env.SUPABASE_PROJECT_REF) throw new Error("Indica SUPABASE_PROJECT_REF para registrar el destino.");

const sqlitePath = process.env.BONOS_DB_PATH ?? resolve(process.cwd(), ".data", "bonos.sqlite");
const credentialPath = resolve(process.cwd(), ".data", `supabase-${target}-initial-credentials.txt`);
const pendingCredentialPath = `${credentialPath}.pending`;
const source = new DatabaseSync(sqlitePath, { readOnly: true });
const db = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1, prepare: false, connect_timeout: 10, idle_timeout: 20 });

function temporaryPassword() {
  return randomBytes(24).toString("base64url");
}

function passwordHash(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt}:${hash.toString("hex")}`;
}

let credentials = [];
try {
  source.exec("BEGIN");
  const races = source.prepare("SELECT id, coupon_quantity, start_date, validity_days FROM races ORDER BY id").all();
  const businesses = source.prepare("SELECT * FROM businesses ORDER BY id").all();
  const users = source.prepare(`
    SELECT id, username, password_hash, role, business_id, demo_business_id,
      first_name, last_name, email, must_change_password
    FROM users ORDER BY id
  `).all();
  source.exec("COMMIT");

  if (!races.length || !businesses.length || !users.length) throw new Error("La base local no contiene carreras, comercios y cuentas para importar.");
  const metadataByRace = new Map(raceDefaults.map((race) => [race.id, race]));
  for (const race of races) {
    if (!metadataByRace.has(race.id)) throw new Error(`Faltan los metadatos iniciales de la carrera ${race.id}.`);
  }
  const categories = [...new Set([...businessCategories, ...businesses.map((business) => business.category)])];
  const preparedUsers = users.map((user) => {
    const password = temporaryPassword();
    credentials.push({ role: user.role, username: user.username, email: user.email, password });
    return {
      ...user,
      password_hash: passwordHash(password),
      must_change_password: user.role === "admin" ? true : false,
      failed_attempts: 0,
      locked_until: null,
    };
  });

  const counts = await db`
    SELECT
      (SELECT count(*)::int FROM public.business_categories) AS categories,
      (SELECT count(*)::int FROM public.races) AS races,
      (SELECT count(*)::int FROM public.site_content) AS site_content,
      (SELECT count(*)::int FROM public.coupon_rules) AS rules,
      (SELECT count(*)::int FROM public.businesses) AS businesses,
      (SELECT count(*)::int FROM public.users) AS users,
      (SELECT count(*)::int FROM public.sessions) AS sessions,
      (SELECT count(*)::int FROM public.coupons) AS coupons,
      (SELECT count(*)::int FROM public.redemptions) AS redemptions
  `;
  if (Object.values(counts[0]).some((count) => Number(count) !== 0)) {
    throw new Error("El proyecto Supabase no está vacío. No se ha importado ni reemplazado ningún dato.");
  }

  const credentialText = [
    `Proyecto Supabase: ${process.env.SUPABASE_PROJECT_REF}`,
    `Destino: ${target}`,
    "Contraseñas temporales generadas para la primera entrada. No compartir este fichero ni incluirlo en Git.",
    "Cada administrador deberá crear su contraseña al iniciar sesión.",
    "Las 400 emisiones locales, sus canjes y todas las sesiones se han omitido.",
    "",
    ...credentials.flatMap((entry) => [
      `${entry.role === "admin" ? "ADMINISTRADOR" : "COMERCIO"}: ${entry.username}${entry.email ? ` (${entry.email})` : ""}`,
      `Contraseña: ${entry.password}`,
      "",
    ]),
  ].join("\n");
  await mkdir(resolve(process.cwd(), ".data"), { recursive: true });
  await writeFile(pendingCredentialPath, credentialText, { encoding: "utf8", mode: 0o600, flag: "wx" });

  await db.begin(async (tx) => {
    for (const [index, name] of categories.entries()) {
      await tx`INSERT INTO public.business_categories (name, sort_order) VALUES (${name}, ${index})`;
    }
    for (const [key, content] of Object.entries(siteContentDefaults)) {
      await tx`INSERT INTO public.site_content (content_key, content) VALUES (${key}, ${tx.json(content)})`;
    }
    for (const row of races) {
      const metadata = metadataByRace.get(row.id);
      await tx`
        INSERT INTO public.races (
          id, name, short_name, coupon_quantity, start_date, validity_days, color,
          description, logo_path, card_image_path, card_image_position
        ) VALUES (
          ${row.id}, ${metadata.name}, ${metadata.shortName}, ${row.coupon_quantity}, ${row.start_date}, ${row.validity_days}, ${metadata.color},
          ${metadata.description ?? ""}, ${metadata.logoPath ?? null}, ${metadata.cardImagePath ?? null}, ${metadata.cardImagePosition ?? "center"}
        )
      `;
    }
    for (const rule of couponRules) {
      await tx`INSERT INTO public.coupon_rules (body, sort_order) VALUES (${rule}, ${couponRules.indexOf(rule)})`;
    }
    for (const business of businesses) {
      await tx`
        INSERT INTO public.businesses (
          id, name, category, municipality, area, phone, address, lat, lng,
          opening_hours, description, image, active
        ) VALUES (
          ${business.id}, ${business.name}, ${business.category}, ${business.municipality}, ${business.area},
          ${business.phone}, ${business.address}, ${business.lat}, ${business.lng}, ${business.opening_hours},
          ${business.description}, ${business.image}, ${business.active === 1}
        )
      `;
    }
    for (const user of preparedUsers) {
      await tx`
        INSERT INTO public.users (
          id, username, password_hash, role, business_id, demo_business_id,
          failed_attempts, locked_until, first_name, last_name, email, must_change_password
        ) VALUES (
          ${user.id}, ${user.username}, ${user.password_hash}, ${user.role}, ${user.business_id}, ${user.demo_business_id},
          0, NULL, ${user.first_name}, ${user.last_name}, ${user.email}, ${user.must_change_password}
        )
      `;
    }
    await tx`SELECT setval(pg_get_serial_sequence('public.users', 'id'), (SELECT max(id) FROM public.users), true)`;
  });

  await rename(pendingCredentialPath, credentialPath);
  console.log(`Importación ${target} completada: ${races.length} carreras, ${businesses.length} comercios, ${users.length} cuentas, ${couponRules.length} condiciones; 0 bonos, 0 canjes, 0 sesiones.`);
  console.log(`Credenciales temporales guardadas en ${credentialPath}. El fichero queda excluido de Git.`);
} catch (error) {
  try {
    await access(pendingCredentialPath);
    console.error(`La importación no se confirmó. No uses las claves temporales; el fichero pendiente está en ${pendingCredentialPath}.`);
  } catch {
    // No credential file was created, so there is nothing to retrieve.
  }
  throw error;
} finally {
  source.close();
  await db.end({ timeout: 5 });
}
