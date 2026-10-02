import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_MS = 5 * 60 * 1000;

function signingKey() {
  return process.env.COUPON_LOOKUP_HMAC_KEY ?? "";
}

export function createPrintToken(raceId: string, mode: string) {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${raceId}|${mode}|${expiresAt}`;
  const signature = createHmac("sha256", signingKey()).update(payload).digest("hex");
  return Buffer.from(`${payload}|${signature}`).toString("base64url");
}

export function verifyPrintToken(token: string | null, raceId: string, mode: string) {
  if (!token || !signingKey()) return false;
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [tokenRaceId, tokenMode, expiresAtText, signature] = decoded.split("|");
    if (!tokenRaceId || !tokenMode || !expiresAtText || !signature || tokenRaceId !== raceId || tokenMode !== mode) return false;
    const expiresAt = Number(expiresAtText);
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
    const payload = `${tokenRaceId}|${tokenMode}|${expiresAtText}`;
    const expected = createHmac("sha256", signingKey()).update(payload).digest("hex");
    const actualBuffer = Buffer.from(signature, "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");
    return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
  } catch {
    return false;
  }
}
