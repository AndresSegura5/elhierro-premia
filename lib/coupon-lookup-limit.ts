import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { getPostgres, hasPostgresDatabase } from "./postgres";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_LOOKUPS = 10;
const MAX_TRACKED_CLIENTS = 20_000;

type LookupState = { attempts: number[] };
type LookupGlobal = typeof globalThis & {
  __couponLookupAttempts?: Map<string, LookupState>;
  __couponLookupCleanupCount?: number;
  __couponLookupHashKey?: Buffer;
};

const sharedGlobal = globalThis as LookupGlobal;
const attemptsByClient = sharedGlobal.__couponLookupAttempts ??= new Map<string, LookupState>();
const hashKey = sharedGlobal.__couponLookupHashKey ??= randomBytes(32);

function clientKey(headers: Pick<Headers, "get">) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = headers.get("x-real-ip")?.trim()
    || headers.get("cf-connecting-ip")?.trim()
    || forwarded
    || "unknown";
  const secret = process.env.COUPON_LOOKUP_HMAC_KEY;
  if (process.env.NODE_ENV === "production" && !secret) throw new Error("Falta configurar COUPON_LOOKUP_HMAC_KEY.");
  return createHmac("sha256", secret ?? hashKey).update(address).digest("hex");
}

function cleanExpiredAttempts(now: number) {
  const calls = (sharedGlobal.__couponLookupCleanupCount ?? 0) + 1;
  sharedGlobal.__couponLookupCleanupCount = calls;
  if (calls % 128 !== 0 && attemptsByClient.size <= MAX_TRACKED_CLIENTS) return;

  for (const [key, state] of attemptsByClient) {
    state.attempts = state.attempts.filter((attemptAt) => now - attemptAt < WINDOW_MS);
    if (!state.attempts.length) attemptsByClient.delete(key);
  }
  while (attemptsByClient.size > MAX_TRACKED_CLIENTS) {
    const oldestKey = attemptsByClient.keys().next().value;
    if (!oldestKey) break;
    attemptsByClient.delete(oldestKey);
  }
}

export async function consumePublicCouponLookup(headers: Pick<Headers, "get">, now = Date.now()) {
  const key = clientKey(headers);
  if (hasPostgresDatabase()) {
    const [row] = await getPostgres()<Array<{ allowed: boolean; retry_after_seconds: number }>>`
      SELECT * FROM public.consume_coupon_lookup(${key}, ${new Date(now).toISOString()})
    `;
    return { allowed: row?.allowed === true, retryAfterSeconds: Number(row?.retry_after_seconds ?? 1) };
  }
  cleanExpiredAttempts(now);
  const current = attemptsByClient.get(key)?.attempts.filter((attemptAt) => now - attemptAt < WINDOW_MS) ?? [];

  if (current.length >= MAX_LOOKUPS) {
    attemptsByClient.set(key, { attempts: current });
    const retryAfterSeconds = Math.max(1, Math.ceil((current[0] + WINDOW_MS - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  current.push(now);
  attemptsByClient.set(key, { attempts: current });
  return { allowed: true, retryAfterSeconds: 0 };
}
