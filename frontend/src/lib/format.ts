import type { Lang, TFn } from "../i18n";
import { CATEGORIES, PAYMENT_METHODS } from "../api/types";
import type { Category, PaymentMethod } from "../api/types";

const LOCALES: Record<Lang, string> = { en: "en-US", ko: "ko-KR", uz: "uz-Latn-UZ" };

/** "6.50" + "USD" -> "$6.50" / "₩5,000" in the reader's own number style. */
export function formatMoney(amount: string, currency: string, lang: Lang): string {
  const value = Number(amount);
  try {
    return new Intl.NumberFormat(LOCALES[lang], { style: "currency", currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`; // an unknown currency code
  }
}

// Browsers often have no Uzbek month names (they show "M11"), so these are written out here.
const UZ_MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
const UZ_MONTHS_SHORT = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];

/** "2026-11-09" -> "Nov 9" / "11월 9일". Parsed as a plain date, so no timezone can shift it. */
export function formatDate(date: string, lang: Lang, withYear = false): string {
  const [y, m, d] = date.split("-").map(Number);
  if (lang === "uz") return `${d} ${UZ_MONTHS_SHORT[m - 1]}${withYear ? ` ${y}` : ""}`;
  const utc = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat(LOCALES[lang], {
    month: "short",
    day: "numeric",
    year: withYear ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(utc);
}

export const categoryLabel = (t: TFn, category: string): string =>
  t(`cat.${(CATEGORIES as readonly string[]).includes(category) ? (category as Category) : "other"}` as const);

export const paymentLabel = (t: TFn, method: string): string =>
  t(`pay.${(PAYMENT_METHODS as readonly string[]).includes(method) ? (method as PaymentMethod) : "unknown"}` as const);

export const fill = (text: string, values: Record<string, string | number>): string =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""));

export const LOW_CONFIDENCE = 0.75;

/** For comparing a typed confirm word: lower case, and every kind of apostrophe counts as the same one. */
export const normalizeWord = (text: string): string =>
  text.trim().toLowerCase().replace(/[ʻʼ‘’`´]/g, "'");

/** Today's month ("2026-11") in the given IANA time zone, so "this month" matches the user's calendar. */
export function currentMonth(timeZone: string, now: Date = new Date()): string {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit" }).formatToParts(now);
  }
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** "2026-11" -> "November 2026" / "2026년 11월". */
export function formatMonth(month: string, lang: Lang): string {
  const [y, m] = month.split("-").map(Number);
  if (lang === "uz") return `${UZ_MONTHS[m - 1]} ${y}`;
  return new Intl.DateTimeFormat(LOCALES[lang], { year: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
}
