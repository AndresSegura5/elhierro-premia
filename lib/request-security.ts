import { createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";

const localSecret = randomBytes(32);

export function trustedClientAddress(headers: Pick<Headers, "get">, onVercel = process.env.VERCEL === "1") {
  // Vercel overwrites X-Forwarded-For; client-supplied alternative headers
  // must not select a different rate bucket.
  if (!onVercel) return "local";
  const address = headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  if (address.length > 64 || !isIP(address)) return "unknown";
  if (isIP(address) === 4) return address;
  // Group IPv6 privacy addresses by network, rather than allowing a new quota
  // for every address an automated client can rotate within its /64.
  const canonical = new URL(`http://[${address}]`).hostname.slice(1, -1);
  const [left, right] = canonical.split("::");
  const first = left ? left.split(":") : [];
  const last = right ? right.split(":") : [];
  const parts = right !== undefined ? [...first, ...Array(8 - first.length - last.length).fill("0"), ...last] : first;
  if (parts.slice(0, 5).every(part => part === "0") && parts[5] === "ffff") {
    const a = parseInt(parts[6], 16), b = parseInt(parts[7], 16);
    return `${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`;
  }
  return `${parts.slice(0, 4).join(":")}::/64`;
}

export function securityIdentifier(value: string) {
  const secret = process.env.COUPON_LOOKUP_HMAC_KEY;
  if (process.env.NODE_ENV === "production" && !secret) throw new Error("Falta configurar COUPON_LOOKUP_HMAC_KEY.");
  return createHmac("sha256", secret ?? localSecret).update(value).digest("hex");
}

export function isSameOriginMutation(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  try { return new URL(request.headers.get("origin") ?? "").origin === new URL(request.url).origin; }
  catch { return false; }
}

export function validIdempotencyKey(key: string | null): key is string {
  return key !== null && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key);
}
