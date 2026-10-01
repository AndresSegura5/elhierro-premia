export function normalizeCouponCode(value: string) {
  const urlCode = value.match(/\/bono\/([^/?#]+)/i)?.[1];
  try {
    return decodeURIComponent(urlCode ?? value).trim().toUpperCase();
  } catch {
    return value.trim().toUpperCase();
  }
}

export function isValidCouponCode(code: string) {
  return /^EH-(BES|BIM|MER)-([A-HJ-KM-NP-Z][1-9][A-HJ-KM-NP-Z][1-9]{3}[A-HJ-KM-NP-Z]|[A-HJ-KM-NP-Z1-9]{12})$/.test(code);
}

export function couponCodeFromQr(value: string) {
  const code = normalizeCouponCode(value);
  return isValidCouponCode(code) ? code : null;
}
