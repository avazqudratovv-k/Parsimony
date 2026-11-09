import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ENTRY, OVERVIEW, USER, renderApp, signedInApi } from "./helpers";

const LOW = { ...ENTRY, id: "e2", merchant: "CGV", note: null, amount: "9000.00", currency: "KRW", category: "entertainment", confidence: 0.5, raw_input: "movie 9000 won" };

describe("dashboard list", () => {
  it("shows entries with money formatted for the language", async () => {
    signedInApi({}, [ENTRY, LOW]);
    renderApp("/app");
    expect(await screen.findByText("Blue Bottle")).toBeInTheDocument();
    expect(screen.getByText("$6.50")).toBeInTheDocument();
    expect(screen.getByText("₩9,000")).toBeInTheDocument();
    expect(screen.getByText(/Food & drink · Nov 8 · with Sam/)).toBeInTheDocument();
  });

  it("marks low-confidence entries 'Check this' but not good ones", async () => {
    signedInApi({}, [ENTRY, LOW]);
    renderApp("/app");
    await screen.findByText("CGV");
    expect(screen.getAllByText("Check this")).toHaveLength(1);
  });

  it("shows the Korean UI with Korean number style", async () => {
    signedInApi({}, [ENTRY]);
    renderApp("/app", "ko");
    expect(await screen.findByText("Blue Bottle")).toBeInTheDocument();
    expect(screen.getByText("내 지출")).toBeInTheDocument();
    expect(screen.getByText(/식비·음료 · 11월 8일/)).toBeInTheDocument();
  });

  it("shows an empty state", async () => {
    signedInApi({}, []);
    renderApp("/app");
    expect(await screen.findByText("No expenses yet")).toBeInTheDocument();
  });

  it("shows an error with a retry button", async () => {
    signedInApi({ "GET /api/entries?limit=100": { status: 500, body: { detail: "boom" } } });
    renderApp("/app");
    expect(await screen.findByText("Couldn't load your expenses.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("shows today's AI usage", async () => {
    signedInApi();
    renderApp("/app");
    expect(await screen.findByText("3 of 30 AI entries used today")).toBeInTheDocument();
  });
});

describe("add bar", () => {
  it("sends the text with the browser timezone and shows the new entry", async () => {
    let list = [ENTRY];
    const calls = signedInApi({
      "GET /api/entries?limit=100": () => ({ status: 200, body: list }),
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
    [429, { detail: { code: "daily_limit_account", message: "x", resets_at: "2026-11-10T00:00:00Z" } }, "used all of today's AI entries"],
    [429, { detail: { code: "daily_limit_global", message: "x", resets_at: "2026-11-10T00:00:00Z" } }, "daily AI limit for everyone"],
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
    await user.click((await screen.findAllByRole("button", { name: "Fix this" }))[0]);
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
    await user.click((await screen.findAllByRole("button", { name: "Fix this" }))[0]);
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
    await user.click((await screen.findAllByRole("button", { name: "Fix this" }))[0]);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("needs two taps to delete", async () => {
    const calls = signedInApi({ "DELETE /api/entries/e1": { status: 204 } });
    renderApp("/app");
    const user = userEvent.setup();
    await user.click((await screen.findAllByRole("button", { name: "Fix this" }))[0]);
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
