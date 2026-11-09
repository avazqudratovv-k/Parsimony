import { Alert, Box, Button, Divider, Paper, Tab, Tabs, TextField, Typography } from "@mui/material";
import { keyframes } from "@mui/material/styles";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ApiError } from "../api/client";
import { useDemo, useLogin, useSignup } from "../api/auth";
import { clearExpiredNotice, peekExpiredNotice } from "../lib/session";
import { CategoryIcon } from "../components/CategoryIcon";
import { Hero } from "../components/Hero";
import { Icon } from "../components/Icon";
import { TopBar } from "../components/TopBar";
import { useT } from "../i18n";
import { DESKTOP, useTokens } from "../theme";
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
  const c = useTokens();
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

  const SAMPLES = [
    { category: "groceries", title: "GS25", meta: t("landing.sample.1"), amount: "₩3,500", icon: "keyboard" },
    { category: "transport", title: t("landing.sample.2"), meta: t("landing.sample.2m"), amount: "₩12,000", icon: "mic" },
    { category: "entertainment", title: "Netflix", meta: t("landing.sample.3m"), amount: "€15.49", icon: "camera" },
  ] as const;
  const FEATURES = [
    { icon: "keyboard", label: t("landing.f.type") },
    { icon: "mic", label: t("landing.f.voice") },
    { icon: "camera", label: t("landing.f.photo") },
  ] as const;

  const guestButton = (
    <>
      <Button
        className="i-s3" variant="contained" size="large" fullWidth disabled={busy} sx={{ minHeight: 52, fontSize: 16 }}
        onClick={() => { resetServerErrors(); demo.mutate(undefined, { onSuccess: goToApp }); }}
      >
        {t("auth.tryDemo")}
      </Button>
      <Typography className="i-s3" variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: "center" }}>
        {t("auth.demoNote")}
      </Typography>
    </>
  );

  return (
    <Box
      className={intro ? "intro" : undefined}
      // Any tap or key press skips straight to the finished page; nothing is blocked while it plays.
      onPointerDownCapture={intro ? () => setIntro(false) : undefined}
      onKeyDownCapture={intro ? () => setIntro(false) : undefined}
      sx={{
        minHeight: "100dvh", display: "flex", flexDirection: "column", ...introStyles,
        background: `radial-gradient(900px 420px at 85% -10%, ${c.accentSoft}, transparent 70%)`,
      }}
    >
      <TopBar brand={false} />
      <Box component="main" sx={{ flex: 1, display: "flex", justifyContent: "center", px: 4, py: { xs: 8, sm: 12 } }}>
        <Box
          sx={{
            width: "100%", maxWidth: 440, display: "grid", gap: { xs: 8, lg: 14 }, alignItems: "start",
            [`@media ${DESKTOP}`]: { maxWidth: 1040, gridTemplateColumns: "minmax(0,1fr) minmax(0,420px)", alignItems: "center" },
          }}
        >
          <Box>
            <Box sx={{ mb: 6 }}><Hero /></Box>
            <Typography className="i-s1" variant="h1" component="h1" sx={{ mb: 3, fontSize: { xs: 30, lg: 44 }, lineHeight: { xs: "36px", lg: "52px" }, letterSpacing: "-0.02em" }}>
              {t("landing.title")}
              <Box component="span" sx={{ display: "block", color: "primary.main" }}>{t("landing.title2")}</Box>
            </Typography>
            <Typography className="i-s2" color="text.secondary" sx={{ mb: 6, fontSize: { lg: 18 }, maxWidth: 480 }}>{t("landing.subtitle")}</Typography>

            <Box sx={{ maxWidth: 440 }}>{guestButton}</Box>

            <Box className="i-s3" sx={{ display: "flex", gap: 2, flexWrap: "wrap", mt: 6 }}>
              {FEATURES.map((f) => (
                <Box key={f.icon} sx={{ display: "inline-flex", alignItems: "center", gap: 1.5, px: 3, py: 1.5, borderRadius: 99, border: `1px solid ${c.line}`, bgcolor: c.surface, fontSize: 14, color: c.inkMuted }}>
                  <Icon name={f.icon} size={18} />{f.label}
                </Box>
              ))}
            </Box>

            <Box
              aria-hidden className="i-s3"
              sx={{ mt: 7, maxWidth: 440, bgcolor: c.surface, border: `1px solid ${c.line}`, borderRadius: 3, overflow: "hidden", boxShadow: "0 12px 32px -16px rgba(31,36,33,0.22)" }}
            >
              {SAMPLES.map((e, i) => (
                <Box key={e.title} sx={{ display: "flex", alignItems: "center", gap: 3, px: 4, py: 3, borderTop: i ? `1px solid ${c.line}` : 0 }}>
                  <CategoryIcon category={e.category} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ fontWeight: 500 }}>{e.title}</Box>
                    <Box sx={{ fontSize: 13, color: c.inkMuted }}>{e.meta}</Box>
                  </Box>
                  <Box sx={{ textAlign: "right" }}>
                    <Box sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{e.amount}</Box>
                    <Box sx={{ color: c.inkMuted, display: "flex", justifyContent: "flex-end" }}><Icon name={e.icon} size={14} /></Box>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>

          <Paper className="i-s3" variant="outlined" sx={{ p: { xs: 4, sm: 6 }, borderRadius: 3, bgcolor: c.surface }}>
            <Divider sx={{ mb: 5 }}>
              <Typography variant="caption" color="text.secondary">{t("auth.or")}</Typography>
            </Divider>
            <Tabs
              value={tab}
              onChange={(_, v: Tab) => { setTab(v); setErrors({}); resetServerErrors(); }}
              variant="fullWidth"
              sx={{ mb: 5 }}
            >
              <Tab value="signup" label={t("auth.tab.signup")} />
              <Tab value="login" label={t("auth.tab.login")} />
            </Tabs>

            <Box component="form" onSubmit={onSubmit} noValidate sx={{ display: "grid", gap: 4 }}>
              <TextField
                label={t("auth.email")} type="email" autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)} error={!!errors.email} helperText={errors.email}
              />
              <TextField
                label={t("auth.password")} type="password" autoComplete={tab === "signup" ? "new-password" : "current-password"} value={password}
                onChange={(e) => setPassword(e.target.value)} error={!!errors.password}
                helperText={errors.password ?? (tab === "signup" ? t("auth.passwordHint") : undefined)}
              />
              {expiredNotice && !serverError && <Alert severity="info">{t("session.expired")}</Alert>}
              {serverError && <Alert severity="error" role="alert">{authErrorMessage(serverError, t, serverTab)}</Alert>}
              <Button type="submit" variant="outlined" size="large" disabled={busy}>
                {t(tab === "signup" ? "auth.submit.signup" : "auth.submit.login")}
              </Button>
            </Box>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
