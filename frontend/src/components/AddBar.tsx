import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import PersonOutlineIcon from "@mui/icons-material/PersonOutlineOutlined";
import { Alert, Box, Button, IconButton, InputBase, ListItemIcon, Menu, MenuItem, Tooltip, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { meQuery } from "../api/auth";
import { ApiError } from "../api/client";
import { useAddEntry, useDeleteEntry, useUpdateEntry, useUsage } from "../api/entries";
import type { Category, Entry, EntryCreated } from "../api/types";
import { addErrorMessage } from "../lib/errors";
import { currentDate, fill, formatMoney } from "../lib/format";
import { useI18n, useT } from "../i18n";
import { useTokens } from "../theme";
import { FixDialog } from "./FixDialog";
import { Icon } from "./Icon";
import { ReceiptDialog } from "./ReceiptDialog";
import { useToast } from "./Toast";
import { VoiceDialog } from "./VoiceDialog";

// Docked at the bottom on phones, at the top of the list on desktop (as in the design).
// onAdded gets the new entry so the page can show the month it belongs to (a receipt can be from last year).
// A square, bordered button (44 x 48), as the design draws My page, voice and photo.
const boxButton = (c: ReturnType<typeof useTokens>) => ({
  width: 44, height: 48, borderRadius: "12px", border: `1px solid ${c.lineStrong}`, bgcolor: c.surface, color: c.ink,
  "&:hover": { bgcolor: c.sunken },
  "&.Mui-disabled": { color: c.inkFaint, bgcolor: c.sunken, borderColor: c.line },
});

export function AddBar({ onAdded }: { onAdded?: (entry?: Entry) => void }) {
  const c = useTokens();
  const t = useT();
  const { lang } = useI18n();
  const toast = useToast();
  const remove = useDeleteEntry();
  const update = useUpdateEntry();
  const { data: me } = useQuery(meQuery);
  const [manual, setManual] = useState(false);
  const theme = useTheme();
  const docked = useMediaQuery(theme.breakpoints.down("sm"));
  const [text, setText] = useState("");
  const add = useAddEntry();
  const libraryInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [voice, setVoice] = useState(false);
  const { data: usage } = useUsage();

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) setPhoto(f);
  }

  // "Added Taxi ₩12,000 · Undo": undo is exact, it deletes the entry (or entries) just created.
  function announce(created: EntryCreated) {
    const all = [created, ...(created.siblings ?? [])];
    const total = all.reduce((sum, e) => sum + Number(e.amount), 0);
    const shown = all.length > 1 ? (Math.round(total * 100) / 100).toFixed(2) : created.amount;
    const what = `${created.merchant ?? created.note ?? ""} ${formatMoney(shown, created.currency, lang)}`.trim();
    // One purchase that was split by item can be turned back into a single entry with the total.
    const combine = async () => {
      const biggest = [...all].sort((a, b) => Number(b.amount) - Number(a.amount))[0];
      const note = all.map((e) => e.note).filter(Boolean).join(", ") || null;
      await update.mutateAsync({ id: created.id, changes: { amount: shown, note, category: biggest.category as Category } });
      await Promise.all(all.slice(1).map((e) => remove.mutateAsync(e.id)));
      toast({ message: t("toast.saved") });
    };
    toast({
      action2: all.length > 1 && new Set(all.map((e) => e.currency)).size === 1 ? { label: t("toast.combine"), onClick: () => { combine().catch(() => {}); } } : undefined,
      message: all.length > 1 ? fill(t("toast.addedMany"), { count: all.length, what }) : fill(t("toast.addedWhat"), { what }),
      action: {
        label: t("toast.undo"),
        onClick: () => Promise.all(all.map((e) => remove.mutateAsync(e.id))).then(() => toast({ message: t("toast.removed") })).catch(() => {}),
      },
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || add.isPending) return;
    add.mutate(value, { onSuccess: (entry) => { setText(""); onAdded?.(entry); announce(entry); } });
  }

  const bar = (
    <Box sx={{ width: "100%" }}>
      {voice && <VoiceDialog onClose={() => setVoice(false)} onAdded={(entry) => { onAdded?.(entry); announce(entry); }} />}
      {manual && me && (
        <FixDialog
          draft={{ note: text.trim(), currency: me.default_currency, date: currentDate(me.timezone) }}
          onClose={(created) => { setManual(false); add.reset(); setText(""); onAdded?.(created); }}
        />
      )}
      {photo && <ReceiptDialog file={photo} onClose={(added) => { setPhoto(null); onAdded?.(added); }} />}
      {add.isError && (
        <Alert
          severity="error" role="alert" onClose={() => add.reset()} sx={{ mb: 2 }}
          action={add.error instanceof ApiError && add.error.status === 422 && (
            <Button color="inherit" size="small" onClick={() => setManual(true)} sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
              {t("manual.action")}
            </Button>
          )}
        >
          {addErrorMessage(add.error, t)}
        </Alert>
      )}
      <Box component="form" onSubmit={onSubmit} sx={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <Tooltip title={t("add.myPage")}>
          <IconButton component={Link} to="/me" aria-label={t("add.myPage")} sx={boxButton(c)}>
            <PersonOutlineIcon />
          </IconButton>
        </Tooltip>
        {/* The field is its own bordered box; the send button lives inside it (as in the design). */}
        <Box
          sx={{
            flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 0.5, minHeight: 48, pl: "10px", pr: 1, bgcolor: c.surface,
            border: `1px solid ${c.lineStrong}`, borderRadius: "12px",
            "&:focus-within": { borderColor: c.accent, outline: `2px solid ${c.focus}`, outlineOffset: 1 },
          }}
        >
          <InputBase
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("add.placeholder")}
            inputProps={{ "aria-label": t("add.label"), maxLength: 500 }}
            disabled={add.isPending}
            sx={{ flex: 1, minWidth: 0, fontSize: 14 }}
          />
          {(text.trim() || add.isPending) && (
            <IconButton
              type="submit"
              aria-label={t("add.send")}
              disabled={!text.trim() || add.isPending}
              sx={{ width: 40, height: 40, borderRadius: "9px", bgcolor: "primary.main", color: "primary.contrastText", "&:hover": { bgcolor: "primary.dark" }, "&.Mui-disabled": { bgcolor: "action.disabledBackground" } }}
            >
              <ArrowUpwardIcon />
            </IconButton>
          )}
        </Box>
        <Tooltip title={t("add.voice")}>
          <span>
            <IconButton aria-label={t("add.voice")} disabled={add.isPending || !!photo || voice} onClick={() => setVoice(true)} sx={boxButton(c)}>
              <Icon name="mic" size={22} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t("add.photo")}>
          <span>
            <IconButton aria-label={t("add.photo")} disabled={add.isPending || !!photo} onClick={(e) => setMenuAnchor(e.currentTarget)} sx={boxButton(c)}>
              <Icon name="camera" size={22} />
            </IconButton>
          </span>
        </Tooltip>
        <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
          <MenuItem onClick={() => { setMenuAnchor(null); cameraInput.current?.click(); }}>
            <ListItemIcon><Icon name="camera" size={20} /></ListItemIcon>{t("add.photo.camera")}
          </MenuItem>
          <MenuItem onClick={() => { setMenuAnchor(null); libraryInput.current?.click(); }}>
            <ListItemIcon><Icon name="upload" size={20} /></ListItemIcon>{t("add.photo.library")}
          </MenuItem>
        </Menu>
        {/* "capture" asks a phone for the camera directly; without it the phone shows its photo picker. */}
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden data-testid="camera-input" onChange={onPick} />
        <input ref={libraryInput} type="file" accept="image/*" hidden data-testid="photo-input" onChange={onPick} />
      </Box>
      {/* Always take the same height, so the bar never grows when the number arrives. */}
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1, textAlign: "center", minHeight: "1.5em", lineHeight: 1.5 }}>
        {usage ? fill(t("add.usage"), { left: Math.max(0, usage.limit - usage.used), limit: usage.limit }) : "\u00a0"}
      </Typography>
    </Box>
  );

  if (!docked) return bar;
  return (
    <Box
      sx={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 10, bgcolor: "background.default",
        borderTop: 1, borderColor: "divider", px: 3, pt: 3, pb: "max(12px, env(safe-area-inset-bottom))",
      }}
    >
      {bar}
    </Box>
  );
}
