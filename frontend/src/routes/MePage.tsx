import { Alert, Autocomplete, Avatar, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, LinearProgress, Paper, Skeleton, TextField, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { ReactNode } from "react";
import { meQuery, useDeleteMe, useLogout, useUpdateMe } from "../api/auth";
import { useOverview, useUsage } from "../api/entries";
import { DemoBanner } from "../components/DemoBanner";
import { Icon } from "../components/Icon";
import { TopBar } from "../components/TopBar";
import { fill, formatDate, formatMoney, normalizeWord } from "../lib/format";
import { useI18n } from "../i18n";
import { tokens } from "../theme";

function Section({ title, children, danger }: { title: string; children: ReactNode; danger?: boolean }) {
  return (
    <Paper
      variant="outlined" component="section"
      sx={{ p: { xs: 4, sm: 6 }, borderRadius: 3, display: "grid", gap: 4, ...(danger ? { borderColor: "error.main" } : {}) }}
    >
      <Typography variant="h2" component="h2" sx={danger ? { color: "error.main" } : undefined}>{title}</Typography>
      {children}
    </Paper>
  );
}

// One number in its own small card (overview grid).
function Stat({ label, children, note }: { label: string; children: ReactNode; note?: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 3.5, borderRadius: 2.5, display: "grid", gap: 1, alignContent: "start", minWidth: 0, bgcolor: "background.default" }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Box sx={{ fontWeight: 600, fontSize: 20, fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}>{children}</Box>
      {note && <Typography variant="caption" color="text.secondary">{note}</Typography>}
    </Paper>
  );
}

const FALLBACK_ZONES = ["UTC", "Asia/Seoul", "Asia/Tashkent", "America/New_York", "Europe/London"];
function timeZones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone");
  } catch {
    return FALLBACK_ZONES;
  }
}

/** "Asia/Seoul" -> { city: "Seoul", region: "Asia/Seoul", offset: "UTC+9" } */
const zoneCache = new Map<string, { city: string; offset: string }>();
function zoneInfo(id: string) {
  let hit = zoneCache.get(id);
  if (!hit) {
    let offset = "";
    try {
      const part = new Intl.DateTimeFormat("en", { timeZone: id, timeZoneName: "shortOffset" }).formatToParts(new Date()).find((x) => x.type === "timeZoneName");
      offset = (part?.value ?? "").replace("GMT", "UTC") || "UTC";
    } catch {
      offset = "";
    }
    hit = { city: (id.split("/").pop() ?? id).replace(/_/g, " "), offset };
    zoneCache.set(id, hit);
  }
  return hit;
}

export function MePage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { data: user } = useQuery(meQuery);
  const overview = useOverview();
  const usage = useUsage();
  const updateMe = useUpdateMe();
  const logout = useLogout();
  const deleteMe = useDeleteMe();

  const [name, setName] = useState(user?.display_name ?? "");
  const [currency, setCurrency] = useState(user?.default_currency ?? "USD");
  const [timezone, setTimezone] = useState(user?.timezone ?? "UTC");
  const [currencyError, setCurrencyError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState("");

  if (!user) return null;
  const nameChanged = name.trim() !== (user.display_name ?? "");
  const dirty = nameChanged || currency !== user.default_currency || timezone !== user.timezone;
  const shownName = user.display_name ?? user.email.split("@")[0];
  const initial = (Array.from(shownName)[0] ?? "?").toUpperCase();
  const word = t("me.delete.word");
  // The translated word works, and so does plain English "delete" on any keyboard.
  const accepted = [normalizeWord(word), "delete"];

  function save() {
    if (!user) return;
    setSaved(false);
    if (!/^[A-Za-z]{3}$/.test(currency.trim())) return setCurrencyError(t("me.error.currency"));
    setCurrencyError(null);
    // Send only what changed.
    const changes: { default_currency?: string; timezone?: string; display_name?: string | null } = {};
    if (nameChanged) changes.display_name = name.trim() || null;
    if (currency.trim().toUpperCase() !== user.default_currency) changes.default_currency = currency.trim().toUpperCase();
    if (timezone !== user.timezone) changes.timezone = timezone;
    updateMe.mutate(changes, { onSuccess: () => setSaved(true) });
  }

  const o = overview.data;
  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      {user.is_demo && <DemoBanner />}
      <TopBar />
      <Box component="main" sx={{ flex: 1, width: "100%", maxWidth: 720, mx: "auto", px: { xs: 4, sm: 6 }, py: { xs: 5, sm: 8 }, display: "grid", gap: 5, alignContent: "start" }}>
        <Box>
          <Button component={Link} to="/app" startIcon={<Icon name="arrow-left" size={18} />} color="inherit" sx={{ ml: -2, mb: 2 }}>{t("me.back")}</Button>
          <Typography variant="h1" component="h1">{t("me.title")}</Typography>
        </Box>

        <Paper variant="outlined" component="section" aria-label={t("me.account")} sx={{ p: { xs: 4, sm: 6 }, borderRadius: 3, display: "flex", alignItems: "center", gap: 4 }}>
          <Avatar
            aria-hidden
            sx={(theme) => ({ width: 64, height: 64, fontSize: 28, fontWeight: 600, bgcolor: tokens[theme.palette.mode].accentSoft, color: "primary.main" })}
          >
            {initial}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
              <Typography variant="h2" component="p" sx={{ overflowWrap: "anywhere" }}>{shownName}</Typography>
              {user.is_demo && <Chip size="small" label={t("me.demoChip")} />}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>{user.email}</Typography>
          </Box>
        </Paper>

        <Section title={t("me.overview")}>
          {overview.isPending || !o ? (
            <Skeleton variant="rounded" height={120} />
          ) : (
            <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              <Stat label={t("me.entries")}>
                {fill(t("me.entriesOf"), { count: o.total_entries, limit: o.entry_limit })}
                <LinearProgress
                  variant="determinate" value={Math.min(100, (o.total_entries / o.entry_limit) * 100)}
                  aria-label={t("me.entries")} sx={{ mt: 1.5, height: 6, borderRadius: 3 }}
                />
              </Stat>
              {o.first_date && <Stat label={t("me.since")} note={t("me.sinceNote")}>{formatDate(o.first_date, lang, true)}</Stat>}
              <Stat label={t("me.spent")}>
                {o.totals.length === 0 ? (
                  <Typography color="text.secondary">{t("me.noSpending")}</Typography>
                ) : (
                  o.totals.map((c) => <Box key={c.currency}>{formatMoney(c.total, c.currency, lang)}</Box>)
                )}
              </Stat>
              {usage.data && (
                <Stat label={t("me.aiToday")} note={t("me.aiNote")}>
                  {fill(t("me.entriesOf"), { count: usage.data.used, limit: usage.data.limit })}
                </Stat>
              )}
            </Box>
          )}
        </Section>

        <Section title={t("me.settings")}>
          <TextField
            label={t("me.displayName")}
            value={name}
            onChange={(e) => { setName(e.target.value); setSaved(false); }}
            helperText={t("me.displayNameHelp")}
            slotProps={{ htmlInput: { maxLength: 80 } }}
          />
          <TextField
            label={t("me.currency")}
            value={currency}
            onChange={(e) => { setCurrency(e.target.value.toUpperCase()); setSaved(false); }}
            error={!!currencyError}
            helperText={currencyError ?? t("me.currencyHelp")}
            slotProps={{ htmlInput: { maxLength: 3 } }}
          />
          <Autocomplete
            options={timeZones()}
            value={timezone}
            disableClearable
            onChange={(_, v) => { setTimezone(v); setSaved(false); }}
            getOptionLabel={(id) => `${zoneInfo(id).city} · ${id}`}
            renderOption={({ key, ...props }, id) => (
              <Box component="li" key={key} {...props} sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start !important" }}>
                <span>{zoneInfo(id).city}</span>
                <Typography variant="caption" color="text.secondary">{id} · {zoneInfo(id).offset}</Typography>
              </Box>
            )}
            renderInput={(params) => <TextField {...params} label={t("me.timezone")} helperText={`${zoneInfo(timezone).offset} · ${t("me.timezoneHelp")}`} />}
          />
          {updateMe.isError && <Alert severity="error" role="alert">{t("me.error.generic")}</Alert>}
          <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
            <Button variant="contained" onClick={save} disabled={!dirty || updateMe.isPending}>{t("me.save")}</Button>
            {saved && !dirty && (
              <Typography role="status" color="primary" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                <Icon name="check" size={18} />{t("me.saved")}
              </Typography>
            )}
          </Box>
        </Section>

        <Section title={t("me.account")}>
          {user.is_demo && <Alert severity="warning">{t("me.demoAccount")}</Alert>}
          <Box>
            <Typography variant="body2" color="text.secondary">{t("me.signedInAs")}</Typography>
            <Typography sx={{ overflowWrap: "anywhere" }}>{user.email}</Typography>
          </Box>
          <Box>
            <Button variant="outlined" startIcon={<Icon name="logout" size={18} />} disabled={logout.isPending} onClick={() => logout.mutate(undefined, { onSuccess: () => navigate({ to: "/" }) })}>
              {t("me.logout")}
            </Button>
          </Box>
        </Section>

        <Section title={t("me.danger")} danger>
          <Typography variant="body2">{t("me.dangerBody")}</Typography>
          <Box>
            <Button color="error" variant="outlined" startIcon={<Icon name="trash" size={18} />} onClick={() => { setTyped(""); setConfirmOpen(true); }}>{t("me.delete")}</Button>
          </Box>
        </Section>
      </Box>

      <Dialog open={confirmOpen} onClose={deleteMe.isPending ? undefined : () => setConfirmOpen(false)} fullWidth maxWidth="xs" aria-labelledby="del-title">
        <DialogTitle id="del-title">{t("me.delete.title")}</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 4 }}>
          <DialogContentText>{t("me.delete.body")}</DialogContentText>
          <TextField autoFocus label={fill(t("me.delete.type"), { word })} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          {deleteMe.isError && <Alert severity="error" role="alert">{t("me.delete.error")}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 6, pb: 4, gap: 2 }}>
          <Button color="inherit" onClick={() => setConfirmOpen(false)} disabled={deleteMe.isPending}>{t("me.delete.cancel")}</Button>
          <Button
            color="error"
            variant="contained"
            disabled={!accepted.includes(normalizeWord(typed)) || deleteMe.isPending}
            onClick={() => deleteMe.mutate(undefined, { onSuccess: () => navigate({ to: "/" }) })}
          >
            {t("me.delete.confirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
