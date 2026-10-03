import type { CouponStatus } from "./types";

export const BONO_CENTS = 3000;

export function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

// Vigencia: desde las 00:01 del primer día hasta las 23:59 (inclusive) del último, hora de Canarias.
export const VALIDITY_OPENS_AT_MINUTE = 1;
const VALIDITY_CLOSES_AT_MINUTE = 23 * 60 + 59;

function clockLabel(minuteOfDay: number) {
  return `${String(Math.floor(minuteOfDay / 60)).padStart(2, "0")}:${String(minuteOfDay % 60).padStart(2, "0")}`;
}

export const VALIDITY_OPENS_LABEL = clockLabel(VALIDITY_OPENS_AT_MINUTE);
export const VALIDITY_CLOSES_LABEL = clockLabel(VALIDITY_CLOSES_AT_MINUTE);
export const VALIDITY_WINDOW_TEXT = `Válido desde las ${VALIDITY_OPENS_LABEL} del día de inicio hasta las ${VALIDITY_CLOSES_LABEL} del día de caducidad (hora de Canarias).`;

function canaryClock(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Atlantic/Canary",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { day: `${value.year}-${value.month}-${value.day}`, minuteOfDay: Number(value.hour) * 60 + Number(value.minute) };
}

export function todayInCanary(now = new Date()) {
  return canaryClock(now).day;
}

export function couponStatus(startDate: string, validityDays: number, amountCents: number, usedCents: number, now = new Date()): CouponStatus {
  const { day, minuteOfDay } = canaryClock(now);
  if (usedCents >= amountCents) return "redeemed";
  if (day < startDate || (day === startDate && minuteOfDay < VALIDITY_OPENS_AT_MINUTE)) return "not-started";
  if (day > addDays(startDate, validityDays)) return "expired";
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
