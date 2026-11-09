import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useState } from "react";
import type { FormEvent } from "react";
import { useCreateManual, useDeleteEntry, useUpdateEntry } from "../api/entries";
import { CATEGORIES, PAYMENT_METHODS } from "../api/types";
import type { Category, Entry, EntryUpdate, PaymentMethod } from "../api/types";
import { categoryLabel, fill, needsCheck, paymentLabel, uncertainWords } from "../lib/format";
import { useI18n } from "../i18n";
import { useToast } from "./Toast";

type Errors = Partial<Record<"amount" | "currency" | "date", string>>;

export type Draft = { note: string; currency: string; date: string };

/**
 * "Fix this": every field of the entry, the original words, Save and Delete. Full screen on phones.
 * With a `draft` instead of an entry it is the "Enter manually" form: the same fields, saved as a new entry.
 */
export function FixDialog({ entry, draft, onClose }: { entry?: Entry; draft?: Draft; onClose: (created?: Entry) => void }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const creating = !entry;
  const create = useCreateManual();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const update = useUpdateEntry();
  const remove = useDeleteEntry();
  const [amount, setAmount] = useState(entry?.amount ?? "");
  const [currency, setCurrency] = useState(entry?.currency ?? draft!.currency);
  const [date, setDate] = useState(entry?.date ?? draft!.date);
  const [category, setCategory] = useState<string>(entry?.category ?? "other");
  const [payment, setPayment] = useState<string>(entry?.payment_method ?? "unknown");
  const [merchant, setMerchant] = useState(entry?.merchant ?? "");
  const [note, setNote] = useState(entry?.note ?? draft?.note ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const flagged = !!entry && needsCheck(entry);
  const guessed = new Set(flagged ? entry.uncertain ?? [] : []);
  const notSure = flagged ? uncertainWords(t, lang, [entry]) : "";
  const hint = (field: string, error?: string) => error ?? (guessed.has(field) ? t("fix.checkField") : undefined);
  const busy = update.isPending || remove.isPending || create.isPending;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found: Errors = {};
    const cleanAmount = amount.replace(",", ".").trim();
    if (!(Number(cleanAmount) > 0)) found.amount = t("fix.error.amount");
    if (!/^[A-Za-z]{3}$/.test(currency.trim())) found.currency = t("fix.error.currency");
    if (!date) found.date = t("fix.error.date");
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    if (!entry) {
      return create.mutate(
        {
          amount: cleanAmount, currency: currency.trim().toUpperCase(), date, category: category as Category,
          payment_method: payment as PaymentMethod, merchant: merchant.trim() || null, note: note.trim() || null,
        },
        { onSuccess: (created) => { toast({ message: t("toast.added") }); onClose(created); } },
      );
    }
    // Send only what changed, so an untouched entry is never marked as "edited".
    const changes: EntryUpdate = {};
    if (Number(cleanAmount) !== Number(entry.amount)) changes.amount = cleanAmount;
    if (currency.trim().toUpperCase() !== entry.currency) changes.currency = currency.trim().toUpperCase();
    if (date !== entry.date) changes.date = date;
    if (category !== entry.category) changes.category = category as Category;
    if (payment !== entry.payment_method) changes.payment_method = payment as PaymentMethod;
    if (merchant.trim() !== (entry.merchant ?? "")) changes.merchant = merchant.trim() || null;
    if (note.trim() !== (entry.note ?? "")) changes.note = note.trim() || null;
    if (Object.keys(changes).length === 0) return flagged ? confirm() : onClose(); // saving = "it is right"
    update.mutate({ id: entry.id, changes }, { onSuccess: () => { toast({ message: t("toast.saved") }); onClose(); } });
  }

  function confirm() {
    if (!entry) return;
    update.mutate({ id: entry.id, changes: { confirmed: true } }, { onSuccess: () => { toast({ message: t("toast.checked") }); onClose(); } });
  }

  function onDelete() {
    if (!entry) return;
    if (!confirmDelete) return setConfirmDelete(true);
    remove.mutate(entry.id, { onSuccess: () => { toast({ message: t("toast.deleted"), icon: "trash" }); onClose(); } });
  }

  return (
    <Dialog open onClose={busy ? undefined : () => onClose()} fullScreen={fullScreen} fullWidth maxWidth="sm" aria-labelledby="fix-title">
      <Box component="form" onSubmit={onSubmit} noValidate sx={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
        <DialogTitle id="fix-title">{creating ? t("manual.title") : t("fix.title")}</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 4, pt: "8px !important" }}>
          {flagged && (
            <Alert severity="warning" action={<Button color="inherit" size="small" onClick={confirm} disabled={busy}>{t("fix.looksRight")}</Button>}>
              {notSure ? fill(t("fix.notSure"), { fields: notSure }) : t("photo.lowConfidence")}
            </Alert>
          )}
          {entry?.raw_input && (
            <Box sx={(th) => ({ p: 3, borderRadius: 3, bgcolor: th.palette.mode === "dark" ? "#2B302D" : "#F1EDE5" })}>
              <Typography variant="caption" color="text.secondary">{t("fix.youSaid")}</Typography>
              <Typography sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13, wordBreak: "break-word" }}>
                {entry.raw_input}
              </Typography>
            </Box>
          )}
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
            <TextField label={t("fix.amount")} value={amount} onChange={(e) => setAmount(e.target.value)} error={!!errors.amount} helperText={hint("amount", errors.amount)} color={guessed.has("amount") ? "warning" : undefined} focused={guessed.has("amount") && !errors.amount ? true : undefined} slotProps={{ htmlInput: { inputMode: "decimal" } }} />
            <TextField label={t("fix.currency")} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} error={!!errors.currency} helperText={hint("currency", errors.currency)} color={guessed.has("currency") ? "warning" : undefined} focused={guessed.has("currency") && !errors.currency ? true : undefined} slotProps={{ htmlInput: { maxLength: 3 } }} />
          </Box>
          <TextField label={t("fix.date")} type="date" value={date} onChange={(e) => setDate(e.target.value)} error={!!errors.date} helperText={hint("date", errors.date)} color={guessed.has("date") ? "warning" : undefined} focused={guessed.has("date") && !errors.date ? true : undefined} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField select label={t("fix.category")} value={category} onChange={(e) => setCategory(e.target.value)} helperText={hint("category")} color={guessed.has("category") ? "warning" : undefined} focused={guessed.has("category") || undefined}>
            {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{categoryLabel(t, c)}</MenuItem>)}
          </TextField>
          <TextField select label={t("fix.payment")} value={payment} onChange={(e) => setPayment(e.target.value)} helperText={hint("payment_method")} color={guessed.has("payment_method") ? "warning" : undefined} focused={guessed.has("payment_method") || undefined}>
            {PAYMENT_METHODS.map((m) => <MenuItem key={m} value={m}>{paymentLabel(t, m)}</MenuItem>)}
          </TextField>
          <TextField label={t("fix.merchant")} value={merchant} onChange={(e) => setMerchant(e.target.value)} helperText={hint("merchant")} color={guessed.has("merchant") ? "warning" : undefined} focused={guessed.has("merchant") || undefined} slotProps={{ htmlInput: { maxLength: 200 } }} />
          <TextField label={t("fix.note")} value={note} onChange={(e) => setNote(e.target.value)} slotProps={{ htmlInput: { maxLength: 500 } }} />
          {(update.isError || remove.isError || create.isError) && <Alert severity="error" role="alert">{t("fix.error.generic")}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 6, py: 4, gap: 2, flexWrap: "wrap", justifyContent: "space-between" }}>
          {creating ? <span /> : (
            <Button color="error" onClick={onDelete} disabled={busy}>
              {confirmDelete ? t("fix.deleteConfirm") : t("fix.delete")}
            </Button>
          )}
          <Box sx={{ display: "flex", gap: 2 }}>
            <Button onClick={() => onClose()} disabled={busy} color="inherit">{t("fix.cancel")}</Button>
            <Button type="submit" variant="contained" disabled={busy}>{creating ? t("manual.save") : t("fix.save")}</Button>
          </Box>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
