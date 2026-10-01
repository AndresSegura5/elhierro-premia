import "server-only";
import { consumeRequestLimit } from "./request-limit";
import { trustedClientAddress } from "./request-security";

export function consumePublicCouponLookup(headers: Pick<Headers, "get">, now = Date.now()) {
  return consumeRequestLimit("coupon-public", trustedClientAddress(headers), 10, 900, now);
}

export function consumeAuthenticatedCouponLookup(userId: number) {
  return consumeRequestLimit("coupon-user", String(userId), 60, 60);
}
