import "server-only";
import { getPostgres, hasPostgresDatabase } from "./postgres";
import { securityIdentifier, trustedClientAddress } from "./request-security";

type Bucket = { count: number; started: number };
const globalState = globalThis as typeof globalThis & { __requestLimitBuckets?: Map<string, Bucket> };
const localBuckets = globalState.__requestLimitBuckets ??= new Map<string, Bucket>();

export async function consumeRequestLimit(scope: string, identifier: string, maximum: number, windowSeconds: number, now = Date.now()) {
  const key = securityIdentifier(identifier);
  if (hasPostgresDatabase()) {
    const [row] = await getPostgres()<Array<{ allowed: boolean; retry_after_seconds: number }>>`
      SELECT * FROM public.consume_request_limit(${scope}, ${key}, ${maximum}, ${windowSeconds})
    `;
    return { allowed: row?.allowed === true, retryAfterSeconds: Number(row?.retry_after_seconds ?? windowSeconds) };
  }
  const mapKey = `${scope}:${key}`;
  const windowMs = windowSeconds * 1000;
  const previous = localBuckets.get(mapKey);
  const bucket = previous && now < previous.started + windowMs ? previous : { count: 0, started: now };
  bucket.count = Math.min(maximum + 1, bucket.count + 1);
  localBuckets.set(mapKey, bucket);
  if (localBuckets.size > 20_000) {
    for (const [storedKey, stored] of localBuckets) if (now - stored.started >= 3_600_000) localBuckets.delete(storedKey);
    if (localBuckets.size > 20_000) { localBuckets.delete(mapKey); return { allowed: false, retryAfterSeconds: windowSeconds }; }
  }
  return { allowed: bucket.count <= maximum, retryAfterSeconds: bucket.count <= maximum ? 0 : Math.max(1, Math.ceil((bucket.started + windowMs - now) / 1000)) };
}

export async function consumeLoginAttempt(headers: Pick<Headers, "get">, username: string, role: string) {
  const ipLimit = await consumeRequestLimit("login-ip", trustedClientAddress(headers), 20, 900);
  if (!ipLimit.allowed) return ipLimit;
  return consumeRequestLimit("login-account", `${role}:${username.trim().toLowerCase().slice(0, 254)}`, 10, 900);
}
