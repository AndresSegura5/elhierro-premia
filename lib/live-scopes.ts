// Ámbitos de la actualización en vivo. Un ámbito identifica "qué ha cambiado", nunca contiene datos.
export const LIVE_MAX_SCOPES = 8;

export const liveScope = {
  admin: "admin",
  public: "public",
  merchants: "merchants",
  business: (id: string) => `business:${id}`,
  coupon: (code: string) => `coupon:${code.trim().toUpperCase()}`,
  race: (id: string) => `race:${id}`,
};

export type ParsedLiveScope =
  | { kind: "admin" }
  | { kind: "public" }
  | { kind: "merchants" }
  | { kind: "business"; id: string }
  | { kind: "coupon"; code: string }
  | { kind: "race"; id: string };

export type LiveViewer = { role: "admin" } | { role: "merchant"; businessId: string } | null;

export function parseLiveScope(value: string): ParsedLiveScope | null {
  if (value === "admin" || value === "public" || value === "merchants") return { kind: value };
  const separator = value.indexOf(":");
  if (separator < 1) return null;
  const kind = value.slice(0, separator);
  const rest = value.slice(separator + 1);
  if ((kind === "business" || kind === "race") && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rest) && rest.length <= 80) return { kind, id: rest };
  // Forma básica; quien consulta valida además el código completo con isValidCouponCode.
  if (kind === "coupon" && /^EH-(?:BES|BIM|MER)-[A-Z0-9]{7,12}$/.test(rest)) return { kind, code: rest };
  return null;
}

export function canSeeLiveScope(scope: ParsedLiveScope, viewer: LiveViewer) {
  switch (scope.kind) {
    case "public":
    case "race":
    case "coupon":
      return true;
    case "admin":
      return viewer?.role === "admin";
    case "merchants":
      return viewer !== null;
    case "business":
      return viewer?.role === "admin" || (viewer?.role === "merchant" && viewer.businessId === scope.id);
  }
}

export function needsSession(scope: ParsedLiveScope) {
  return scope.kind === "admin" || scope.kind === "merchants" || scope.kind === "business";
}
