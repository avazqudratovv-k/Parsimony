import { Alert, Box, Button, Paper, Skeleton, Typography, useMediaQuery } from "@mui/material";
import { useEffect, useState } from "react";
import type { MonthlyStats } from "../api/types";
import { categoryLabel, fill, formatMoney, formatMonthName, formatShare } from "../lib/format";
import { useI18n } from "../i18n";
import type { TFn } from "../i18n";
import { useReducedMotion, useRolling } from "../lib/motion";
import { catTint, DESKTOP, EASE_OUT, SERIF, useMode, useTokens } from "../theme";
import { CategoryIcon } from "./CategoryIcon";
import { Icon } from "./Icon";

const TOP_N = 5;
const countText = (t: TFn, n: number) => fill(t(n === 1 ? "chart.count.one" : "chart.count.other"), { count: n });

type Props = {
  month: string;
  onReceipt?: () => void; // past months only: reopen that month's receipt
  data: MonthlyStats | undefined;
  previous: MonthlyStats | undefined;
  isPending: boolean;
  isError: boolean;
};

// Spending by category for one month in one currency: the biggest bar in the accent colour, the rest quieter.
// Every bar prints its amount and share, so colour never carries meaning alone.
/** One bar: it grows to its length when it appears and glides when the month or currency changes. */
function Bar({ percent, color }: { percent: number; color: string }) {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(reduced ? percent : 0);
  useEffect(() => {
    if (reduced) { setWidth(percent); return; }
    const frame = requestAnimationFrame(() => setWidth(percent));
    return () => cancelAnimationFrame(frame);
  }, [percent, reduced]);
  const c = useTokens();
  return (
    <Box sx={{ gridColumn: "2 / 4", height: 8, borderRadius: "4px", bgcolor: c.sunken, overflow: "hidden" }}>
      <Box sx={{ height: "100%", width: `${width}%`, borderRadius: "4px", bgcolor: color, transition: reduced ? "none" : `width 300ms ${EASE_OUT}` }} />
    </Box>
  );
}

export function CategoryChart({ month, onReceipt, data, previous, isPending, isError }: Props) {
  const { t, lang } = useI18n();
  const c = useTokens();
  const { scheme } = useMode();
  const rolled = useRolling(data ? Number(data.total) : 0);
  const desktop = useMediaQuery(DESKTOP);
  const [expanded, setExpanded] = useState(false);

  const shell = (children: React.ReactNode) => (
    <Paper
      variant="outlined" component="section" aria-label={t("chart.title")}
      sx={{
        p: 4, borderRadius: 3,
        // The card ends in a torn receipt edge: a straight mask above, a row of 14 x 9 px teeth below.
        borderBottom: 0, pb: "calc(16px + 8px)",
        mask: "linear-gradient(#000 0 0) top/100% calc(100% - 9px) no-repeat, conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) bottom/14px 9px repeat-x",
        WebkitMask: "linear-gradient(#000 0 0) top/100% calc(100% - 9px) no-repeat, conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) bottom/14px 9px repeat-x",
      }}
    >
      {children}
    </Paper>
  );

  if (isError && !data) return shell(<Alert severity="error">{t("chart.error")}</Alert>);
  if (isPending || !data) return shell(<Skeleton variant="rounded" height={200} />);

  const money = (amount: string | number) => formatMoney(String(amount), data.currency, lang);
  const total = Number(data.total);
  const rows = data.by_category.map((r) => ({ ...r, value: Number(r.total) }));
  const max = rows[0]?.value ?? 0;
  const shown = desktop || expanded ? rows : rows.slice(0, TOP_N);
  const hidden = rows.length - TOP_N;

  let delta: string | null = null;
  if (previous && previous.currency === data.currency && previous.count > 0) {
    const diff = total - Number(previous.total);
    delta =
      diff === 0
        ? t("chart.delta.same")
        : fill(t(diff < 0 ? "chart.delta.less" : "chart.delta.more"), { amount: money(Math.abs(diff).toFixed(2)) });
  }

  return shell(
    <>
      <Box sx={{ mb: 4 }}>
        <Typography variant="caption" sx={{ display: "block", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase", color: "text.secondary" }}>
          {fill(t("chart.eyebrow"), { month: formatMonthName(month, lang), currency: data.currency })}
        </Typography>
        <Typography sx={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 500, fontSize: 38, lineHeight: "42px", letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>
          {money(rolled.toFixed(2))}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontVariantNumeric: "tabular-nums" }}>
          {[countText(t, data.count), delta].filter(Boolean).join(" · ")}
        </Typography>
      </Box>

      {rows.length === 0 ? (
        <Typography color="text.secondary">{t("chart.empty")}</Typography>
      ) : (
        <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          {shown.map((r, i) => (
            <Box
              component="li"
              key={r.category}
              sx={{ display: "grid", gridTemplateColumns: "20px 1fr auto", columnGap: 2, rowGap: "6px", alignItems: "center" }}
            >
              <Box sx={{ color: catTint(scheme, r.category).fg, display: "flex" }}><CategoryIcon category={r.category} tile={false} size={18} /></Box>
              <Typography sx={{ fontSize: 14, lineHeight: "20px" }}>{categoryLabel(t, r.category)}</Typography>
              <Typography sx={{ fontSize: 14, lineHeight: "20px", fontWeight: 500, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                <Box component="span" sx={{ color: "text.secondary", fontWeight: 400, mr: 2 }}>{formatShare(r.value, total)}</Box>
                {money(r.total)}
              </Typography>
              <Bar percent={max > 0 ? (r.value / max) * 100 : 0} color={i === 0 ? c.accent : c.chartBar} />
            </Box>
          ))}
        </Box>
      )}

      {onReceipt && (
        <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${c.line}`, display: "flex", justifyContent: "flex-end" }}>
          <Button size="small" onClick={onReceipt} startIcon={<Icon name="bills" size={16} />} sx={{ minHeight: 44, my: -1, mr: -3 }}>
            {t("receipt.open")}
          </Button>
        </Box>
      )}

      {!desktop && hidden > 0 && (
        <Box sx={{ mt: 4, pt: 3, borderTop: `1px solid ${c.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "text.secondary" }}>
          <span>{expanded ? "" : fill(t(hidden === 1 ? "chart.more.one" : "chart.more.other"), { count: hidden })}</span>
          <Button size="small" onClick={() => setExpanded((v) => !v)} sx={{ minHeight: 44, my: -3, mr: -3 }}>
            {t(expanded ? "chart.showFewer" : "chart.showAll")}
          </Button>
        </Box>
      )}
    </>,
  );
}
