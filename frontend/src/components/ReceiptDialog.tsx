import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Skeleton, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { useAddPhoto } from "../api/entries";
import type { Entry } from "../api/types";
import { photoErrorMessage } from "../lib/errors";
import { categoryLabel, needsCheck, formatDate, formatMoney, paymentLabel } from "../lib/format";
import { useI18n, useT } from "../i18n";
import { FixDialog } from "./FixDialog";
import { Icon } from "./Icon";

/** Receipt flow (design 4b/4c): "Reading the receipt…" with Cancel, then the fields to check. */
export function ReceiptDialog({ file, onClose }: { file: File; onClose: (added?: Entry) => void }) {
  const t = useT();
  const { lang } = useI18n();
  const add = useAddPhoto();
  const abort = useRef<AbortController | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const started = useRef(false);

  function run() {
    abort.current = new AbortController();
    add.mutate({ file, signal: abort.current.signal });
  }

  // Start the upload once (StrictMode runs effects twice; one photo must cost one smart add).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The thumbnail URL is created and released with the component, so it survives StrictMode's second pass.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function cancel() {
    abort.current?.abort();
    onClose();
  }

  const entry: Entry | undefined = add.data;
  if (entry && editing) return <FixDialog entry={entry} onClose={() => onClose(entry)} />;

  const thumb = preview && (
    <Box component="img" src={preview} alt={t("photo.alt")} sx={{ width: 88, height: 112, objectFit: "cover", borderRadius: 2, border: 1, borderColor: "divider", flex: "none" }} />
  );

  return (
    <Dialog open onClose={add.isPending ? undefined : () => onClose(add.data)} fullWidth maxWidth="xs" aria-labelledby="receipt-title">
      <DialogTitle id="receipt-title">{entry ? t("photo.checkTitle") : t("photo.title")}</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: 3 }}>
        {add.isPending && (
          <Box sx={{ display: "flex", gap: 4, alignItems: "flex-start" }} role="status">
            {thumb}
            <Box sx={{ flex: 1, display: "grid", gap: 1.5, pt: 1 }}>
              <Typography sx={{ fontWeight: 600 }}>{t("photo.reading")}</Typography>
              <Skeleton width="80%" /><Skeleton width="55%" /><Skeleton width="65%" />
              <Typography variant="caption" color="text.secondary">{t("photo.wait")}</Typography>
            </Box>
          </Box>
        )}
        {add.isError && <Alert severity="error" role="alert">{photoErrorMessage(add.error, t)}</Alert>}
        {entry && (
          <>
            <Box sx={{ display: "flex", gap: 4, alignItems: "flex-start" }}>
              {thumb}
              <Box>
                <Typography sx={{ fontSize: 28, fontWeight: 600, lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>
                  {formatMoney(entry.amount, entry.currency, lang)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {[entry.merchant, categoryLabel(t, entry.category)].filter(Boolean).join(" · ")}
                </Typography>
              </Box>
            </Box>
            {needsCheck(entry) && <Alert severity="warning">{t("photo.lowConfidence")}</Alert>}
            <Box component="dl" sx={{ m: 0, display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 3, rowGap: 1.5, fontSize: 14 }}>
              {[
                [t("fix.date"), formatDate(entry.date, lang, true)],
                [t("fix.merchant"), entry.merchant ?? "–"],
                [t("fix.amount"), `${entry.amount} ${entry.currency}`],
                [t("fix.category"), categoryLabel(t, entry.category)],
                [t("fix.payment"), paymentLabel(t, entry.payment_method)],
                ...(entry.note ? [[t("fix.note"), entry.note]] : []),
              ].map(([k, v]) => (
                <Box key={k} sx={{ display: "contents" }}>
                  <Box component="dt" sx={{ color: "text.secondary" }}>{k}</Box>
                  <Box component="dd" sx={{ m: 0, textAlign: "right", wordBreak: "break-word" }}>{v}</Box>
                </Box>
              ))}
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 6, pb: 5, gap: 2 }}>
        {add.isPending && <Button variant="outlined" onClick={cancel} fullWidth>{t("photo.cancel")}</Button>}
        {add.isError && (
          <>
            <Button variant="outlined" onClick={() => onClose()}>{t("photo.close")}</Button>
            <Button variant="contained" onClick={run}>{t("photo.retry")}</Button>
          </>
        )}
        {entry && (
          <>
            <Button variant="outlined" startIcon={<Icon name="edit" size={18} />} onClick={() => setEditing(true)}>{t("photo.edit")}</Button>
            <Button variant="contained" startIcon={<Icon name="check" size={18} />} onClick={() => onClose(entry)}>{t("photo.ok")}</Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
