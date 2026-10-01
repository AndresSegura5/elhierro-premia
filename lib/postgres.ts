import "server-only";

import postgres, { type Sql } from "postgres";

let client: Sql | undefined;

export function hasPostgresDatabase() {
  if (!process.env.DATABASE_URL && process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL debe configurarse antes de ejecutar la aplicación en producción.");
  }
  return Boolean(process.env.DATABASE_URL);
}

export function getPostgres() {
  if (!process.env.DATABASE_URL) throw new Error("Falta configurar DATABASE_URL para conectar Supabase.");
  if (!client) {
    client = postgres(process.env.DATABASE_URL, {
      ssl: "require",
      max: 1,
      prepare: false,
      connect_timeout: 10,
      idle_timeout: 20,
    });
  }
  return client;
}
