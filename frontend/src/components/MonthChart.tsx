import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { Alert, Box, IconButton, Paper, Skeleton, Tab, Tabs, Typography } from "@mui/material";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useMonthlyStats } from "../api/entries";
import { categoryLabel, currentMonth, fill, formatMoney, formatMonth, shiftMonth } from "../lib/format";
import { useI18n } from "../i18n";
import type { TFn } from "../i18n";
import { tokens } from "../theme";
import { useTheme } from "@mui/material/styles";

// Hidden on screen, still read by screen readers.
const visuallyHidden = {
  position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap",
} as const;

type Props = {
  month: string;
  currency: string | null;
  timeZone: string;
  onMonth: (month: string) => void;
  onCurrency: (currency: string) => void;
};

const countText = (t: TFn, n: number) => fill(t(n === 1 ? "chart.count.one" : "chart.count.other"), { count: n });

export function MonthChart({ month, currency, timeZone, onMonth, onCurrency }: Props) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const c = tokens[theme.palette.mode];
  const { data, isError, isPending } = useMonthlyStats(month, currency);
  const isCurrent = month >= currentMonth(timeZone);

  const rows = (data?.by_category ?? []).map((r) => ({
    key: r.category,
    name: categoryLabel(t, r.category),
    value: Number(r.total),
    total: r.total,
    count: r.count,
  }));
  const money = (amount: string) => formatMoney(amount, data?.currency ?? "USD", lang);

  return (
    <Paper variant="outlined" component="section" aria-label={t("chart.title")} sx={{ p: { xs: 4, sm: 5 }, borderRadius: 3, mt: 4, mb: 4 }}>
      {/* Month controls */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <IconButton aria-label={t("month.prev")} onClick={() => onMonth(shiftMonth(month, -1))} sx={{ width: 44, height: 44 }}>
          <ChevronLeftIcon />
        </IconButton>
        <Typography variant="h3" component="h2" aria-live="polite">{formatMonth(month, lang)}</Typography>
        <IconButton aria-label={t("month.next")} onClick={() => onMonth(shiftMonth(month, 1))} disabled={isCurrent} sx={{ width: 44, height: 44 }}>
          <ChevronRightIcon />
        </IconButton>
      </Box>

      {isError && !data ? (
        <Alert severity="error">{t("chart.error")}</Alert>
      ) : isPending || !data ? (
        <Skeleton variant="rounded" height={180} />
      ) : (
        <>
          {/* Currency tabs: change only the chart. Hidden when the month uses a single currency. */}
          {data.currencies.length > 1 && (
            <Tabs value={data.currency} onChange={(_, v: string) => onCurrency(v)} variant="scrollable" scrollButtons={false} aria-label={t("chart.currency")} sx={{ mb: 3, minHeight: 40 }}>
              {data.currencies.map((cu) => <Tab key={cu.currency} value={cu.currency} label={cu.currency} sx={{ minHeight: 40, minWidth: 64 }} />)}
            </Tabs>
          )}

          <Box sx={{ display: "flex", alignItems: "baseline", gap: 2, mb: 3, flexWrap: "wrap" }}>
            <Typography variant="body2" color="text.secondary">{t("chart.total")}</Typography>
            <Typography sx={{ fontSize: 28, lineHeight: "34px", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{money(data.total)}</Typography>
            <Typography variant="body2" color="text.secondary">{countText(t, data.count)}</Typography>
          </Box>

          {rows.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 4 }}>{t("chart.empty")}</Typography>
          ) : (
            <>
              {/* One hue, thin bars with rounded data ends, labels on the left, values on the right. */}
              <Box aria-hidden sx={{ width: "100%", height: rows.length * 36 + 8 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 76, bottom: 0, left: 0 }} barCategoryGap={12}>
                    <XAxis type="number" hide domain={[0, "dataMax"]} />
                    <YAxis type="category" dataKey="name" width={104} tickLine={false} axisLine={false} tick={{ fill: c.inkMuted, fontSize: 13 }} />
                    <Tooltip
                      cursor={{ fill: c.sunken }}
                      content={({ active, payload }) => {
                        const row = payload?.[0]?.payload as (typeof rows)[number] | undefined;
                        if (!active || !row) return null;
                        return (
                          <Box sx={{ bgcolor: c.surface, color: c.ink, border: `1px solid ${c.line}`, borderRadius: 2, px: 3, py: 2, fontSize: 13 }}>
                            <Box sx={{ fontWeight: 600 }}>{row.name}</Box>
                            <Box>{money(row.total)} · {countText(t, row.count)}</Box>
                          </Box>
                        );
                      }}
                    />
                    <Bar dataKey="value" barSize={10} radius={[0, 4, 4, 0]} isAnimationActive={false} label={false}>
                      {rows.map((r) => <Cell key={r.key} fill={c.accent} />)}
                      <LabelList dataKey="total" position="right" offset={8} formatter={(v: unknown) => money(String(v))} fill={c.ink} fontSize={13} fontWeight={600} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
              {/* The same numbers as a plain table, hidden on screen: what screen readers (and the tests) read. */}
              <Box component="table" sx={visuallyHidden} aria-label={t("chart.table")}>
                <thead>
                  <tr><th scope="col">{t("fix.category")}</th><th scope="col">{t("chart.amount")}</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <Box component="tr" key={r.key}>
                      <Box component="th" scope="row" sx={{ textAlign: "left", fontWeight: 400, color: "text.secondary", py: 0.5 }}>{r.name}</Box>
                      <Box component="td" sx={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, py: 0.5 }}>{money(r.total)}</Box>
                    </Box>
                  ))}
                </tbody>
              </Box>
            </>
          )}
        </>
      )}
    </Paper>
  );
}
