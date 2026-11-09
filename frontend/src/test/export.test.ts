import { describe, expect, it } from "vitest";
import { entriesToCsv } from "../lib/export";
import { ENTRY } from "./helpers";

const labels = { header: ["date", "merchant", "note", "amount", "currency", "category", "payment", "source"], category: (c: string) => c, payment: (p: string) => p };

describe("CSV export", () => {
  it("writes a header and one line per entry, oldest first, with money kept as text", () => {
    const older = { ...ENTRY, id: "a", date: "2026-11-01", merchant: "Kimbap House", note: null, amount: "4.00" };
    const csv = entriesToCsv([ENTRY, older], labels);
    const lines = csv.trimEnd().split("\r\n");
    expect(lines[0]).toBe("date,merchant,note,amount,currency,category,payment,source");
    expect(lines[1]).toBe("2026-11-01,Kimbap House,,4.00,USD,food_drink,card,text");
    expect(lines[2].startsWith("2026-11-08,Blue Bottle,with Sam,6.50")).toBe(true);
  });

  it("quotes commas and quotes, and defuses spreadsheet formulas", () => {
    const e = { ...ENTRY, merchant: '=HYPERLINK("x")', note: 'milk, "big"' };
    const line = entriesToCsv([e], labels).split("\r\n")[1];
    expect(line).toContain(`"'=HYPERLINK(""x"")"`);
    expect(line).toContain('"milk, ""big"""');
  });
});
