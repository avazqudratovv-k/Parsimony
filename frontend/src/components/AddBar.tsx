import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import PersonOutlineIcon from "@mui/icons-material/PersonOutlineOutlined";
import { Alert, Box, IconButton, InputBase, Paper, Tooltip, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { FormEvent } from "react";
import { useAddEntry, useUsage } from "../api/entries";
import { addErrorMessage } from "../lib/errors";
import { fill } from "../lib/format";
import { useT } from "../i18n";

// Docked at the bottom on phones, at the top of the list on desktop (as in the design).
export function AddBar() {
  const t = useT();
  const theme = useTheme();
  const docked = useMediaQuery(theme.breakpoints.down("sm"));
  const [text, setText] = useState("");
  const add = useAddEntry();
  const { data: usage } = useUsage();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || add.isPending) return;
    add.mutate(value, { onSuccess: () => setText("") });
  }

  const bar = (
    <Box sx={{ width: "100%" }}>
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
        <IconButton
          type="submit"
          aria-label={t("add.send")}
          disabled={!text.trim() || add.isPending}
          sx={{ width: 44, height: 44, bgcolor: "primary.main", color: "primary.contrastText", "&:hover": { bgcolor: "primary.dark" }, "&.Mui-disabled": { bgcolor: "action.disabledBackground" } }}
        >
          <ArrowUpwardIcon />
        </IconButton>
      </Paper>
      {usage && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1, textAlign: "center" }}>
          {fill(t("add.usage"), { used: usage.used, limit: usage.limit })}
        </Typography>
      )}
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
