import { Alert, Box, Button, Skeleton, Typography, useMediaQuery } from "@mui/material";
import type { UseQueryResult } from "@tanstack/react-query";
import type { Entry } from "../api/types";
import type { Lang } from "../i18n";
import {
  LOW_CONFIDENCE, currentDate, fill, formatDay, formatMoney, formatTime, paymentLabel, shiftDate,
} from "../lib/format";
import { useI18n } from "../i18n";
import { DESKTOP, useTokens } from "../theme";
import { CategoryIcon } from "./CategoryIcon";
import { Icon } from "./Icon";

// One day's total per currency, e.g. "$54.70" or "₩15,000 + $18.00" when a day mixes currencies.
function dayTotal(items: Entry[], lang: Lang): string {
  const sums = new Map<string, number>();
  for (const e of items) sums.set(e.currency, (sums.get(e.currency) ?? 0) + Number(e.amount));
  return [...sums].map(([cur, sum]) => formatMoney((Math.round(sum * 100) / 100).toFixed(2), cur, lang)).join(" + ");
}

const SOURCE_ICON = { text: "keyboard", voice: "mic", photo: "camera" } as const;

function EntryRow({ entry, timeZone, desktop, onOpen }: { entry: Entry; timeZone: string; desktop: boolean; onOpen: () => void }) {
  const { t, lang } = useI18n();
  const c = useTokens();
  const checkThis = entry.confidence < LOW_CONFIDENCE && !entry.user_corrected;
  const title = entry.merchant ?? entry.note ?? t("entry.noMerchant");
  const meta = [
    entry.merchant ? entry.note : null,
    entry.payment_method !== "unknown" ? paymentLabel(t, entry.payment_method) : null,
    formatTime(entry.created_at, timeZone),
  ].filter(Boolean) as string[];
  const source = (entry.source in SOURCE_ICON ? entry.source : "text") as keyof typeof SOURCE_ICON;
  const amount = formatMoney(entry.amount, entry.currency, lang);

  return (
    <Box
      component="li"
      sx={{
        display: "flex", alignItems: "center", gap: 2, minHeight: 64, px: 4, py: 3, borderTop: `1px solid ${c.line}`,
        "&:first-of-type": { borderTop: 0 }, bgcolor: checkThis ? c.warnWash : "transparent",
      }}
    >
      <Box
        component="button"
        type="button"
        onClick={onOpen}
        aria-label={`${title}, ${amount}`}
        sx={{
          all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, flex: 1, minWidth: 0, borderRadius: 1.5,
          "&:focus-visible": { outline: `2px solid ${c.focus}`, outlineOffset: 2 },
        }}
      >
        <CategoryIcon category={entry.category} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5, minWidth: 0 }}>
            <Typography noWrap sx={{ fontWeight: 500 }}>{title}</Typography>
            {entry.user_corrected && (
              <Box component="span" sx={{ flex: "none", display: "inline-flex", alignItems: "center", gap: "3px", fontSize: 12, fontStyle: "italic", color: c.inkMuted }}>
                <Icon name="edit" size={12} />
                {t("entry.edited")}
              </Box>
            )}
          </Box>
          <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: "2px" }}>{meta.join(" · ")}</Typography>
        </Box>
        <Box sx={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
          <Typography sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{amount}</Typography>
          {checkThis ? (
            <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1, fontSize: 12, fontWeight: 600, color: c.warn }}>
              <Icon name="alert" size={14} />
              {t("entry.checkThis")}
            </Box>
          ) : (
            <Box
              component="span"
              sx={{
                display: "inline-flex", alignItems: "center", gap: 1, height: 20, px: 1.5, borderRadius: "6px", border: `1px solid ${c.line}`,
                fontSize: 12, fontWeight: 500, color: c.inkMuted, bgcolor: c.bg,
              }}
            >
              <Icon name={SOURCE_ICON[source]} size={12} />
              {t(`source.${source}` as const)}
            </Box>
          )}
        </Box>
      </Box>
      {desktop && (
        <Button
          onClick={onOpen}
          aria-label={`${t("entry.fix")}: ${title}`}
          startIcon={<Icon name="edit" size={16} />}
          sx={{ minHeight: 44, flexShrink: 0, fontWeight: 500, fontSize: 13, "&:hover": { bgcolor: "transparent", boxShadow: `inset 0 0 0 1px ${c.lineStrong}` } }}
        >
          {t("entry.fix")}
        </Button>
      )}
    </Box>
  );
}

type Props = {
  query: UseQueryResult<Entry[]>;
  month: string;
  isCurrentMonth: boolean;
  timeZone: string;
  onOpen: (id: string) => void;
};

// The month's entries, grouped by day (newest first), each day with its own header.
export function EntryList({ query, isCurrentMonth, timeZone, onOpen }: Props) {
  const { t, lang } = useI18n();
  const c = useTokens();
  const desktop = useMediaQuery(DESKTOP);
  const { data, isPending, isError, refetch } = query;

  if (isPending) {
    return (
      <Box aria-busy sx={{ display: "grid", gap: 3, mt: 4 }}>
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={56} />)}
      </Box>
    );
  }
  if (isError) {
    return (
      <Alert severity="error" sx={{ mt: 4 }} action={<Button color="inherit" onClick={() => refetch()}>{t("list.retry")}</Button>}>
        {t("list.error")}
      </Alert>
    );
  }
  if (data.length === 0 && !isCurrentMonth) {
    return <Typography color="text.secondary" sx={{ textAlign: "center", py: 8 }}>{t("list.empty.month")}</Typography>;
  }
  if (data.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 10, px: 6 }}>
        <Box
          aria-hidden
          sx={{
            width: 72, height: 72, mx: "auto", mb: 4, borderRadius: 5, border: `1px solid ${c.lineStrong}`, position: "relative",
            background: `repeating-linear-gradient(${c.surface} 0 15px, ${c.line} 15px 16px)`,
            "&::before": { content: '""', position: "absolute", top: 0, bottom: 0, left: "18px", width: "1px", bgcolor: c.accent },
          }}
        />
        <Typography variant="h2" component="h2" sx={{ mb: 1 }}>{t("list.empty.title")}</Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 280, mx: "auto" }}>{t("list.empty.body")}</Typography>
      </Box>
    );
  }

  const today = currentDate(timeZone);
  const yesterday = shiftDate(today, -1);
  const groups: { date: string; items: Entry[] }[] = [];
  for (const e of data) {
    const last = groups[groups.length - 1];
    if (last && last.date === e.date) last.items.push(e);
    else groups.push({ date: e.date, items: [e] });
  }

  return (
    <Box sx={{ mx: { xs: -4, lg: 0 } }}>
      {groups.map((g) => {
        const label = g.date === today ? t("day.today") : g.date === yesterday ? t("day.yesterday") : null;
        const count = g.items.length;
        return (
          <section key={g.date}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", px: 4, pt: 5, pb: 2, fontSize: 13, lineHeight: "18px", color: c.inkMuted }}>
              <span>
                {label && <><strong style={{ color: c.ink, fontWeight: 600 }}>{label}</strong> · </>}
                {label ? formatDay(g.date, lang) : <strong style={{ color: c.ink, fontWeight: 600 }}>{formatDay(g.date, lang)}</strong>}
              </span>
              <span style={{ textAlign: "right" }}>
                {fill(t(count === 1 ? "chart.count.one" : "chart.count.other"), { count })}
                {" · "}
                <strong style={{ color: c.ink, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {fill(t("day.total"), { amount: dayTotal(g.items, lang) })}
                </strong>
              </span>
            </Box>
            <Box
              component="ul"
              sx={{
                listStyle: "none", m: 0, p: 0, bgcolor: c.surface, borderTop: `1px solid ${c.line}`, borderBottom: `1px solid ${c.line}`,
                ...(desktop ? { border: `1px solid ${c.line}`, borderRadius: 3, overflow: "hidden" } : {}),
              }}
            >
              {g.items.map((entry) => (
                <EntryRow key={entry.id} entry={entry} timeZone={timeZone} desktop={desktop} onOpen={() => onOpen(entry.id)} />
              ))}
            </Box>
          </section>
        );
      })}
    </Box>
  );
}

