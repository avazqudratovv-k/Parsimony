import type { Lang, TFn } from "../i18n";
import { CATEGORIES, PAYMENT_METHODS } from "../api/types";
import type { Category, PaymentMethod } from "../api/types";

const LOCALES: Record<Lang, string> = { en: "en-US", ko: "ko-KR", uz: "uz-Latn-UZ" };

/** "6.50" + "USD" -> "$6.50" / "₩5,000". Uzbek: "6,50 $" / "5 000 ₩" (symbol after, narrow space, decimal comma). */
export function formatMoney(amount: string, currency: string, lang: Lang): string {
  const value = Number(amount);
  try {
    if (lang === "uz") return formatMoneyUz(value, currency);
    return new Intl.NumberFormat(LOCALES[lang], { style: "currency", currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`; // an unknown currency code
  }
}

function formatMoneyUz(value: number, currency: string): string {
  const en = new Intl.NumberFormat("en-US", { style: "currency", currency, currencyDisplay: "narrowSymbol" });
  const digits = en.resolvedOptions().maximumFractionDigits ?? 2;
  const symbol = en.formatToParts(0).find((p) => p.type === "currency")?.value ?? currency;
  const number = new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    .format(value)
    .replace(/,/g, "\u202F")
    .replace(".", ",");
  return `${number} ${symbol}`;
}

// Browsers often have no Uzbek month names (they show "M11"), so these are written out here.
const UZ_MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
const UZ_WEEKDAYS = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"];
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

/** Today's date ("2026-11-09") in the given IANA time zone. */
export function currentDate(timeZone: string, now: Date = new Date()): string {
  let zone = timeZone;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
  } catch {
    zone = "UTC";
  }
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** "2026-11-08" minus/plus days, as a plain calendar date. */
export function shiftDate(date: string, delta: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

/** Day header text: "Mon 9 Nov" / "11월 9일 (월)" / "9-noyabr, dushanba". */
export function formatDay(date: string, lang: Lang): string {
  const [y, m, d] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  if (lang === "uz") return `${d}-${UZ_MONTHS[m - 1].toLowerCase()}, ${UZ_WEEKDAYS[utc.getUTCDay()]}`;
  const wd = new Intl.DateTimeFormat(LOCALES[lang], { weekday: "short", timeZone: "UTC" }).format(utc);
  if (lang === "ko") return `${m}월 ${d}일 (${wd})`;
  const mon = new Intl.DateTimeFormat(LOCALES[lang], { month: "short", timeZone: "UTC" }).format(utc);
  return `${wd} ${d} ${mon}`;
}

/** Clock time in the user's zone, 24-hour: "12:40". */
export function formatTime(iso: string, timeZone: string): string {
  const value = iso.endsWith("Z") || /[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`;
  try {
    return new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hourCycle: "h23", timeZone }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" }).format(new Date(value));
  }
}

/** Percent share, whole numbers: 0.283 -> "28%". Never shows 0% for a real amount. */
export function formatShare(part: number, whole: number): string {
  if (whole <= 0) return "0%";
  const pct = Math.round((part / whole) * 100);
  return `${part > 0 && pct === 0 ? 1 : pct}%`;
}

/** Month name alone, for sentences: "November" / "11월" / "noyabr". */
export function formatMonthName(month: string, lang: Lang): string {
  const [y, m] = month.split("-").map(Number);
  if (lang === "uz") return UZ_MONTHS[m - 1].toLowerCase();
  if (lang === "ko") return `${m}월`;
  return new Intl.DateTimeFormat(LOCALES[lang], { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
}
