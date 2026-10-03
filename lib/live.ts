import "server-only";

import { getPostgres, hasPostgresDatabase } from "./postgres";
import { securityIdentifier } from "./request-security";
import { parseLiveScope } from "./live-scopes";

// Ejecutor de SQL: el cliente normal o la transacción en curso.
type LiveExecutor = ((strings: TemplateStringsArray, ...values: any[]) => PromiseLike<unknown>) & {
  savepoint?: <T>(operation: (sql: any) => Promise<T>) => Promise<T>;
};

const globalState = globalThis as typeof globalThis & { __liveVersions?: Map<string, number>; __liveCounter?: number };
const memoryVersions = globalState.__liveVersions ??= new Map<string, number>();

// El nombre del canal de Realtime se deriva con un secreto del servidor: solo lo conocen
// las pantallas a las que el servidor se lo entrega. Los avisos no llevan datos.
export function liveTopic(scope: string) {
  return `live-${securityIdentifier(`live:${scope}`).slice(0, 32)}`;
}

export function realtimeEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function validScopes(scopes: string[]) {
  return [...new Set(scopes)].filter((scope) => parseLiveScope(scope) !== null).slice(0, 20);
}

// Anota un cambio en los ámbitos indicados y avisa a las pantallas abiertas.
// Con "executor" (la transacción del cambio) el evento se confirma o se descarta junto con el cambio.
// Un fallo del aviso nunca debe romper la operación principal.
export async function publishLive(scopes: string[], executor?: LiveExecutor) {
  const targets = validScopes(scopes);
  if (!targets.length) return;
  if (!hasPostgresDatabase()) {
    for (const scope of targets) memoryVersions.set(scope, (globalState.__liveCounter = (globalState.__liveCounter ?? 0) + 1));
    return;
  }
  // El parámetro pasa por ::text porque postgres.js codifica de nuevo cualquier cadena que se castee directamente a jsonb.
  const scopesJson = JSON.stringify(targets);
  // Solo se envía el aviso instantáneo si las pantallas pueden recibirlo (claves públicas configuradas);
  // sin ellas basta con el sondeo y se evita ensuciar el registro de la base de datos.
  const topicsJson = JSON.stringify(realtimeEnabled() ? targets.map(liveTopic) : []);
  const run = (sql: LiveExecutor) => sql`SELECT public.live_publish(
    array(SELECT jsonb_array_elements_text((${scopesJson}::text)::jsonb)),
    array(SELECT jsonb_array_elements_text((${topicsJson}::text)::jsonb))
  )`;
  try {
    if (executor?.savepoint) await executor.savepoint(async (sp) => { await run(sp); });
    else await run(executor ?? (getPostgres() as unknown as LiveExecutor));
  } catch (error) {
    console.error("No se pudo publicar la actualización en vivo", error instanceof Error ? error.message : error);
  }
}

// Última versión de cada ámbito (0 si todavía no ha habido cambios).
export async function getLiveVersions(scopes: string[]): Promise<Record<string, number>> {
  const targets = validScopes(scopes);
  const versions: Record<string, number> = Object.fromEntries(targets.map((scope) => [scope, 0]));
  if (!targets.length) return versions;
  if (!hasPostgresDatabase()) {
    for (const scope of targets) versions[scope] = memoryVersions.get(scope) ?? 0;
    return versions;
  }
  const rows = await getPostgres()<Array<{ scope: string; version: string }>>`
    SELECT scope, max(id)::text AS version
    FROM public.live_events
    WHERE scope IN (SELECT jsonb_array_elements_text((${JSON.stringify(targets)}::text)::jsonb))
    GROUP BY scope
  `;
  for (const row of rows) versions[row.scope] = Number(row.version);
  return versions;
}

export type LiveProps = {
  scopes: string[];
  topics: string[];
  versions: Record<string, number>;
};

// Datos que se entregan a la pantalla. Debe llamarse ANTES de leer los datos de la página,
// para que cualquier cambio posterior se detecte como más reciente que esta versión.
export async function getLiveProps(scopes: string[]): Promise<LiveProps> {
  const targets = validScopes(scopes);
  let versions: Record<string, number> = {};
  try {
    versions = await getLiveVersions(targets);
  } catch (error) {
    console.error("No se pudieron leer las versiones en vivo", error instanceof Error ? error.message : error);
  }
  return { scopes: targets, topics: targets.map(liveTopic), versions };
}
