import { CssBaseline, ThemeProvider, createTheme, useMediaQuery } from "@mui/material";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useI18n } from "./i18n";

// Tokens come from docs/design.md (the Claude Design system). Light / dark pairs.
// Category tints (icon tile background + glyph colour), light then dark. From the final design.
export const CAT_TINTS = {
  light: {
    food_drink: ["#F3E3DA", "#9A4A2E"], groceries: ["#E2EDE4", "#3E6B4A"], transport: ["#E0E8F0", "#3B5B7A"],
    shopping: ["#EEE3EC", "#7A4A72"], bills: ["#EFE9DA", "#6E5B2E"], health: ["#F4E1E3", "#9A3B4A"],
    entertainment: ["#E6E4F1", "#4F4A86"], travel: ["#DDEDEE", "#2E6A70"], other: ["#ECEAE6", "#5B605C"],
  },
  dark: {
    food_drink: ["#3A2A24", "#E7A88C"], groceries: ["#22312A", "#9CCBA8"], transport: ["#212B36", "#9DB9D6"],
    shopping: ["#312532", "#D3A6CC"], bills: ["#2F2A1E", "#D2BE8A"], health: ["#382327", "#EB9DAA"],
    entertainment: ["#27263A", "#B2ADE6"], travel: ["#1E3133", "#94CDD2"], other: ["#2B2D2B", "#A8ADA8"],
  },
} as const;

/** Tile background and glyph colour for a category (unknown ones read as "other"). */
export function catTint(scheme: "light" | "dark", category: string): { bg: string; fg: string } {
  const set = CAT_TINTS[scheme] as Record<string, readonly [string, string]>;
  const [bg, fg] = set[category] ?? set.other;
  return { bg, fg };
}

export const SERIF = '"Newsreader", "Iowan Old Style", Georgia, serif';
export const MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';
export const EASE_OUT = "cubic-bezier(.2,.7,.2,1)";
export const EASE_PRINT = "cubic-bezier(.3,.6,.15,1)";

export const tokens = {
  light: {
    marginRule: "rgba(31,111,92,0.30)",
    paper: "#FBF8F1", paperInk: "#2A2D2A", paperMuted: "#6B6A63", paperLine: "#CFC7B8",
    bg: "#FAF8F4", surface: "#FFFDF9", sunken: "#F1EDE5", line: "#E9E4DA", lineStrong: "#857D70",
    ink: "#1F2421", inkMuted: "#5B605C", inkFaint: "#736C61",
    accent: "#1F6F5C", accentStrong: "#185A4B", accentSoft: "#E3EEE9", onAccent: "#FFFFFF",
    warn: "#8A5A00", warnSoft: "#F6EBD3", warnWash: "#FBF3E4",
    danger: "#A33A2C", dangerSoft: "#F7E4DF", onDanger: "#FFFFFF",
    chartBar: "#A9C8BD", focus: "#1F6F5C", scrim: "rgba(31,36,33,0.42)",
    toastBg: "#1F2421", toastInk: "#F3EFE7", toastMuted: "#A8ADA8", toastAction: "#7CCBB3", toastWarn: "#E2B65E",
  },
  dark: {
    marginRule: "rgba(95,184,158,0.30)",
    paper: "#FBF8F1", paperInk: "#2A2D2A", paperMuted: "#6B6A63", paperLine: "#CFC7B8",
    bg: "#161917", surface: "#1F2321", sunken: "#2B302D", line: "#2E3330", lineStrong: "#6E746F",
    ink: "#ECE8E0", inkMuted: "#A8ADA8", inkFaint: "#8A908B",
    accent: "#5FB89E", accentStrong: "#7CCBB3", accentSoft: "#1D2E28", onAccent: "#0E1A16",
    warn: "#E2B65E", warnSoft: "#2E2717", warnWash: "#26221A",
    danger: "#F0907F", dangerSoft: "#33201C", onDanger: "#1F0E0B",
    chartBar: "#3F6E60", focus: "#7CCBB3", scrim: "rgba(0,0,0,0.6)",
    toastBg: "#ECE8E0", toastInk: "#1F2421", toastMuted: "#5B605C", toastAction: "#1F6F5C", toastWarn: "#8A5A00",
  },
} as const;

export type Mode = "light" | "dark" | "system";
const STORAGE_KEY = "parsimony.theme";

function buildTheme(scheme: "light" | "dark", lang: string) {
  const c = tokens[scheme];
  // Korean text falls back to Noto Sans KR (the design file's choice).
  const fontFamily = `"Inter Variable", "Noto Sans KR", system-ui, -apple-system, "Segoe UI", sans-serif`;
  return createTheme({
    breakpoints: { values: { xs: 0, sm: 600, md: 900, lg: 1024, xl: 1536 } }, // lg = the design's desktop breakpoint
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
          // Never let the page drag sideways on phones. "clip" (not "hidden") keeps the sticky header working.
          html: { overflowX: "clip" },
          body: {
            overflowX: "clip",
            overscrollBehaviorY: "none", // no rubber-band bounce that makes the docked bars wobble
            // Korean wraps between words, not mid-word.
            wordBreak: lang === "ko" ? "keep-all" : "normal",
            fontVariantNumeric: "tabular-nums",
          },
        },
      },
      MuiButtonBase: { styleOverrides: { root: { "&.Mui-focusVisible": { outline: `2px solid ${c.focus}`, outlineOffset: 2 } } } },
      MuiDialog: { styleOverrides: { paper: { borderRadius: 20 } } },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { minHeight: 44, borderRadius: 12 } },
      },
      MuiTextField: { defaultProps: { variant: "outlined", fullWidth: true } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: 12, backgroundColor: c.surface, "& .MuiOutlinedInput-notchedOutline": { borderColor: c.lineStrong } },
        },
      },
    },
  });
}

type ThemeCtx = { mode: Mode; scheme: "light" | "dark"; setMode: (m: Mode) => void };
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
  const value = useMemo(() => ({ mode, scheme, setMode }), [mode, scheme, setMode]);
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

/** The design tokens for the active light/dark scheme (for pieces MUI's palette doesn't cover). */
export function useTokens() {
  return tokens[useMode().scheme];
}

/** The width where the dashboard becomes two columns (from the design). */
export const DESKTOP = "(min-width:1024px)";
