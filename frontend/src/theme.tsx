import { CssBaseline, ThemeProvider, createTheme, useMediaQuery } from "@mui/material";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useI18n } from "./i18n";

// Tokens come from docs/design.md (the Claude Design system). Light / dark pairs.
export const tokens = {
  light: {
    bg: "#FAF8F4", surface: "#FFFDF9", sunken: "#F1EDE5", line: "#E9E4DA", lineStrong: "#857D70",
    ink: "#1F2421", inkMuted: "#5B605C", inkFaint: "#736C61",
    accent: "#1F6F5C", accentStrong: "#185A4B", accentSoft: "#E3EEE9", onAccent: "#FFFFFF",
    warn: "#8A5A00", warnSoft: "#F6EBD3", warnWash: "#FBF3E4",
    danger: "#A33A2C", dangerSoft: "#F7E4DF",
  },
  dark: {
    bg: "#161917", surface: "#1F2321", sunken: "#2B302D", line: "#2E3330", lineStrong: "#6E746F",
    ink: "#ECE8E0", inkMuted: "#A8ADA8", inkFaint: "#8A908B",
    accent: "#5FB89E", accentStrong: "#7CCBB3", accentSoft: "#1D2E28", onAccent: "#0E1A16",
    warn: "#E2B65E", warnSoft: "#2E2717", warnWash: "#26221A",
    danger: "#F0907F", dangerSoft: "#33201C",
  },
} as const;

export type Mode = "light" | "dark" | "system";
const STORAGE_KEY = "parsimony.theme";

function buildTheme(scheme: "light" | "dark", lang: string) {
  const c = tokens[scheme];
  // Korean text falls back to Noto Sans KR (the design file's choice).
  const fontFamily = `"Inter Variable", "Noto Sans KR", system-ui, -apple-system, "Segoe UI", sans-serif`;
  return createTheme({
    cssVariables: false,
    palette: {
      mode: scheme,
      primary: { main: c.accent, dark: c.accentStrong, light: c.accentSoft, contrastText: c.onAccent },
      error: { main: c.danger },
      warning: { main: c.warn },
      background: { default: c.bg, paper: c.surface },
      text: { primary: c.ink, secondary: c.inkMuted, disabled: c.inkFaint },
      divider: c.line,
    },
    shape: { borderRadius: 12 },
    spacing: 4,
    typography: {
      fontFamily,
      fontSize: 15,
      h1: { fontSize: 28, lineHeight: "34px", fontWeight: 600 },
      h2: { fontSize: 20, lineHeight: "28px", fontWeight: 600 },
      h3: { fontSize: 16, lineHeight: "24px", fontWeight: 600 },
      body1: { fontSize: 15, lineHeight: "22px" },
      body2: { fontSize: 13, lineHeight: "18px" },
      caption: { fontSize: 12, lineHeight: "16px" },
      button: { textTransform: "none", fontWeight: 600 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            // Korean wraps between words, not mid-word.
            wordBreak: lang === "ko" ? "keep-all" : "normal",
            fontVariantNumeric: "tabular-nums",
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { minHeight: 44, borderRadius: 12 } },
      },
      MuiTextField: { defaultProps: { variant: "outlined", fullWidth: true } },
      MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 12, backgroundColor: c.surface } } },
    },
  });
}

type ThemeCtx = { mode: Mode; setMode: (m: Mode) => void };
const ModeContext = createContext<ThemeCtx | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const { lang } = useI18n();
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const [mode, setModeState] = useState<Mode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark" || saved === "system") return saved;
    } catch {
      /* ignore */
    }
    return "system";
  });
  const scheme = mode === "system" ? (prefersDark ? "dark" : "light") : mode;

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = scheme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", tokens[scheme].bg);
  }, [scheme]);

  const theme = useMemo(() => buildTheme(scheme, lang), [scheme, lang]);
  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);
  return (
    <ModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ModeContext.Provider>
  );
}

export function useMode(): ThemeCtx {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useMode must be used inside <AppThemeProvider>");
  return ctx;
}
