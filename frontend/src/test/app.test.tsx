import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { USER, mockApi, renderApp } from "./helpers";

const signedOut = { "GET /api/auth/me": { status: 401, body: { detail: "Not signed in" } } };

describe("routing", () => {
  it("shows the sign-in page when signed out", async () => {
    mockApi(signedOut);
    renderApp("/");
    expect(await screen.findByRole("heading", { name: "Track spending without the typing" })).toBeInTheDocument();
  });

  it("sends a signed-out visitor from /app back to /", async () => {
    mockApi(signedOut);
    const { router } = renderApp("/app");
    await screen.findByRole("button", { name: "Try demo" });
    expect(router.state.location.pathname).toBe("/");
  });

  it("sends a signed-in visitor from / to /app", async () => {
    mockApi({ "GET /api/auth/me": { status: 200, body: USER } });
    const { router } = renderApp("/");
    await screen.findByRole("heading", { name: "Your expenses" });
    expect(router.state.location.pathname).toBe("/app");
  });

  it("shows a 404 page for unknown paths", async () => {
    mockApi(signedOut);
    renderApp("/nope");
    expect(await screen.findByText("Page not found")).toBeInTheDocument();
  });
});

describe("sign-in page", () => {
  it("validates before calling the server", async () => {
    const calls = mockApi(signedOut);
    renderApp("/");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Create account" }));
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Use at least 8 characters.")).toBeInTheDocument();
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  it("signs up with the browser timezone and lands on /app", async () => {
    const calls = mockApi({
      ...signedOut,
      "POST /api/auth/signup": { status: 201, body: USER },
    });
    const { router } = renderApp("/");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Email"), "me@example.com");
    await user.type(screen.getByLabelText("Password"), "correct horse battery");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/app"));
    const post = calls.find((c) => c.url === "/api/auth/signup")!;
    expect(post.body).toMatchObject({ email: "me@example.com", password: "correct horse battery" });
    expect(typeof (post.body as { timezone: string }).timezone).toBe("string");
  });

  it("shows a friendly message for a wrong password", async () => {
    mockApi({ ...signedOut, "POST /api/auth/login": { status: 401, body: { detail: "Wrong email or password" } } });
    renderApp("/");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "Log in" }));
    await user.type(screen.getByLabelText("Email"), "me@example.com");
    await user.type(screen.getByLabelText("Password"), "nope");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Wrong email or password.");
  });

  it("tells the user when the email is taken", async () => {
    mockApi({ ...signedOut, "POST /api/auth/signup": { status: 409, body: { detail: "Email already registered" } } });
    renderApp("/");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Email"), "me@example.com");
    await user.type(screen.getByLabelText("Password"), "long enough pw");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already registered");
  });

  it("Try demo starts a demo and shows the banner", async () => {
    mockApi({
      ...signedOut,
      "POST /api/auth/demo": { status: 201, body: { ...USER, is_demo: true, email: "demo-1@demo.invalid" } },
    });
    const { router } = renderApp("/");
    await userEvent.setup().click(await screen.findByRole("button", { name: "Try demo" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/app"));
    expect(await screen.findByRole("note")).toHaveTextContent("Demo data only");
  });

  it("says so when the demo is full", async () => {
    mockApi({ ...signedOut, "POST /api/auth/demo": { status: 503, body: { detail: "full" } } });
    renderApp("/");
    await userEvent.setup().click(await screen.findByRole("button", { name: "Try demo" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("demo is full");
  });

  it("logs out and goes back to /", async () => {
    mockApi({
      "GET /api/auth/me": { status: 200, body: USER },
      "POST /api/auth/logout": { status: 204 },
    });
    const { router } = renderApp("/app");
    await userEvent.setup().click(await screen.findByRole("button", { name: "Log out" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });
});

describe("language and theme", () => {
  it("switches to Korean and Uzbek and remembers the choice", async () => {
    mockApi(signedOut);
    renderApp("/");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Change language" }));
    await user.click(screen.getByRole("menuitemradio", { name: /한국어/ }));
    expect(await screen.findByRole("heading", { name: "타이핑 없이 지출을 기록하세요" })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("ko");
    expect(localStorage.getItem("parsimony.lang")).toBe("ko");

    await user.click(screen.getByRole("button", { name: "언어 변경" }));
    await user.click(screen.getByRole("menuitemradio", { name: /Oʻzbekcha/ }));
    expect(await screen.findByRole("heading", { name: "Xarajatlarni yozmasdan kuzating" })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("uz");
  });

  it("cycles the theme and sets it on the page", async () => {
    mockApi(signedOut);
    renderApp("/");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Colour theme: System/ }));
    expect(document.documentElement.dataset.theme).toBe("light");
    await user.click(screen.getByRole("button", { name: /Colour theme: Light/ }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("parsimony.theme")).toBe("dark");
  });
});

describe("brand", () => {
  it("shows a capital-P wordmark that links home", async () => {
    mockApi({ "GET /api/auth/me": { status: 200, body: USER } });
    renderApp("/app");
    const link = await screen.findByRole("link", { name: "Parsimony" });
    expect(link).toHaveAttribute("href", "/");
    expect(link).toHaveTextContent("Parsimony.");
  });
});
