import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import { I18nProvider } from "../i18n";
import type { Lang } from "../i18n";
import { createAppRouter, memoryHistory } from "../router";
import { AppThemeProvider } from "../theme";

export const USER = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "me@example.com",
  is_demo: false,
  default_currency: "USD",
  timezone: "Asia/Seoul",
  expires_at: null,
};

type Handler = (url: string, init?: RequestInit) => { status: number; body?: unknown };

/** Replace fetch with a fake. Unknown routes fail the test loudly. */
export function mockApi(routes: Record<string, Handler | { status: number; body?: unknown }>) {
  const calls: { url: string; method: string; body: unknown }[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const route = routes[`${method} ${url}`];
    if (!route) throw new Error(`Unmocked request: ${method} ${url}`);
    const r = typeof route === "function" ? route(url, init) : route;
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status });
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

export function renderApp(path: string, lang: Lang = "en") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
