import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import * as audio from "../lib/audio";
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
    [429, { detail: { code: "typed_limit_account", message: "x", resets_at: "2026-11-10T00:00:00Z" } }, "fair-use limit for typed entries"],
    [429, { detail: { code: "typed_limit_global", message: "x", resets_at: "2026-11-10T00:00:00Z" } }, "daily typing limit for everyone"],
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

describe("toasts and manual entry", () => {
  it("shows 'Added ...' after a typed entry, and Undo deletes exactly that entry", async () => {
    const NEW = { ...ENTRY, id: "n1", merchant: "Kimbap House", amount: "4.00" };
    const calls = signedInApi({
      "POST /api/entries": { status: 201, body: NEW },
      "DELETE /api/entries/n1": { status: 204 },
    });
    renderApp("/app");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Describe an expense"), "kimbap 4 dollars");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("Added: Kimbap House $4.00")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByText("Removed")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "DELETE" && c.url === "/api/entries/n1")).toBe(true);
  });

  it("says how many entries one purchase became, and Undo removes all of them", async () => {
    const A = { ...ENTRY, id: "m1", merchant: "GS25", note: "Milk", amount: "2.00" };
    const B = { ...ENTRY, id: "m2", merchant: "GS25", note: "Shampoo", amount: "5.50", category: "shopping" };
    const calls = signedInApi({
      "POST /api/entries": { status: 201, body: { ...A, siblings: [B] } },
      "DELETE /api/entries/m1": { status: 204 },
      "DELETE /api/entries/m2": { status: 204 },
    });
    renderApp("/app");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Describe an expense"), "gs25 milk 2 shampoo 5.50");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("Added 2 entries: GS25 $7.50")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(calls.filter((c) => c.method === "DELETE").map((c) => c.url).sort()).toEqual(["/api/entries/m1", "/api/entries/m2"]));
  });

  it("'Make it one' turns a split purchase back into a single entry with the total", async () => {
    const A = { ...ENTRY, id: "m1", merchant: "GS25", note: "Milk", amount: "2.00", category: "groceries" };
    const B = { ...ENTRY, id: "m2", merchant: "GS25", note: "Shampoo", amount: "5.50", category: "shopping" };
    const calls = signedInApi({
      "POST /api/entries": { status: 201, body: { ...A, siblings: [B] } },
      "PATCH /api/entries/m1": { status: 200, body: { ...A, amount: "7.50" } },
      "DELETE /api/entries/m2": { status: 204 },
    });
    renderApp("/app");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Describe an expense"), "gs25 milk 2 shampoo 5.50");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.click(await screen.findByRole("button", { name: "Make it one" }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.url === "/api/entries/m2")).toBe(true));
    const patch = calls.find((c) => c.method === "PATCH")!;
    expect(patch.body).toMatchObject({ amount: "7.50", note: "Milk, Shampoo", category: "shopping" });
  });

  it("tells you the amount is missing, instead of a vague error", async () => {
    signedInApi({ "POST /api/entries": { status: 422, body: { detail: { code: "no_amount", message: "x" } } } });
    renderApp("/app");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Describe an expense"), "1 dish and 1 fork at Dyson");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText(/couldn't find an amount\. Say how much it cost/)).toBeInTheDocument();
  });

  it("offers 'Enter manually' when the AI can't read the text, and saves without the AI", async () => {
    const MANUAL = { ...ENTRY, id: "m1", merchant: null, note: "weird thing", amount: "9.00", source: "manual" };
    const calls = signedInApi({
      "POST /api/entries": { status: 422, body: { detail: "x" } },
      "POST /api/entries/manual": { status: 201, body: MANUAL },
    });
    renderApp("/app");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Describe an expense"), "weird thing");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.click(await screen.findByRole("button", { name: "Enter manually" }));
    const dialog = await screen.findByRole("dialog", { name: "Enter it manually" });
    expect(within(dialog).getByLabelText("Note")).toHaveValue("weird thing"); // keeps what was typed
    expect(within(dialog).queryByRole("button", { name: /Delete/ })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Add entry" }));
    expect(await within(dialog).findByText("Enter an amount above 0.")).toBeInTheDocument(); // amount is required
    await user.type(within(dialog).getByLabelText("Amount"), "9");
    await user.click(within(dialog).getByRole("button", { name: "Add entry" }));
    expect(await screen.findByText("Entry added")).toBeInTheDocument();
    const post = calls.find((c) => c.url === "/api/entries/manual")!;
    expect(post.body).toMatchObject({ amount: "9", note: "weird thing", category: "other", payment_method: "unknown" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("does not offer 'Enter manually' for other failures", async () => {
    signedInApi({ "POST /api/entries": { status: 502, body: { detail: "x" } } });
    renderApp("/app");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Describe an expense"), "lunch");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: "Enter manually" })).not.toBeInTheDocument();
  });
});

describe("receipt photo", () => {
  const PHOTO = { ...ENTRY, id: "p1", merchant: "GS25", note: null, amount: "4800.00", currency: "KRW", category: "groceries", source: "photo", raw_input: null, confidence: 0.9 };
  const pick = async (name = "r.jpg", type = "image/jpeg") => {
    const user = userEvent.setup({ applyAccept: false });
    await user.upload(await screen.findByTestId("photo-input"), new File(["x"], name, { type }));
    return user;
  };
  const stubUrls = () => {
    URL.createObjectURL = () => "blob:test";
    URL.revokeObjectURL = () => {};
  };

  it("uploads the photo with the timezone and shows the fields to check", async () => {
    stubUrls();
    const calls = signedInApi({ "POST /api/entries/photo": { status: 201, body: PHOTO } });
    renderApp("/app");
    await pick();
    const dialog = await screen.findByRole("dialog", { name: "Check the receipt" });
    expect(within(dialog).getAllByText("₩4,800").length).toBeGreaterThan(0);
    expect(within(dialog).getByText("GS25")).toBeInTheDocument();
    const post = calls.find((c) => c.url === "/api/entries/photo")!;
    expect(post.form!.get("file")).toBeInstanceOf(Blob);
    expect(typeof post.form!.get("timezone")).toBe("string");
    expect(calls.filter((c) => c.url === "/api/entries/photo")).toHaveLength(1);
    await userEvent.setup().click(within(dialog).getByRole("button", { name: "Looks right" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("offers the camera and the photo library", async () => {
    signedInApi();
    renderApp("/app");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Add from a receipt photo" }));
    expect(screen.getByRole("menuitem", { name: "Take a photo" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Choose from library" })).toBeInTheDocument();
    expect(screen.getByTestId("camera-input")).toHaveAttribute("capture", "environment");
  });

  it("warns when the model was unsure", async () => {
    stubUrls();
    signedInApi({ "POST /api/entries/photo": { status: 201, body: { ...PHOTO, confidence: 0.5 } } });
    renderApp("/app");
    await pick();
    expect(await screen.findByText(/I wasn't sure about this one/)).toBeInTheDocument();
  });

  it("Edit opens the Fix this form for the new entry", async () => {
    stubUrls();
    signedInApi({ "POST /api/entries/photo": { status: 201, body: PHOTO } });
    renderApp("/app");
    const user = await pick();
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    expect(await screen.findByRole("dialog", { name: "Fix this entry" })).toBeInTheDocument();
  });

  it.each([
    [415, "isn't a photo I can read"],
    [413, "too large"],
    [422, "couldn't find a receipt"],
    [429, "used all of today's smart adds"],
    [502, "unavailable right now"],
  ])("explains a %s failure and lets you close", async (status, expected) => {
    stubUrls();
    const body = status === 429 ? { detail: { code: "daily_limit_account", message: "x", resets_at: "2026-11-10T00:00:00Z" } } : { detail: "x" };
    signedInApi({ "POST /api/entries/photo": { status, body } });
    renderApp("/app");
    const user = await pick();
    expect(await screen.findByRole("alert")).toHaveTextContent(expected);
    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("voice", () => {
  const stubMic = () =>
    vi.spyOn(audio, "startRecording").mockResolvedValue({
      stop: async () => new Blob(["RIFF"], { type: "audio/wav" }),
      cancel: () => {},
    });
  const openVoice = async () => {
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Add by voice" }));
    return user;
  };

  it("records, shows the words to confirm, then saves the entry as voice", async () => {
    stubMic();
    const VOICE = { ...ENTRY, id: "v1", merchant: null, note: "Taxi", amount: "12000.00", currency: "KRW", category: "transport", source: "voice", raw_input: "taxi 12000 won card" };
    const calls = signedInApi({
      "POST /api/entries/transcribe": { status: 200, body: { text: "taxi 12000 won card" } },
      "POST /api/entries": { status: 201, body: VOICE },
    });
    renderApp("/app");
    const user = await openVoice();
    await user.click(await screen.findByRole("button", { name: "Stop recording" }));
    const box = await screen.findByLabelText(/Transcript/);
    expect(box).toHaveValue("taxi 12000 won card");
    expect(calls.find((c) => c.url === "/api/entries/transcribe")!.form!.get("file")).toBeInstanceOf(Blob);
    await user.clear(box);
    await user.type(box, "taxi 13000 won card");
    await user.click(screen.getByRole("button", { name: "Add entry" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const post = calls.find((c) => c.method === "POST" && c.url === "/api/entries")!;
    expect(post.body).toMatchObject({ text: "taxi 13000 won card", source: "voice" });
  });

  it("explains a blocked microphone and lets you close", async () => {
    vi.spyOn(audio, "startRecording").mockRejectedValue(new audio.MicError("denied"));
    signedInApi();
    renderApp("/app");
    const user = await openVoice();
    expect(await screen.findByRole("alert")).toHaveTextContent("microphone is blocked");
    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("says so when no words were heard", async () => {
    stubMic();
    signedInApi({ "POST /api/entries/transcribe": { status: 422, body: { detail: "x" } } });
    renderApp("/app");
    const user = await openVoice();
    await user.click(await screen.findByRole("button", { name: "Stop recording" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't hear any words");
  });

  it("Record again goes back to listening", async () => {
    const spy = stubMic();
    signedInApi({ "POST /api/entries/transcribe": { status: 200, body: { text: "lunch 9" } } });
    renderApp("/app");
    const user = await openVoice();
    await user.click(await screen.findByRole("button", { name: "Stop recording" }));
    await user.click(await screen.findByRole("button", { name: "Record again" }));
    expect(await screen.findByRole("button", { name: "Stop recording" })).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("cancelling while listening closes without calling the server", async () => {
    stubMic();
    const calls = signedInApi();
    renderApp("/app");
    const user = await openVoice();
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls.some((c) => c.url.includes("transcribe"))).toBe(false);
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

describe("merchant logos", () => {
  const WITH_LOGO = { ...ENTRY, merchant: "GS25", merchant_domain: "gs25.com" };
  const logoOf = () => document.querySelector("img[src*='favicons']") as HTMLImageElement | null;

  it("shows no logo, only the category icon, when an entry has no domain (logos are off)", async () => {
    signedInApi({}, [ENTRY]);
    renderApp("/app");
    await screen.findByText("Blue Bottle");
    expect(logoOf()).toBeNull();
  });

  it("shows the logo for an entry with a domain, and falls back to the icon if it fails", async () => {
    signedInApi({}, [WITH_LOGO]);
    renderApp("/app");
    await screen.findByText("GS25");
    expect(logoOf()?.src).toContain("domain=gs25.com");
    fireEvent.error(logoOf()!);
    await waitFor(() => expect(logoOf()).toBeNull());
  });

  it("treats a tiny generic icon as 'no logo'", async () => {
    signedInApi({}, [WITH_LOGO]);
    renderApp("/app");
    await screen.findByText("GS25");
    const img = logoOf()!;
    Object.defineProperty(img, "naturalWidth", { value: 16 });
    fireEvent.load(img);
    await waitFor(() => expect(logoOf()).toBeNull());
  });
});

describe("export", () => {
  it("downloads the month as CSV and offers PDF", async () => {
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    signedInApi();
    renderApp("/app");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Export" }));
    expect(screen.getByRole("menuitem", { name: "Save as PDF" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Download CSV (Excel)" }));
    expect(click).toHaveBeenCalled();
    expect(await screen.findByText("Downloaded")).toBeInTheDocument();
    click.mockRestore();
  });
});

describe("phone gestures", () => {
  const press = (el: Element, x: number) => fireEvent.pointerDown(el, { clientX: x, clientY: 100, pointerType: "touch", pointerId: 1, button: 0 });
  const dragTo = (el: Element, x: number) => fireEvent.pointerMove(el, { clientX: x, clientY: 100, pointerType: "touch", pointerId: 1 });
  const rowOf = async () => (await screen.findByRole("button", { name: "Blue Bottle, $6.50" })).parentElement!;

  it("press and hold opens Edit / Delete; Delete removes the entry", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const calls = signedInApi({ "DELETE /api/entries/e1": { status: 204 } });
    renderApp("/app");
    const row = await rowOf();
    press(row, 200);
    act(() => { vi.advanceTimersByTime(600); });
    const menu = await screen.findByRole("menu", { name: "Entry actions" });
    expect(within(menu).getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Delete" }));
    expect(await screen.findByText("Entry deleted")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Blue Bottle, $6.50" })).not.toBeInTheDocument(); // gone at once
    expect(calls.some((c) => c.method === "DELETE")).toBe(false); // but not sent yet
    act(() => { vi.advanceTimersByTime(5300); });
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.url === "/api/entries/e1")).toBe(true));
    vi.useRealTimers();
  });

  it("a quick tap still opens the entry, and moving cancels the hold", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    signedInApi();
    renderApp("/app");
    const row = await rowOf();
    press(row, 200);
    dragTo(row, 150);
    act(() => { vi.advanceTimersByTime(600); });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    vi.useRealTimers();
    fireEvent.pointerUp(row, { pointerType: "touch", pointerId: 1 });
  });

  it("Undo brings the entry back and never sends the delete", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const calls = signedInApi({ "DELETE /api/entries/e1": { status: 204 } });
    renderApp("/app");
    const row = await rowOf();
    press(row, 300);
    dragTo(row, 200);
    fireEvent.pointerUp(row, { pointerType: "touch", pointerId: 1 });
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
    expect(await screen.findByRole("button", { name: "Blue Bottle, $6.50" })).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(6000); });
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    vi.useRealTimers();
  });

  it("swiping left reveals Delete, and tapping it deletes after the Undo window", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const calls = signedInApi({ "DELETE /api/entries/e1": { status: 204 } });
    renderApp("/app");
    const row = await rowOf();
    press(row, 300);
    dragTo(row, 200);
    fireEvent.pointerUp(row, { pointerType: "touch", pointerId: 1 });
    expect(row.style.transform || getComputedStyle(row).transform).toContain("-88px");
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    act(() => { vi.advanceTimersByTime(5300); });
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE")).toBe(true));
    vi.useRealTimers();
  });

  it("a short swipe snaps back and deletes nothing", async () => {
    const calls = signedInApi();
    renderApp("/app");
    const row = await rowOf();
    press(row, 300);
    dragTo(row, 280);
    fireEvent.pointerUp(row, { pointerType: "touch", pointerId: 1 });
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });
});

describe("My page", () => {
  it("shows the overview with per-currency totals", async () => {
    signedInApi();
    renderApp("/me");
    expect(await screen.findByRole("heading", { name: "My page" })).toBeInTheDocument();
    expect(await screen.findByText(/ of 1000$/)).toBeInTheDocument();
    expect(screen.getByText("₩9,000")).toBeInTheDocument();
    expect(screen.getByText("$6.50")).toBeInTheDocument();
    expect(screen.getByText("Oct 2, 2026")).toBeInTheDocument();
    expect(screen.getByText(/ of 30$/)).toBeInTheDocument();
    expect(screen.getAllByText(USER.email).length).toBeGreaterThan(0);
    expect(screen.getByText("me")).toBeInTheDocument(); // no display name yet: the part before the @
  });

  it("shows the danger zone as its own section", async () => {
    signedInApi();
    renderApp("/me");
    const zone = (await screen.findByRole("heading", { name: "Danger zone" })).closest("section")!;
    expect(within(zone).getByText("Deletes your account and every entry.")).toBeInTheDocument();
    expect(within(zone).getByRole("button", { name: "Delete my account" })).toBeInTheDocument();
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
    expect(await screen.findByText(/Guest account\. It deletes itself/)).toBeInTheDocument();
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
