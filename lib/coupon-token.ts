import { randomInt } from "node:crypto";

const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ123456789";

export function generateCouponCode(prefix: string) {
  return `EH-${prefix}-${Array.from({ length: 12 }, () => alphabet[randomInt(alphabet.length)]).join("")}`;
}
