import { describe, expect, it } from "vitest";
import { currentMonth, formatDate, formatMonth, shiftMonth } from "../lib/format";

describe("month helpers", () => {
  it("shifts across year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-11", 0)).toBe("2026-11");
  });

  it("uses the user's time zone to decide what 'this month' is", () => {
    const lateOnThe30th = new Date("2026-11-30T20:00:00Z"); // already Dec 1 in Seoul
    expect(currentMonth("Asia/Seoul", lateOnThe30th)).toBe("2026-12");
    expect(currentMonth("America/New_York", lateOnThe30th)).toBe("2026-11");
  });

  it("falls back to UTC for an unknown time zone", () => {
    expect(currentMonth("Not/AZone", new Date("2026-11-09T03:00:00Z"))).toBe("2026-11");
  });

  it("names months in each language, including Uzbek", () => {
    expect(formatMonth("2026-11", "en")).toBe("November 2026");
    expect(formatMonth("2026-11", "ko")).toBe("2026년 11월");
    expect(formatMonth("2026-11", "uz")).toBe("Noyabr 2026");
    expect(formatDate("2026-11-09", "uz")).toBe("9 noy");
    expect(formatDate("2026-11-09", "uz", true)).toBe("9 noy 2026");
  });
});

describe("money and day formats", () => {
  it("writes Uzbek money with the symbol after and a decimal comma", async () => {
    const { formatMoney } = await import("../lib/format");
    expect(formatMoney("669400.00", "KRW", "uz")).toBe("669 400 ₩");
    expect(formatMoney("6.50", "USD", "uz")).toBe("6,50 $");
    expect(formatMoney("6.50", "USD", "en")).toBe("$6.50");
  });

  it("writes day headers the way the design shows them", async () => {
    const { formatDay, formatShare } = await import("../lib/format");
    expect(formatDay("2026-11-09", "en")).toBe("Mon 9 Nov");
    expect(formatDay("2026-11-09", "ko")).toBe("11월 9일 (월)");
    expect(formatDay("2026-11-09", "uz")).toBe("9-noyabr, dushanba");
    expect(formatShare(1, 400)).toBe("1%"); // never 0% for a real amount
    expect(formatShare(28, 100)).toBe("28%");
  });
});
