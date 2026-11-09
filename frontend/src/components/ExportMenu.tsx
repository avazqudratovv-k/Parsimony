import { Box, Button, Menu, MenuItem } from "@mui/material";
import { useState } from "react";
import type { Entry } from "../api/types";
import { useI18n } from "../i18n";
import { downloadText, entriesToCsv } from "../lib/export";
import { categoryLabel, paymentLabel } from "../lib/format";
import { useTokens } from "../theme";
import { Icon } from "./Icon";
import { PrintReport } from "./PrintReport";
import { useToast } from "./Toast";

/** "Export" for the month on screen: a CSV file for Excel, or a PDF through the print dialog. */
export function ExportMenu({ month, entries }: { month: string; entries: Entry[] }) {
  const { t } = useI18n();
  const c = useTokens();
  const toast = useToast();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [printing, setPrinting] = useState(false);

  function csv() {
    setAnchor(null);
    const header = ["date", "merchant", "note", "amount", "currency", "category", "payment", "source"].map((k) => t(`export.${k}` as "export.date"));
    downloadText(`parsimony-${month}.csv`, entriesToCsv(entries, { header, category: (x) => categoryLabel(t, x), payment: (x) => paymentLabel(t, x) }));
    toast({ message: t("export.done"), icon: "check" });
  }

  return (
    <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 3, mb: -1 }}>
      <Button
        size="small" startIcon={<Icon name="upload" size={16} />} aria-haspopup="menu" disabled={entries.length === 0}
        onClick={(e) => setAnchor(e.currentTarget)} sx={{ color: c.inkMuted }}
      >
        {t("export.button")}
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        <MenuItem onClick={csv}>{t("export.csv")}</MenuItem>
        <MenuItem onClick={() => { setAnchor(null); setPrinting(true); }}>{t("export.pdf")}</MenuItem>
      </Menu>
      {printing && <PrintReport month={month} entries={entries} onDone={() => setPrinting(false)} />}
    </Box>
  );
}
