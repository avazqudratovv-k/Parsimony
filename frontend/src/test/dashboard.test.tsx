import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ENTRY, MONTHLY, OVERVIEW, USER, renderApp, signedInApi } from "./helpers";

const LOW = { ...ENTRY, id: "e2", merchant: "CGV", note: null, amount: "9000.00", currency: "KRW", category: "entertainment", confidence: 0.5, raw_input: "movie 9000 won" };

describe("dashboard list", () => {
  it("shows entries with money formatted for the language", async () => {
    signedInApi({}, [ENTRY, LOW]);
    renderApp("/app");
    expect(await screen.findByText("Blue Bottle")).toBeInTheDocument();
    expect(screen.getAllByText("$6.50").length).toBeGreaterThan(0);
    expect(screen.getAllByText("₩9,000").length).toBeGreaterThan(0);
    expect(screen.getByText("with Sam · Card · 12:00")).toBeInTheDocument();
    expect(screen.getByText("Yesterday")).toBeInTheDocument(); // the day header: Yesterday · Sun 8 Nov
    expect(screen.getByText(/Sun 8 Nov/)).toBeInTheDocument();
  });

  it("shows each day's total, per currency, in the day header", async () => {
    const SAME_DAY_USD = { ...ENTRY, id: "e3", merchant: "Uber", note: null, amount: "18.00", raw_input: "uber 18" };
    signedInApi({}, [ENTRY, SAME_DAY_USD, LOW]);
    renderApp("/app");
    await screen.findByText("Uber");
    expect(screen.getByText("Total $24.50 + ₩9,000")).toBeInTheDocument();
  });

  it("marks low-confidence entries 'Check this' but not good ones", async () => {
    signedInApi({}, [ENTRY, LOW]);
    renderApp("/app");
    await screen.findAllByText("CGV");
    expect(screen.getAllByText("Check this")).toHaveLength(1);
  });

  it("shows the Korean UI with Korean number style", async () => {
    signedInApi({}, [ENTRY]);
    renderApp("/app", "ko");
    expect(await screen.findByText("Blue Bottle")).toBeInTheDocument();
    expect(screen.getByText("내 지출")).toBeInTheDocument();
    expect(screen.getByText("with Sam · 카드 · 12:00")).toBeInTheDocument();
    expect(screen.getByText(/11월 8일 \(일\)/)).toBeInTheDocument();
  });

  it("shows an empty state", async () => {
    signedInApi({}, []);
    renderApp("/app");
    expect(await screen.findByText("No expenses yet")).toBeInTheDocument();
  });

  it("shows an error with a retry button", async () => {
    signedInApi({ "GET /api/entries?*": { status: 500, body: { detail: "boom" } } });
    renderApp("/app");
    expect(await screen.findByText("Couldn't load your expenses.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("shows today's AI usage", async () => {
    signedInApi();
    renderApp("/app");
    expect(await screen.findByText("27 of 30 smart adds left today")).toBeInTheDocument();
  });
});

describe("add bar", () => {
  it("sends the text with the browser timezone and shows the new entry", async () => {
    let list = [ENTRY];
    const calls = signedInApi({
      "GET /api/entries?*": () => ({ status: 200, body: list }),
      "POST /api/entries": () => {
        list = [{ ...ENTRY, id: "e9", merchant: "Kimbap House", amount: "4.00" }, ...list];
        return { status: 201, body: list[0] };
      },
    });
    renderApp("/app");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Describe an expense"), "kimbap 4 dollars");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("Kimbap House")).toBeInTheDocument();
    const post = calls.find((c) => c.method === "POST")!;
    expect(post.body).toMatchObject({ text: "kimbap 4 dollars" });
    expect(typeof (post.body as { timezone: string }).timezone).toBe("string");
    expect(screen.getByLabelText("Describe an expense")).toHaveValue("");
  });

  it("does nothing for empty text", async () => {
    signedInApi();
    renderApp("/app");
    await screen.findByLabelText("Describe an expense");
    expect(screen.queryByRole("button", { name: "Add" })).not.toBeInTheDocument(); // appears once you type
  });

  it.each([
    [422, { detail: "x" }, "couldn't read that as an expense"],
    [429, { detail: { code: "daily_limit_account", message: "x", resets_at: "2026-11-10T00:00:00Z" } }, "used all of today's smart adds"],
    [429, { detail: { code: "daily_limit_global", message: "x", resets_at: "2026-11-10T00:00:00Z" } }, "daily smart add limit for everyone"],
    [409, { detail: { code: "entry_limit", message: "x" } }, "Entry limit reached"],
    [502, { detail: "x" }, "unavailable right now"],
  ])("explains a %s failure in plain words", async (status, body, expected) => {
    signedInApi({ "POST /api/entries": { status, body } });
    renderApp("/app");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Describe an expense"), "lunch");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(expected);
    expect(screen.getByLabelText("Describe an expense")).toHaveValue("lunch"); // keeps the text
  });

  it("has a My page button that opens /me", async () => {
    signedInApi();
    const { router } = renderApp("/app");
    await userEvent.setup().click(await screen.findByRole("link", { name: "My page" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/me"));
  });
});

describe("Fix this", () => {
  it("sends only the changed fields", async () => {
    const calls = signedInApi({ "PATCH /api/entries/e1": { status: 200, body: { ...ENTRY, amount: "7.00", user_corrected: true } } });
    renderApp("/app");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Blue Bottle, $6.50" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Coffee with Sam, $6.50, card")).toBeInTheDocument(); // "You said"
    const amount = within(dialog).getByLabelText("Amount");
    await user.clear(amount);
    await user.type(amount, "7");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls.find((c) => c.method === "PATCH")!.body).toEqual({ amount: "7" });
  });

  it("validates the amount before saving", async () => {
    const calls = signedInApi();
    renderApp("/app");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Blue Bottle, $6.50" }));
    const dialog = await screen.findByRole("dialog");
    const amount = within(dialog).getByLabelText("Amount");
    await user.clear(amount);
    await user.type(amount, "0");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(within(dialog).getByText("Enter an amount above 0.")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("saving with no changes just closes", async () => {
    const calls = signedInApi();
    renderApp("/app");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Blue Bottle, $6.50" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("needs two taps to delete", async () => {
    const calls = signedInApi({ "DELETE /api/entries/e1": { status: 204 } });
    renderApp("/app");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Blue Bottle, $6.50" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete entry" }));
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    await user.click(within(dialog).getByRole("button", { name: "Tap again to delete" }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE")).toBe(true));
  });
});

describe("My page", () => {
  it("shows the overview with per-currency totals", async () => {
    signedInApi();
    renderApp("/me");
    expect(await screen.findByRole("heading", { name: "My page" })).toBeInTheDocument();
    expect(await screen.findByText("/ 1000")).toBeInTheDocument();
    expect(screen.getByText("₩9,000")).toBeInTheDocument();
    expect(screen.getByText("$6.50")).toBeInTheDocument();
    expect(screen.getByText("Oct 2, 2026")).toBeInTheDocument();
    expect(screen.getByText("/ 30")).toBeInTheDocument();
    expect(screen.getByText(USER.email)).toBeInTheDocument();
    expect(screen.getByText("me")).toBeInTheDocument(); // no display name yet: the part before the @
  });

  it("saves currency and timezone, enabling Save only after a change", async () => {
    const calls = signedInApi({ "PATCH /api/auth/me": { status: 200, body: { ...USER, default_currency: "KRW" } } });
    renderApp("/me");
    const user = userEvent.setup();
    const save = await screen.findByRole("button", { name: "Save changes" });
    expect(save).toBeDisabled();
    const currency = screen.getByLabelText("Default currency");
    await user.clear(currency);
    await user.type(currency, "krw");
    expect(save).toBeEnabled();
    await user.click(save);
    expect(await screen.findByRole("status")).toHaveTextContent("Saved");
    expect(calls.find((c) => c.method === "PATCH")!.body).toEqual({ default_currency: "KRW" });
  });

  it("saves a display name and shows it with an initial", async () => {
    const calls = signedInApi({ "PATCH /api/auth/me": { status: 200, body: { ...USER, display_name: "Avaz" } } });
    renderApp("/me");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Display name"), "Avaz");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Saved");
    expect(calls.find((c) => c.method === "PATCH")!.body).toEqual({ display_name: "Avaz" });
    expect(screen.getByText("A")).toBeInTheDocument(); // the avatar initial
    expect(screen.getAllByText("Avaz").length).toBeGreaterThan(0);
  });

  it("clearing the name sends null", async () => {
    const calls = signedInApi({
      "GET /api/auth/me": { status: 200, body: { ...USER, display_name: "Avaz" } },
      "PATCH /api/auth/me": { status: 200, body: { ...USER, display_name: null } },
    });
    renderApp("/me");
    const user = userEvent.setup();
    await user.clear(await screen.findByLabelText("Display name"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByRole("status");
    expect(calls.find((c) => c.method === "PATCH")!.body).toEqual({ display_name: null });
  });

  it("rejects a bad currency code without calling the server", async () => {
    const calls = signedInApi();
    renderApp("/me");
    const user = userEvent.setup();
    const currency = await screen.findByLabelText("Default currency");
    await user.clear(currency);
    await user.type(currency, "US");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByText("Use a 3-letter code, like USD.")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("logs out and returns to the sign-in page", async () => {
    signedInApi({ "POST /api/auth/logout": { status: 204 } });
    const { router } = renderApp("/me");
    await userEvent.setup().click(await screen.findByRole("button", { name: "Log out" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });

  it("deletes the account only after typing 'delete'", async () => {
    const calls = signedInApi({ "DELETE /api/auth/me": { status: 204 } });
    const { router } = renderApp("/me");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Delete my account" }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Delete everything" });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Type delete to confirm"), "delet");
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Type delete to confirm"), "e");
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(calls.some((c) => c.method === "DELETE" && c.url === "/api/auth/me")).toBe(true);
  });

  it("shows the demo note for demo accounts", async () => {
    signedInApi({ "GET /api/auth/me": { status: 200, body: { ...USER, is_demo: true } } });
    renderApp("/me");
    expect(await screen.findByText(/Demo account\. It deletes itself/)).toBeInTheDocument();
  });

  it("an empty account shows 'Nothing yet'", async () => {
    signedInApi({ "GET /api/stats/overview": { status: 200, body: { ...OVERVIEW, total_entries: 0, first_date: null, totals: [] } } });
    renderApp("/me");
    expect(await screen.findByText("Nothing yet")).toBeInTheDocument();
  });
});

describe("delete confirm word", () => {
  it("accepts the Uzbek word with a plain apostrophe, and plain English 'delete'", async () => {
    signedInApi();
    renderApp("/me", "uz");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Hisobimni oʻchirish" }));
    const dialog = await screen.findByRole("dialog");
    const field = within(dialog).getByLabelText(/Tasdiqlash uchun/);
    const confirm = within(dialog).getByRole("button", { name: "Hammasini oʻchirish" });
    await user.type(field, "o'chirish");
    expect(confirm).toBeEnabled();
    await user.clear(field);
    await user.type(field, "delete");
    expect(confirm).toBeEnabled();
  });

  it("accepts the Korean word", async () => {
    signedInApi();
    renderApp("/me", "ko");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "계정 삭제" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/확인하려면/), "삭제");
    expect(within(dialog).getByRole("button", { name: "모두 삭제" })).toBeEnabled();
  });
});

describe("monthly chart", () => {
  const region = () => within(screen.getByRole("region", { name: "Spending by category" }));

  it("shows the month, the total, and each category with its amount and share", async () => {
    signedInApi();
    renderApp("/app");
    expect(await screen.findByRole("heading", { name: "November 2026" })).toBeInTheDocument();
    expect(await screen.findByText("SPENT IN NOVEMBER · USD", { exact: false })).toBeInTheDocument();
    const rows = await within(await screen.findByRole("region", { name: "Spending by category" })).findAllByRole("listitem");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("Food & drink");
    expect(rows[0]).toHaveTextContent("100%");
    expect(rows[0]).toHaveTextContent("$6.50");
  });

  it("compares with last month when there is data for it", async () => {
    signedInApi({
      "GET /api/stats/monthly?*": (url) =>
        url.includes("month=2026-10")
          ? { status: 200, body: { ...MONTHLY, month: "2026-10", total: "10.00", count: 2 } }
          : { status: 200, body: { ...MONTHLY, total: "6.50" } },
    });
    renderApp("/app");
    expect(await screen.findByText(/\$3\.50 less than last month/)).toBeInTheDocument();
  });

  it("goes to the previous month and asks for that month", async () => {
    const calls = signedInApi({
      "GET /api/stats/monthly?*": (url) => ({ status: 200, body: { ...MONTHLY, month: url.includes("2026-10") ? "2026-10" : "2026-11" } }),
    });
    renderApp("/app");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Previous month" }));
    expect(await screen.findByRole("heading", { name: "October 2026" })).toBeInTheDocument();
    expect(calls.some((c) => c.url === "/api/entries?month=2026-10&limit=100")).toBe(true);
    expect(calls.some((c) => c.url.startsWith("/api/stats/monthly?month=2026-10"))).toBe(true);
    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(await screen.findByRole("heading", { name: "November 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next month" })).toBeDisabled();
  });

  it("shows currency tabs only when the month has more than one currency", async () => {
    const body = {
      ...MONTHLY,
      currencies: [{ currency: "USD", total: "6.50", count: 1 }, { currency: "KRW", total: "9000.00", count: 1 }],
    };
    const calls = signedInApi({
      "GET /api/stats/monthly?*": (url) =>
        url.includes("currency=KRW")
          ? { status: 200, body: { ...body, currency: "KRW", total: "9000.00", by_category: [{ category: "transport", total: "9000.00", count: 1 }] } }
          : { status: 200, body },
    });
    renderApp("/app");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "KRW" }));
    expect(await region().findByText("Transport")).toBeInTheDocument();
    expect(calls.some((c) => c.url.includes("currency=KRW"))).toBe(true);
  });

  it("hides the currency tabs for a single currency", async () => {
    signedInApi();
    renderApp("/app");
    await screen.findByRole("region", { name: "Spending by category" });
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("shows the top five and a Show all button on a phone", async () => {
    const cats = ["food_drink", "groceries", "transport", "shopping", "bills", "health", "travel"];
    signedInApi({
      "GET /api/stats/monthly?*": {
        status: 200,
        body: { ...MONTHLY, total: "70.00", count: 7, by_category: cats.map((category, i) => ({ category, total: String(20 - i * 2), count: 1 })) },
      },
    });
    renderApp("/app");
    await screen.findByRole("region", { name: "Spending by category" });
    await region().findByText("Food & drink");
    expect(region().getAllByRole("listitem")).toHaveLength(5);
    expect(region().getByText("2 more categories")).toBeInTheDocument();
    await userEvent.setup().click(region().getByRole("button", { name: "Show all" }));
    expect(region().getAllByRole("listitem")).toHaveLength(7);
  });

  it("says so when the month is empty, and when the chart fails", async () => {
    signedInApi({ "GET /api/stats/monthly?*": { status: 200, body: { ...MONTHLY, total: "0.00", count: 0, by_category: [], currencies: [] } } });
    const first = renderApp("/app");
    expect(await screen.findByText("Nothing spent this month.")).toBeInTheDocument();
    first.unmount();
    signedInApi({ "GET /api/stats/monthly?*": { status: 500, body: { detail: "boom" } } });
    renderApp("/app");
    expect(await screen.findByText("Couldn't load the chart.")).toBeInTheDocument();
  });
});

describe("needs a check", () => {
  it("lists low-confidence entries that nobody has corrected, and opens Fix this", async () => {
    signedInApi({}, [ENTRY, LOW]);
    renderApp("/app");
    const card = within(await screen.findByRole("region", { name: "Needs a check" }));
    expect(card.getByText("CGV")).toBeInTheDocument();
    expect(card.queryByText("Blue Bottle")).not.toBeInTheDocument();
    await userEvent.setup().click(card.getByRole("button", { name: /CGV/ }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("is not shown when everything looks right", async () => {
    signedInApi();
    renderApp("/app");
    await screen.findByText("Blue Bottle");
    expect(screen.queryByRole("region", { name: "Needs a check" })).not.toBeInTheDocument();
  });
});

describe("expired session", () => {
  it("returns to the landing page with a notice when the server answers 401", async () => {
    const calls = signedInApi({ "GET /api/usage": { status: 401, body: { detail: "Not authenticated" } } });
    const { router } = renderApp("/app");
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(await screen.findByText("Your session ended. Please sign in again.")).toBeInTheDocument();
    expect(calls.length).toBeGreaterThan(0);
  });
});
