import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { Entry } from "../api/types";
import { useI18n } from "../i18n";
import { categoryLabel, formatDay, formatMoney, formatMonth, paymentLabel } from "../lib/format";

/** A plain, print-friendly copy of the month. The browser's print dialog turns it into a PDF ("Save as PDF"),
 * which keeps Korean and Uzbek text correct without shipping a font or a PDF library. */
export function PrintReport({ month, entries, onDone }: { month: string; entries: Entry[]; onDone: () => void }) {
  const { t, lang } = useI18n();

  useEffect(() => {
    const done = () => onDone();
    window.addEventListener("afterprint", done);
    const id = window.setTimeout(() => window.print(), 50); // let the report render first
    return () => { window.clearTimeout(id); window.removeEventListener("afterprint", done); };
  }, [onDone]);

  const rows = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at));
  const totals = new Map<string, number>();
  for (const e of rows) totals.set(e.currency, (totals.get(e.currency) ?? 0) + Number(e.amount));
  const money = (n: number, cur: string) => formatMoney((Math.round(n * 100) / 100).toFixed(2), cur, lang);

  return createPortal(
    <div id="print-root">
      <style>{`
        #print-root { display: none; }
        @media print {
          #root { display: none !important; }
          #print-root { display: block; color: #1F2421; background: #fff; font: 12px/1.5 "Inter Variable", "Noto Sans KR", system-ui, sans-serif; }
          #print-root h1 { font-size: 20px; margin: 0 0 4px; }
          #print-root .sub { color: #5B605C; margin: 0 0 14px; }
          #print-root table { width: 100%; border-collapse: collapse; }
          #print-root th { text-align: left; border-bottom: 1.5px solid #1F2421; padding: 4px 6px; }
          #print-root td { border-bottom: 1px solid #E9E4DA; padding: 4px 6px; vertical-align: top; }
          #print-root .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
          #print-root tr { break-inside: avoid; }
          @page { margin: 14mm; }
        }
      `}</style>
      <h1>Parsimony · {formatMonth(month, lang)}</h1>
      <p className="sub">
        {[...totals].map(([cur, sum]) => `${t("export.total")} ${money(sum, cur)}`).join("  ·  ")}
        {"  ·  "}{rows.length}
      </p>
      <table>
        <thead>
          <tr>
            <th>{t("export.date")}</th><th>{t("export.merchant")}</th><th>{t("export.note")}</th>
            <th>{t("export.category")}</th><th>{t("export.payment")}</th><th className="num">{t("export.amount")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td>{formatDay(e.date, lang)}</td><td>{e.merchant ?? ""}</td><td>{e.note ?? ""}</td>
              <td>{categoryLabel(t, e.category)}</td><td>{paymentLabel(t, e.payment_method)}</td>
              <td className="num">{formatMoney(e.amount, e.currency, lang)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>,
    document.body,
  );
}
