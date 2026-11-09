// Mirrors backend/app/schemas. Money is always a string ("6.50"), never a float.
export type User = {
  id: string;
  email: string;
  display_name: string | null;
  is_demo: boolean;
  default_currency: string;
  timezone: string;
  expires_at: string | null;
};

export const CATEGORIES = [
  "food_drink", "groceries", "transport", "shopping", "bills", "health", "entertainment", "travel", "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const PAYMENT_METHODS = ["card", "cash", "transfer", "mobile", "other", "unknown"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type Entry = {
  id: string;
  date: string; // YYYY-MM-DD
  merchant: string | null;
  merchant_domain?: string | null; // only set when logos are switched on
  group_id?: string | null; // items of one purchase share it
  uncertain?: string[]; // what the AI said it guessed: amount, currency, date, category, merchant, payment_method
  note: string | null;
  amount: string; // "6.50"
  currency: string;
  category: string;
  payment_method: string;
  source: string;
  raw_input: string | null;
  confidence: number;
  model_used: string;
  user_corrected: boolean;
  confirmed?: boolean; // the user checked it, so it no longer needs a check
  created_at: string;
  updated_at: string;
};

/** The answer to "add this text". Several entries when one purchase had items in different categories. */
export type EntryCreated = Entry & { siblings?: Entry[] };

export type EntryUpdate = Partial<{
  date: string;
  merchant: string | null;
  note: string | null;
  amount: string;
  currency: string;
  category: Category;
  payment_method: PaymentMethod;
  confirmed: boolean;
}>;

export type UsageStatus = { used: number; limit: number; resets_at: string };
export type CurrencyTotal = { currency: string; total: string; count: number };
export type Overview = {
  total_entries: number;
  entry_limit: number;
  first_date: string | null;
  totals: CurrencyTotal[];
};

export type CategoryTotal = { category: string; total: string; count: number };
export type MonthlyStats = {
  month: string; // YYYY-MM
  currency: string;
  total: string;
  count: number;
  by_category: CategoryTotal[];
  currencies: CurrencyTotal[];
};
