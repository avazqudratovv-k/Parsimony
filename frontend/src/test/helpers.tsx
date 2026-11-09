import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import { createQueryClient } from "../lib/session";
import { I18nProvider } from "../i18n";
import type { Lang } from "../i18n";
import { createAppRouter, memoryHistory } from "../router";
import { AppThemeProvider } from "../theme";

export const USER = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "me@example.com",
  display_name: null,
  is_demo: false,
  default_currency: "USD",
  timezone: "Asia/Seoul",
  expires_at: null,
};

type Handler = (url: string, init?: RequestInit) => { status: number; body?: unknown };

/** Replace fetch with a fake. Unknown routes fail the test loudly. */
export function mockApi(routes: Record<string, Handler | { status: number; body?: unknown }>) {
  const calls: { url: string; method: string; body: unknown; form?: FormData }[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const isForm = init?.body instanceof FormData;
    calls.push({ url, method, body: init?.body && !isForm ? JSON.parse(String(init.body)) : undefined, form: isForm ? (init!.body as FormData) : undefined });
    const exact = `${method} ${url}`;
    // A key ending in "*" matches any URL with that prefix (e.g. "GET /api/entries?*").
    const wild = Object.keys(routes).find((k) => k.endsWith("*") && exact.startsWith(k.slice(0, -1)));
    const route = routes[exact] ?? (wild ? routes[wild] : undefined);
    if (!route) throw new Error(`Unmocked request: ${method} ${url}`);
    const r = typeof route === "function" ? route(url, init) : route;
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status });
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

export function renderApp(path: string, lang: Lang = "en") {
  const queryClient = createQueryClient(() => void router.navigate({ to: "/" }), false);
  const router = createAppRouter(queryClient, memoryHistory(path));
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider initial={lang}>
        <AppThemeProvider>
          <RouterProvider router={router} />
        </AppThemeProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );
  return { ...utils, router };
}

export const ENTRY = {
  id: "e1",
  date: "2026-11-08",
  merchant: "Blue Bottle",
  note: "with Sam",
  amount: "6.50",
  currency: "USD",
  category: "food_drink",
  payment_method: "card",
  source: "text",
  raw_input: "Coffee with Sam, $6.50, card",
  confidence: 0.95,
  model_used: "gemini-3.5-flash-lite",
  user_corrected: false,
  created_at: "2026-11-08T03:00:00Z",
  updated_at: "2026-11-08T03:00:00Z",
};

export const USAGE = { used: 3, limit: 30, resets_at: "2026-11-10T00:00:00Z" };
export const OVERVIEW = {
  total_entries: 2,
  entry_limit: 1000,
  first_date: "2026-10-02",
  totals: [
    { currency: "KRW", total: "9000.00", count: 1 },
    { currency: "USD", total: "6.50", count: 1 },
  ],
};

export const MONTHLY = {
  month: "2026-11",
  currency: "USD",
  total: "6.50",
  count: 1,
  by_category: [{ category: "food_drink", total: "6.50", count: 1 }],
  currencies: [{ currency: "USD", total: "6.50", count: 1 }],
};

/** Signed in, with the dashboard's data endpoints answered. Pass extras to override or add routes. */
export function signedInApi(extra: Record<string, Handler | { status: number; body?: unknown }> = {}, entries: unknown[] = [ENTRY]) {
  return mockApi({
    "GET /api/auth/me": { status: 200, body: USER },
    "GET /api/entries?*": { status: 200, body: entries },
    "GET /api/stats/monthly?*": { status: 200, body: MONTHLY },
    "GET /api/usage": { status: 200, body: USAGE },
    "GET /api/stats/overview": { status: 200, body: OVERVIEW },
    ...extra,
  });
}
