import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import { Box, Button, Modal } from "@mui/material";
import { keyframes } from "@mui/material/styles";
import { useEffect, useMemo, useState } from "react";
import { useMonthlyStats } from "../api/entries";
import { categoryLabel, fill, formatMoney, formatMonth, formatMonthName, shiftMonth } from "../lib/format";
import { useReducedMotion } from "../lib/motion";
import { receiptToPng } from "../lib/receiptImage";
import type { ReceiptModel } from "../lib/receiptImage";
import { useI18n } from "../i18n";
import type { Lang } from "../i18n";
import { EASE_PRINT, MONO, SERIF, tokens } from "../theme";
import { Icon } from "./Icon";
import { useToast } from "./Toast";

const print = keyframes`
  from { clip-path: inset(0 0 100% 0); transform: translateY(-16px); }
  to { clip-path: inset(0 0 0 0); transform: none; }
`;
const rise = keyframes`from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; }`;
const TEETH = "linear-gradient(#000 0 0) top/100% calc(100% - 7px) no-repeat, conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) bottom/12px 8px repeat-x";

const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

/** "30 Nov 2026" / "2026. 11. 30." / "30-noyabr 2026": the last day of the month. */
function closingDate(month: string, lang: Lang): string {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (lang === "uz") return `${last}-${formatMonthName(month, lang)} ${y}`;
  const locale = lang === "ko" ? "ko-KR" : "en-GB";
  const opts: Intl.DateTimeFormatOptions = lang === "ko" ? { year: "numeric", month: "numeric", day: "numeric" } : { year: "numeric", month: "short", day: "numeric" };
  return new Intl.DateTimeFormat(locale, { ...opts, timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, last)));
}

/** The month-end receipt: the closed month printed on paper. Nothing is converted between currencies. */
export function MonthReceipt({ month, onClose }: { month: string; onClose: () => void }) {
  const { t, lang } = useI18n();
  const reduced = useReducedMotion();
  const toast = useToast();
  const p = tokens.light; // the paper stays paper in dark mode too
  const stats = useMonthlyStats(month, null);
  const before = useMonthlyStats(shiftMonth(month, -1), stats.data?.currency ?? null, !!stats.data);
  const [saving, setSaving] = useState(false);
  const data = stats.data;
  const empty = !!data && data.month === month && data.currencies.length === 0;

  useEffect(() => { if (empty) onClose(); }, [empty, onClose]);

  const model = useMemo<ReceiptModel | null>(() => {
    if (!data || data.month !== month || empty) return null;
    const upper = (s: string) => (lang === "ko" ? s : s.toLocaleUpperCase(lang === "uz" ? "en" : lang));
    const title = upper(formatMonth(month, lang).replace(",", ""));
    const money = (v: string | number, cur: string) => formatMoney(Number(v).toFixed(2), cur, lang);
    const entries = data.currencies.reduce((n, c) => n + c.count, 0);
    const top = data.by_category[0];
    const rows: [string, string][] = [
      [t("receipt.entries"), String(entries)],
      [t("receipt.days"), String(data.active_days ?? 0)],
    ];
    if (top) rows.push([t("receipt.top"), categoryLabel(t, top.category)]);
    let vs: [string, string] | null = null;
    const prev = before.data;
    if (prev && prev.month === shiftMonth(month, -1) && prev.currency === data.currency && prev.count > 0) {
      const diff = Number(data.total) - Number(prev.total);
      const sign = diff < 0 ? "−" : diff > 0 ? "+" : "";
      vs = [
        fill(t("receipt.vs"), { month: capitalize(formatMonthName(shiftMonth(month, -1), lang)), currency: data.currency }),
        `${sign}${money(Math.abs(diff), data.currency)}`,
      ];
    }
    return {
      heading: [title, upper(t("receipt.title"))],
      rows,
      totalsTitle: upper(t("receipt.totals")),
      totals: data.currencies.map((c) => [c.currency, money(c.total, c.currency)] as [string, string]),
      vs,
      closed: fill(t("receipt.closed"), { date: closingDate(month, lang) }),
    };
  }, [data, before.data, month, lang, t, empty]);

  async function save() {
    if (!model || saving) return;
    setSaving(true);
    try {
      const blob = await receiptToPng(model);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `parsimony-receipt-${month}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast({ message: t("receipt.saveError"), icon: "alert" });
    } finally {
      setSaving(false);
    }
  }

  if (!model) return null;
  const dash = <Box sx={{ borderTop: `1.5px dashed ${p.paperLine}`, my: 3 }} />;
  const row = (label: string, value: string, big = false, key?: string) => (
    <Box key={key ?? label} sx={{ display: "flex", justifyContent: "space-between", gap: 3, fontVariantNumeric: "tabular-nums", ...(big ? { fontSize: 15, lineHeight: "24px", fontWeight: 500 } : {}) }}>
      <span>{label}</span>
      <span style={{ textAlign: "right" }}>{value}</span>
    </Box>
  );

  return (
    <Modal open onClose={onClose} slotProps={{ backdrop: { sx: { bgcolor: tokens.dark.scrim } } }}>
      <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3.5, p: 6, outline: "none", overflowY: "auto" }}>
        <Box sx={{ filter: "drop-shadow(0 12px 28px rgba(0,0,0,.28))", width: "100%", maxWidth: 300, ...(reduced ? {} : { animation: `${print} 520ms ${EASE_PRINT} both` }) }}>
          <Box
            role="dialog" aria-modal="true" aria-label={model.heading[1]}
            sx={{
              bgcolor: p.paper, color: p.paperInk, font: `13px/20px ${MONO}`, p: "22px 20px 26px",
              mask: TEETH, WebkitMask: TEETH,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, mb: 2 }}>
              <Box component="img" src="/icon.svg" alt="" width={40} height={40} sx={{ display: "block" }} />
              <Box component="span" sx={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 500, fontSize: 22, lineHeight: 1, color: p.paperInk }}>
                Parsimony<Box component="span" sx={{ color: "#1F6F5C" }}>.</Box>
              </Box>
            </Box>
            <Box sx={{ textAlign: "center" }}>{model.heading[0]}<br />{model.heading[1]}</Box>
            {dash}
            {model.rows.map(([a, b]) => row(a, b))}
            {dash}
            <Box sx={{ fontSize: 11, letterSpacing: "0.1em", color: p.paperMuted, mb: 0.5 }}>{model.totalsTitle}</Box>
            {model.totals.map(([a, b]) => row(a, b, true))}
            {dash}
            {model.vs && row(model.vs[0], model.vs[1])}
            <Box sx={{ textAlign: "center", fontSize: 11, color: p.paperMuted, mt: 2 }}>{model.closed}</Box>
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 3, ...(reduced ? {} : { animation: `${rise} 220ms ${EASE_PRINT} 400ms both` }) }}>
          <Button variant="outlined" onClick={onClose} sx={{ bgcolor: "background.paper", "&:hover": { bgcolor: "background.paper" } }}>{t("receipt.close")}</Button>
          <Button variant="contained" onClick={save} disabled={saving} startIcon={<Icon name="upload" size={18} />}>{t("receipt.save")}</Button>
        </Box>
      </Box>
    </Modal>
  );
}
