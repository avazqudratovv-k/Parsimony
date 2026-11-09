import { Alert, Box, Button, Chip, Skeleton, Typography } from "@mui/material";
import { useState } from "react";
import { useEntries } from "../api/entries";
import type { Entry } from "../api/types";
import { LOW_CONFIDENCE, categoryLabel, formatDate, formatMoney } from "../lib/format";
import { useI18n } from "../i18n";
import { CategoryIcon } from "./CategoryIcon";
import { FixDialog } from "./FixDialog";
import { tokens } from "../theme";

function EntryRow({ entry, onOpen }: { entry: Entry; onOpen: () => void }) {
  const { t, lang } = useI18n();
  const checkThis = entry.confidence < LOW_CONFIDENCE && !entry.user_corrected;
  const title = entry.merchant ?? entry.note ?? t("entry.noMerchant");
  const subtitle = [categoryLabel(t, entry.category), formatDate(entry.date, lang), entry.merchant ? entry.note : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <Box
      component="li"
      sx={{ display: "flex", alignItems: "center", gap: 3, py: 3, borderBottom: 1, borderColor: "divider", listStyle: "none" }}
    >
      <Box
        component="button"
        type="button"
        onClick={onOpen}
        aria-label={`${title}, ${formatMoney(entry.amount, entry.currency, lang)}`}
        sx={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, flex: 1, minWidth: 0, borderRadius: 2, "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 } }}
      >
        <CategoryIcon category={entry.category} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, minWidth: 0 }}>
            <Typography noWrap sx={{ fontWeight: 600 }}>{title}</Typography>
            {entry.user_corrected && <Chip size="small" label={t("entry.edited")} variant="outlined" sx={{ flexShrink: 0 }} />}
          </Box>
          <Typography variant="body2" color="text.secondary" noWrap>{subtitle}</Typography>
          {checkThis && (
            <Chip
              size="small"
              label={t("entry.checkThis")}
              sx={(theme) => ({ mt: 1, bgcolor: tokens[theme.palette.mode].warnSoft, color: tokens[theme.palette.mode].warn, fontWeight: 600 })}
            />
          )}
        </Box>
        <Typography sx={{ fontWeight: 600, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
          {formatMoney(entry.amount, entry.currency, lang)}
        </Typography>
      </Box>
      <Button onClick={onOpen} size="small" variant="outlined" sx={{ display: { xs: "none", sm: "inline-flex" }, minHeight: 36, flexShrink: 0 }}>
        {t("entry.fix")}
      </Button>
    </Box>
  );
}

export function EntryList() {
  const t = useI18n().t;
  const { data, isPending, isError, refetch } = useEntries();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = data?.find((e) => e.id === openId) ?? null;

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
  if (data.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 12 }}>
        <Typography variant="h2" component="h2" sx={{ mb: 2 }}>{t("list.empty.title")}</Typography>
        <Typography color="text.secondary">{t("list.empty.body")}</Typography>
      </Box>
    );
  }
  return (
    <>
      <Box component="ul" sx={{ p: 0, m: 0, mt: 2 }}>
        {data.map((entry) => <EntryRow key={entry.id} entry={entry} onOpen={() => setOpenId(entry.id)} />)}
      </Box>
      {open && <FixDialog entry={open} onClose={() => setOpenId(null)} />}
    </>
  );
}
