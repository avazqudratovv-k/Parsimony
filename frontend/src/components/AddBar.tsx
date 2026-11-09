import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import PersonOutlineIcon from "@mui/icons-material/PersonOutlineOutlined";
import { Alert, Box, IconButton, InputBase, Paper, Tooltip, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useAddEntry, useUsage } from "../api/entries";
import { addErrorMessage } from "../lib/errors";
import { fill } from "../lib/format";
import { useT } from "../i18n";
import { Icon } from "./Icon";
import { ReceiptDialog } from "./ReceiptDialog";

// Docked at the bottom on phones, at the top of the list on desktop (as in the design).
export function AddBar({ onAdded }: { onAdded?: () => void }) {
  const t = useT();
  const theme = useTheme();
  const docked = useMediaQuery(theme.breakpoints.down("sm"));
  const [text, setText] = useState("");
  const add = useAddEntry();
  const fileInput = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const { data: usage } = useUsage();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || add.isPending) return;
    add.mutate(value, { onSuccess: () => { setText(""); onAdded?.(); } });
  }

  const bar = (
    <Box sx={{ width: "100%" }}>
      {photo && <ReceiptDialog file={photo} onClose={() => { setPhoto(null); onAdded?.(); }} />}
      {add.isError && (
        <Alert severity="error" role="alert" onClose={() => add.reset()} sx={{ mb: 2 }}>
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
        <Tooltip title={t("add.photo")}>
          <span>
            <IconButton aria-label={t("add.photo")} disabled={add.isPending || !!photo} onClick={() => fileInput.current?.click()} sx={{ width: 44, height: 44 }}>
              <Icon name="camera" size={22} />
            </IconButton>
          </span>
        </Tooltip>
        {/* On a phone this opens the camera or the photo library; on desktop, the file picker. */}
        <input
          ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/*" hidden data-testid="photo-input"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setPhoto(f); }}
        />
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
