import { Box, Paper, Typography } from "@mui/material";
import type { Entry } from "../api/types";
import { fill, needsCheck, totalLabel, uncertainWords } from "../lib/format";
import { useI18n } from "../i18n";
import { useTokens } from "../theme";
import { Icon } from "./Icon";

// Entries the AI was unsure about (and nobody has corrected yet), so they are easy to find and fix.
export function NeedsCheck({ entries, onOpen }: { entries: Entry[]; onOpen: (id: string) => void }) {
  const { t, lang } = useI18n();
  const c = useTokens();
  // Items of one purchase are one row: they share one AI answer and are checked together.
  const rows = new Map<string, Entry[]>();
  for (const e of entries.filter(needsCheck)) rows.set(e.group_id ?? e.id, [...(rows.get(e.group_id ?? e.id) ?? []), e]);
  const flagged = [...rows.values()];
  if (flagged.length === 0) return null;
  return (
    <Paper variant="outlined" component="section" aria-label={t("check.title")} sx={{ p: 4, borderRadius: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography sx={{ fontWeight: 600 }}>{t("check.title")}</Typography>
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1, fontSize: 12, fontWeight: 600, color: c.warn }}>
          <Icon name="alert" size={14} />
          {flagged.length}
        </Box>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{t("check.help")}</Typography>
      <Box component="ul" sx={{ listStyle: "none", m: 0, mt: 2, p: 0 }}>
        {flagged.slice(0, 5).map((group) => {
          const e = group[0];
          return (
          <li key={e.group_id ?? e.id}>
            <Box
              component="button"
              type="button"
              onClick={() => onOpen(e.id)}
              sx={{
                all: "unset", boxSizing: "border-box", width: "100%", minHeight: 44, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 3,
                cursor: "pointer", borderRadius: 1.5, "&:focus-visible": { outline: `2px solid ${c.focus}`, outlineOffset: 2 },
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: 14 }}>{e.merchant ?? e.note ?? t("entry.noMerchant")}</Typography>
                {uncertainWords(t, lang, group) && (
                  <Typography noWrap sx={{ fontSize: 12, color: c.warn }}>
                    {fill(t("check.notSure"), { fields: uncertainWords(t, lang, group) })}
                  </Typography>
                )}
              </Box>
              <Typography sx={{ fontSize: 14, fontWeight: 500, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                {totalLabel(group, lang)}
              </Typography>
            </Box>
          </li>
          );
        })}
      </Box>
    </Paper>
  );
}
