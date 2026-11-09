import { Alert, Box, Button, Divider, Paper, Tab, Tabs, TextField, Typography } from "@mui/material";
import { keyframes } from "@mui/material/styles";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ApiError } from "../api/client";
import { useDemo, useLogin, useSignup } from "../api/auth";
import { clearExpiredNotice, peekExpiredNotice } from "../lib/session";
import { Hero } from "../components/Hero";
import { TopBar } from "../components/TopBar";
import { useT } from "../i18n";
import type { TFn } from "../i18n";

type Tab = "signup" | "login";

// Opening moment (1.1 s): the receipt logo prints in, then the page settles. Only opacity, transform and clip-path move.
const fade = keyframes`from{opacity:0}to{opacity:1}`;
const settle = keyframes`from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}`;
const print = keyframes`from{clip-path:inset(0 0 100% 0)}to{clip-path:inset(0 0 0 0)}`;
const slideIn = keyframes`from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:none}`;
const riseIn = keyframes`from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}`;
const SEEN = "parsimony.intro";

/** True only on the first landing page view of a browser session. */
function shouldPlayIntro(): boolean {
  try {
    if (sessionStorage.getItem(SEEN)) return false;
    sessionStorage.setItem(SEEN, "1");
  } catch {
    return false; // storage blocked: skip the animation rather than replay it every time
  }
  return true;
}

const introStyles = {
  "&.intro .i-sq": { transformOrigin: "center", transformBox: "fill-box", animation: `${settle} 200ms ease-out both` },
  "&.intro .i-paper": { animation: `${print} 360ms cubic-bezier(.4,0,.2,1) 120ms both` },
  "&.intro .i-p": { animation: `${fade} 200ms ease-out 440ms both` },
  "&.intro .i-dot": { animation: `${fade} 160ms ease-out 560ms both` },
  "&.intro .i-word": { animation: `${slideIn} 220ms ease-out 600ms both` },
  "&.intro .i-s1": { animation: `${riseIn} 260ms ease-out 700ms both` },
  "&.intro .i-s2": { animation: `${riseIn} 260ms ease-out 760ms both` },
  "&.intro .i-s3": { animation: `${riseIn} 260ms ease-out 820ms both` },
  "@media (prefers-reduced-motion: reduce)": {
    "&.intro .i-sq, &.intro .i-paper, &.intro .i-p, &.intro .i-dot, &.intro .i-word, &.intro .i-s1, &.intro .i-s2, &.intro .i-s3": { animation: "none" },
    "&.intro": { animation: `${fade} 150ms ease-out both` },
  },
} as const;
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
  // Read once, then forget, so the notice shows a single time after a session ends.
  const [expiredNotice] = useState(peekExpiredNotice);
  const [intro, setIntro] = useState(shouldPlayIntro);
  useEffect(() => clearExpiredNotice, []);
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
    <Box
      className={intro ? "intro" : undefined}
      // Any tap or key press skips straight to the finished page; nothing is blocked while it plays.
      onPointerDownCapture={intro ? () => setIntro(false) : undefined}
      onKeyDownCapture={intro ? () => setIntro(false) : undefined}
      sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column", ...introStyles }}
    >
      <TopBar brand={false} />
      <Box component="main" sx={{ flex: 1, display: "flex", justifyContent: "center", px: 4, py: { xs: 8, sm: 14 } }}>
        <Box sx={{ width: "100%", maxWidth: 440 }}>
          <Box sx={{ mb: 6 }}><Hero /></Box>
          <Typography className="i-s1" variant="h1" component="h1" sx={{ mb: 2 }}>{t("landing.title")}</Typography>
          <Typography className="i-s2" color="text.secondary" sx={{ mb: 6 }}>{t("landing.subtitle")}</Typography>

          <Paper className="i-s3" variant="outlined" sx={{ p: { xs: 4, sm: 6 }, borderRadius: 3 }}>
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
              {expiredNotice && !serverError && <Alert severity="info">{t("session.expired")}</Alert>}
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
