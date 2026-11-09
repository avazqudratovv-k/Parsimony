import type { Entry } from "../api/types";

/** Cells that start with = + - @ would run as formulas in Excel; a leading apostrophe keeps them plain text. */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export type CsvLabels = { header: string[]; category: (c: string) => string; payment: (p: string) => string };

/** The month's entries as CSV text. Amounts stay as written ("6.50"), never rounded. */
export function entriesToCsv(entries: Entry[], labels: CsvLabels): string {
  const rows = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at));
  const lines = [labels.header.map(cell).join(",")];
  for (const e of rows) {
    lines.push(
      [e.date, e.merchant ?? "", e.note ?? "", e.amount, e.currency, labels.category(e.category), labels.payment(e.payment_method), e.source]
        .map(cell).join(","),
    );
  }
  return lines.join("\r\n") + "\r\n";
}

/** Saves text as a file. The BOM makes Excel read Korean and Uzbek letters correctly. */
export function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob(["﻿", text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
