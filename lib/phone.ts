export function localPhoneNumber(phone: string) {
  const value = phone.trim().replace(/^(?:\+34|0034)[\s().-]*/i, "");
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("34") ? digits.slice(2) : digits;
}

export function phoneLink(phone: string) {
  return `tel:${localPhoneNumber(phone).replace(/\D/g, "")}`;
}
