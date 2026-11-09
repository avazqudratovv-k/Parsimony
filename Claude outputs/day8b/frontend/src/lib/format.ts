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

/** "2026-11-09" -> "Nov 9" / "11월 9일". Parsed as a plain date, so no timezone can shift it. */
export function formatDate(date: string, lang: Lang, withYear = false): string {
  const [y, m, d] = date.split("-").map(Number);
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
