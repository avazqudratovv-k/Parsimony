import { Alert, Box, Button, Divider, Paper, Tab, Tabs, TextField, Typography } from "@mui/material";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError } from "../api/client";
import { useDemo, useLogin, useSignup } from "../api/auth";
import { TopBar } from "../components/TopBar";
import { useT } from "../i18n";
import type { TFn } from "../i18n";

type Tab = "signup" | "login";
type FieldErrors = { email?: string; password?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Show our own translated message for each kind of failure (the server's text is English only).
export function authErrorMessage(e: unknown, t: TFn, tab: Tab): string {
  if (e instanceof ApiError) {
    if (e.code === "network" || e.status === 0) return t("auth.error.network");
    if (e.status === 401) return t("auth.error.wrongCredentials");
    if (e.status === 409) return t("auth.error.emailTaken");
    if (e.status === 429) return t("auth.error.tooMany");
    if (e.status === 503) return t("auth.error.demoFull");
    if (e.status === 422) return tab === "signup" ? t("auth.error.passwordShort") : t("auth.error.email");
  }
  return t("auth.error.generic");
}

export function LandingPage() {
  const t = useT();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const signup = useSignup();
  const login = useLogin();
  const demo = useDemo();
  const active = tab === "signup" ? signup : login;
  const busy = signup.isPending || login.isPending || demo.isPending;
  const serverError = signup.error ?? login.error ?? demo.error;
  const serverTab: Tab = signup.error ? "signup" : "login";

  const goToApp = () => navigate({ to: "/app" });

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!EMAIL_RE.test(email.trim())) next.email = t("auth.error.email");
    if (tab === "signup" && password.length < 8) next.password = t("auth.error.passwordShort");
    if (tab === "login" && password.length === 0) next.password = t("auth.error.passwordRequired");
    return next;
  }

  function resetServerErrors() {
    signup.reset();
    login.reset();
    demo.reset();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    resetServerErrors();
    if (Object.keys(found).length > 0) return;
    active.mutate({ email: email.trim(), password }, { onSuccess: goToApp });
  }

  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <TopBar />
      <Box component="main" sx={{ flex: 1, display: "flex", justifyContent: "center", px: 4, py: { xs: 8, sm: 14 } }}>
        <Box sx={{ width: "100%", maxWidth: 440 }}>
          <Typography variant="h1" component="h1" sx={{ mb: 2 }}>{t("landing.title")}</Typography>
          <Typography color="text.secondary" sx={{ mb: 6 }}>{t("landing.subtitle")}</Typography>

          <Paper variant="outlined" sx={{ p: { xs: 4, sm: 6 }, borderRadius: 3 }}>
            <Tabs
              value={tab}
              onChange={(_, v: Tab) => {
                setTab(v);
                setErrors({});
                resetServerErrors();
              }}
              variant="fullWidth"
              sx={{ mb: 5 }}
            >
              <Tab value="signup" label={t("auth.tab.signup")} />
              <Tab value="login" label={t("auth.tab.login")} />
            </Tabs>

            <Box component="form" onSubmit={onSubmit} noValidate sx={{ display: "grid", gap: 4 }}>
              <TextField
                label={t("auth.email")}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={!!errors.email}
                helperText={errors.email}
              />
              <TextField
                label={t("auth.password")}
                type="password"
                autoComplete={tab === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={!!errors.password}
                helperText={errors.password ?? (tab === "signup" ? t("auth.passwordHint") : undefined)}
              />
              {serverError && (
                <Alert severity="error" role="alert">
                  {authErrorMessage(serverError, t, serverTab)}
                </Alert>
              )}
              <Button type="submit" variant="contained" size="large" disabled={busy}>
                {t(tab === "signup" ? "auth.submit.signup" : "auth.submit.login")}
              </Button>
            </Box>

            <Divider sx={{ my: 5 }}>
              <Typography variant="caption" color="text.secondary">{t("auth.or")}</Typography>
            </Divider>

            <Button
              variant="outlined"
              size="large"
              fullWidth
              disabled={busy}
              onClick={() => {
                resetServerErrors();
                demo.mutate(undefined, { onSuccess: goToApp });
              }}
            >
              {t("auth.tryDemo")}
            </Button>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: "center" }}>
              {t("auth.demoNote")}
            </Typography>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
