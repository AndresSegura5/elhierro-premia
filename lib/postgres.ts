import "server-only";

import postgres from "postgres";
import { serializePostgres } from "./serialized-postgres";

let client: ReturnType<typeof serializePostgres> | undefined;

export function hasPostgresDatabase() {
  if (!process.env.DATABASE_URL && process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL debe configurarse antes de ejecutar la aplicación en producción.");
  }
  return Boolean(process.env.DATABASE_URL);
}

export function getPostgres() {
  if (!process.env.DATABASE_URL) throw new Error("Falta configurar DATABASE_URL para conectar Supabase.");
  if (!client) {
    client = serializePostgres(postgres(process.env.DATABASE_URL, {
      ssl: "require",
      max: 1,
      prepare: false,
      connect_timeout: 10,
      idle_timeout: 20,
    }));
  }
  return client;
}
