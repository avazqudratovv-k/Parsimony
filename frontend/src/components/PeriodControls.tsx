import { Box, IconButton, Typography } from "@mui/material";
import type { CurrencyTotal } from "../api/types";
import { formatMonth } from "../lib/format";
import { useI18n } from "../i18n";
import { SERIF, useTokens } from "../theme";
import { Icon } from "./Icon";

type Props = {
  month: string;
  thisMonth: string;
  onMonth: (month: string) => void;
  currencies: CurrencyTotal[];
  currency: string | null;
  onCurrency: (currency: string) => void;
  onPrev: () => void;
  onNext: () => void;
};

// Month switcher and currency tabs. The tabs only pick which currency the chart totals; nothing is converted.
export function PeriodControls({ month, thisMonth, currencies, currency, onCurrency, onPrev, onNext }: Props) {
  const { t, lang } = useI18n();
  const c = useTokens();
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 2, lg: 6 }, flexWrap: "wrap" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <IconButton aria-label={t("month.prev")} onClick={onPrev} sx={{ width: 44, height: 44 }}>
          <Icon name="chev-left" />
        </IconButton>
        <Typography
          component="h2" aria-live="polite"
          sx={{ minWidth: 132, textAlign: "center", fontFamily: SERIF, fontStyle: "italic", fontWeight: 500, fontSize: 21, lineHeight: "24px", letterSpacing: "-0.01em" }}
        >
          {formatMonth(month, lang)}
        </Typography>
        <IconButton aria-label={t("month.next")} onClick={onNext} disabled={month >= thisMonth} sx={{ width: 44, height: 44 }}>
          <Icon name="chev-right" />
        </IconButton>
      </Box>
      {currencies.length > 1 && (
        <Box
          role="tablist"
          aria-label={t("chart.currency")}
          sx={{ display: "inline-flex", gap: "2px", p: "3px", bgcolor: c.sunken, border: `1px solid ${c.line}`, borderRadius: 3 }}
        >
          {currencies.map((cu) => {
            const selected = cu.currency === currency;
            return (
              <Box
                key={cu.currency}
                component="button"
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onCurrency(cu.currency)}
                sx={{
                  font: "inherit", fontSize: 13, fontWeight: 500, minHeight: 38, minWidth: 52, px: 3, border: 0, borderRadius: "9px", cursor: "pointer",
                  bgcolor: selected ? c.surface : "transparent", color: selected ? c.ink : c.inkMuted,
                  boxShadow: selected ? `0 0 0 1px ${c.lineStrong}` : "none",
                }}
              >
                {cu.currency}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
