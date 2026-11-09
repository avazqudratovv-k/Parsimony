import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import PersonOutlineIcon from "@mui/icons-material/PersonOutlineOutlined";
import { Alert, Box, Button, IconButton, InputBase, ListItemIcon, Menu, MenuItem, Paper, Tooltip, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { meQuery } from "../api/auth";
import { ApiError } from "../api/client";
import { useAddEntry, useDeleteEntry, useUsage } from "../api/entries";
import type { Entry } from "../api/types";
import { addErrorMessage } from "../lib/errors";
import { currentDate, fill, formatMoney } from "../lib/format";
import { useI18n, useT } from "../i18n";
import { FixDialog } from "./FixDialog";
import { Icon } from "./Icon";
import { ReceiptDialog } from "./ReceiptDialog";
import { useToast } from "./Toast";
import { VoiceDialog } from "./VoiceDialog";

// Docked at the bottom on phones, at the top of the list on desktop (as in the design).
export function AddBar({ onAdded }: { onAdded?: () => void }) {
  const t = useT();
  const { lang } = useI18n();
  const toast = useToast();
  const remove = useDeleteEntry();
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

  // "Added Taxi ₩12,000 · Undo": undo is exact, it deletes the entry that was just created.
  function announce(entry: Entry) {
    const what = `${entry.merchant ?? entry.note ?? ""} ${formatMoney(entry.amount, entry.currency, lang)}`.trim();
    toast({
      message: fill(t("toast.addedWhat"), { what }),
      action: { label: t("toast.undo"), onClick: () => remove.mutate(entry.id, { onSuccess: () => toast({ message: t("toast.removed") }) }) },
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || add.isPending) return;
    add.mutate(value, { onSuccess: (entry) => { setText(""); onAdded?.(); announce(entry); } });
  }

  const bar = (
    <Box sx={{ width: "100%" }}>
      {voice && <VoiceDialog onClose={() => setVoice(false)} onAdded={(entry) => { onAdded?.(); announce(entry); }} />}
      {manual && me && (
        <FixDialog
          draft={{ note: text.trim(), currency: me.default_currency, date: currentDate(me.timezone) }}
          onClose={() => { setManual(false); add.reset(); setText(""); onAdded?.(); }}
        />
      )}
      {photo && <ReceiptDialog file={photo} onClose={() => { setPhoto(null); onAdded?.(); }} />}
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
      <Paper
        component="form"
        onSubmit={onSubmit}
        variant="outlined"
        sx={{ display: "flex", alignItems: "center", gap: 1, p: 1, borderRadius: 999 }}
      >
        <Tooltip title={t("add.myPage")}>
          <IconButton component={Link} to="/me" aria-label={t("add.myPage")} sx={{ width: 44, height: 44 }}>
            <PersonOutlineIcon />
          </IconButton>
        </Tooltip>
        <InputBase
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("add.placeholder")}
          inputProps={{ "aria-label": t("add.label"), maxLength: 500 }}
          disabled={add.isPending}
          sx={{ flex: 1, px: 2, fontSize: 15 }}
        />
        {(text.trim() || add.isPending) && (
        <IconButton
          type="submit"
          aria-label={t("add.send")}
          disabled={!text.trim() || add.isPending}
          sx={{ width: 44, height: 44, bgcolor: "primary.main", color: "primary.contrastText", "&:hover": { bgcolor: "primary.dark" }, "&.Mui-disabled": { bgcolor: "action.disabledBackground" } }}
        >
          <ArrowUpwardIcon />
        </IconButton>
        )}
        <Tooltip title={t("add.voice")}>
          <span>
            <IconButton aria-label={t("add.voice")} disabled={add.isPending || !!photo || voice} onClick={() => setVoice(true)} sx={{ width: 44, height: 44 }}>
              <Icon name="mic" size={22} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t("add.photo")}>
          <span>
            <IconButton aria-label={t("add.photo")} disabled={add.isPending || !!photo} onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ width: 44, height: 44 }}>
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
      </Paper>
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
