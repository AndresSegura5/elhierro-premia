import type { CouponStatus } from "./types";

export const BONO_CENTS = 3000;

export function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function todayInCanary(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Atlantic/Canary",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function couponStatus(startDate: string, validityDays: number, amountCents: number, usedCents: number, today = todayInCanary()): CouponStatus {
  if (usedCents >= amountCents) return "redeemed";
  if (today < startDate) return "not-started";
  if (today > addDays(startDate, validityDays)) return "expired";
  return usedCents > 0 ? "partial" : "available";
}

export function parseEuros(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [euros, cents = ""] = normalized.split(".");
  const amount = Number(euros) * 100 + Number(cents.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export function formatEuros(cents: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${date}T00:00:00Z`));
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: "Atlantic/Canary" }).format(new Date(iso));
}
