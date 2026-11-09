import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, LinearProgress, Paper, Skeleton, TextField, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { ReactNode } from "react";
import { meQuery, useDeleteMe, useLogout, useUpdateMe } from "../api/auth";
import { useOverview, useUsage } from "../api/entries";
import { DemoBanner } from "../components/DemoBanner";
import { TopBar } from "../components/TopBar";
import { fill, formatDate, formatMoney } from "../lib/format";
import { useI18n } from "../i18n";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper variant="outlined" component="section" sx={{ p: { xs: 4, sm: 6 }, borderRadius: 3, display: "grid", gap: 4 }}>
      <Typography variant="h2" component="h2">{title}</Typography>
      {children}
    </Paper>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Box sx={{ fontWeight: 600, fontSize: 18 }}>{children}</Box>
    </Box>
  );
}

function timeZones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone");
  } catch {
    return ["UTC", "Asia/Seoul", "Asia/Tashkent", "America/New_York", "Europe/London"];
  }
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

  const [currency, setCurrency] = useState(user?.default_currency ?? "USD");
  const [timezone, setTimezone] = useState(user?.timezone ?? "UTC");
  const [currencyError, setCurrencyError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState("");

  if (!user) return null;
  const dirty = currency !== user.default_currency || timezone !== user.timezone;
  const word = t("me.delete.word");

  function save() {
    setSaved(false);
    if (!/^[A-Za-z]{3}$/.test(currency.trim())) return setCurrencyError(t("me.error.currency"));
    setCurrencyError(null);
    updateMe.mutate({ default_currency: currency.trim().toUpperCase(), timezone }, { onSuccess: () => setSaved(true) });
  }

  const o = overview.data;
  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      {user.is_demo && <DemoBanner />}
      <TopBar />
      <Box component="main" sx={{ flex: 1, width: "100%", maxWidth: 720, mx: "auto", px: { xs: 4, sm: 6 }, py: { xs: 5, sm: 8 }, display: "grid", gap: 5, alignContent: "start" }}>
        <Box>
          <Button component={Link} to="/app" startIcon={<ArrowBackIcon />} color="inherit" sx={{ ml: -2, mb: 2 }}>{t("me.back")}</Button>
          <Typography variant="h1" component="h1">{t("me.title")}</Typography>
        </Box>

        <Section title={t("me.overview")}>
          {overview.isPending || !o ? (
            <Skeleton variant="rounded" height={120} />
          ) : (
            <Box sx={{ display: "grid", gap: 4 }}>
              <Box>
                <Stat label={t("me.entries")}>{fill(t("me.entriesOf"), { count: o.total_entries, limit: o.entry_limit })}</Stat>
                <LinearProgress variant="determinate" value={Math.min(100, (o.total_entries / o.entry_limit) * 100)} sx={{ mt: 2, height: 6, borderRadius: 3 }} />
              </Box>
              {o.first_date && <Stat label={t("me.since")}>{formatDate(o.first_date, lang, true)}</Stat>}
              <Stat label={t("me.spent")}>
                {o.totals.length === 0 ? (
                  <Typography color="text.secondary">{t("me.noSpending")}</Typography>
                ) : (
                  o.totals.map((c) => <Box key={c.currency}>{formatMoney(c.total, c.currency, lang)}</Box>)
                )}
              </Stat>
              {usage.data && <Stat label={t("me.aiToday")}>{fill(t("me.entriesOf"), { count: usage.data.used, limit: usage.data.limit })}</Stat>}
            </Box>
          )}
        </Section>

        <Section title={t("me.settings")}>
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
            renderInput={(params) => <TextField {...params} label={t("me.timezone")} helperText={t("me.timezoneHelp")} />}
          />
          {updateMe.isError && <Alert severity="error" role="alert">{t("me.error.generic")}</Alert>}
          <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
            <Button variant="contained" onClick={save} disabled={!dirty || updateMe.isPending}>{t("me.save")}</Button>
            {saved && !dirty && <Typography role="status" color="text.secondary">{t("me.saved")}</Typography>}
          </Box>
        </Section>

        <Section title={t("me.account")}>
          <Stat label={t("me.signedInAs")}>
            <Box sx={{ overflowWrap: "anywhere", fontSize: 15 }}>{user.email}</Box>
          </Stat>
          {user.is_demo && <Alert severity="warning">{t("me.demoAccount")}</Alert>}
          <Box>
            <Button variant="outlined" disabled={logout.isPending} onClick={() => logout.mutate(undefined, { onSuccess: () => navigate({ to: "/" }) })}>
              {t("me.logout")}
            </Button>
          </Box>
          <Box>
            <Button color="error" variant="outlined" onClick={() => { setTyped(""); setConfirmOpen(true); }}>{t("me.delete")}</Button>
          </Box>
        </Section>
      </Box>

      <Dialog open={confirmOpen} onClose={deleteMe.isPending ? undefined : () => setConfirmOpen(false)} fullWidth maxWidth="xs" aria-labelledby="del-title">
        <DialogTitle id="del-title">{t("me.delete.title")}</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 4 }}>
          <DialogContentText>{t("me.delete.body")}</DialogContentText>
          <TextField autoFocus label={t("me.delete.type")} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          {deleteMe.isError && <Alert severity="error" role="alert">{t("me.delete.error")}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 6, pb: 4, gap: 2 }}>
          <Button color="inherit" onClick={() => setConfirmOpen(false)} disabled={deleteMe.isPending}>{t("me.delete.cancel")}</Button>
          <Button
            color="error"
            variant="contained"
            disabled={typed.trim().toLowerCase() !== word.toLowerCase() || deleteMe.isPending}
            onClick={() => deleteMe.mutate(undefined, { onSuccess: () => navigate({ to: "/" }) })}
          >
            {t("me.delete.confirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
