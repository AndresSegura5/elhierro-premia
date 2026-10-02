export type Municipality = "Valverde" | "La Frontera" | "El Pinar";

export type Race = {
  id: string;
  name: string;
  shortName: string;
  couponQuantity: number;
  startDate: string;
  validityDays: number;
  color: string;
  description?: string;
  logoPath?: string;
  cardImagePath?: string;
  cardImagePosition?: string;
};

export type Business = {
  id: string;
  name: string;
  category: string;
  municipality: Municipality;
  area: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  openingHours: string;
  description: string;
  image: string;
};

export type ManagedBusiness = { business: Business; isActive: boolean };

export type CouponStatus = "not-started" | "available" | "partial" | "redeemed" | "expired";

export type Coupon = {
  code: string;
  raceId: string;
  businessId: string;
  amountCents: number;
  usedCents: number;
  startDate: string;
  expiresAt: string;
  status: CouponStatus;
  deletedAt?: string;
  deletedBy?: number;
};

export type Redemption = {
  id: number;
  code: string;
  businessId: string;
  amountCents: number;
  balanceAfterCents: number;
  createdAt: string;
};

export type CouponAuditRecord = {
  code: string;
  raceId: string;
  raceName: string;
  businessId: string;
  businessName: string;
  amountCents: number;
  usedCents: number;
  deletedAt: string | null;
  deletedByUsername: string | null;
};

export type LoginAuditRecord = {
  id: number;
  userId: number;
  username: string;
  role: string;
  signedInAt: string;
  signedOutAt: string | null;
};

export type AuditEventRecord = {
  id: number;
  actorUsername: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: string;
  createdAt: string;
};
