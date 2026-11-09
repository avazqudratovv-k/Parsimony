import { describe, expect, it } from "vitest";
import { ApiError, api } from "../api/client";
import { mockApi } from "./helpers";

describe("api client", () => {
  it("parses a structured 429 detail", async () => {
    mockApi({
      "POST /api/x": {
        status: 429,
        body: { detail: { code: "daily_limit_account", message: "used up", resets_at: "2026-11-10T00:00:00Z" } },
      },
    });
    const err = await api("/x", { method: "POST", body: {} }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 429, code: "daily_limit_account", resetsAt: "2026-11-10T00:00:00Z" });
  });

  it("parses a plain string detail", async () => {
    mockApi({ "GET /api/x": { status: 401, body: { detail: "Not signed in" } } });
    const err = await api("/x").catch((e) => e);
    expect(err).toMatchObject({ status: 401, message: "Not signed in" });
  });

  it("turns a network failure into ApiError status 0", async () => {
    const { vi } = await import("vitest");
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("failed");
    });
    const err = await api("/x").catch((e) => e);
    expect(err).toMatchObject({ status: 0, code: "network" });
  });

  it("returns undefined for 204", async () => {
    mockApi({ "POST /api/auth/logout": { status: 204 } });
    await expect(api("/auth/logout", { method: "POST" })).resolves.toBeUndefined();
  });
});
