export function normalizeCouponCode(value: string) {
  const urlCode = value.match(/\/bono\/([^/?#]+)/i)?.[1];
  try {
    return decodeURIComponent(urlCode ?? value).trim().toUpperCase();
  } catch {
    return value.trim().toUpperCase();
  }
}

export function couponCodeFromQr(value: string) {
  const code = normalizeCouponCode(value);
  return code.length <= 128 && /^EH-[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(code) ? code : null;
}
