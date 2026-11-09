import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { en } from "./en";
import type { Dict } from "./en";
import { ko } from "./ko";
import { uz } from "./uz";

export type Lang = "en" | "ko" | "uz";

// Each language is listed in its own name and script, as the design shows.
export const LANGUAGES: { code: Lang; native: string; english: string; short: string }[] = [
  { code: "en", native: "English", english: "English", short: "EN" },
  { code: "ko", native: "한국어", english: "Korean", short: "KO" },
  { code: "uz", native: "Oʻzbekcha", english: "Uzbek", short: "UZ" },
];

const DICTS: Record<Lang, Dict> = { en, ko, uz };
const STORAGE_KEY = "parsimony.lang";

export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "ko" || saved === "uz") return saved;
  } catch {
    /* storage can be blocked; fall through to the browser language */
  }
  const nav = (typeof navigator !== "undefined" ? navigator.language : "en").toLowerCase();
  if (nav.startsWith("ko")) return "ko";
  if (nav.startsWith("uz")) return "uz";
  return "en";
}

export type TFn = (key: keyof Dict) => string;

type I18nValue = { lang: Lang; setLang: (l: Lang) => void; t: TFn };
const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children, initial }: { children: ReactNode; initial?: Lang }) {
  const [lang, setLangState] = useState<Lang>(initial ?? detectLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* not saving is fine */
    }
  }, []);

  const value = useMemo<I18nValue>(
    () => ({ lang, setLang, t: (key) => DICTS[lang][key] }),
    [lang, setLang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

export const useT = (): TFn => useI18n().t;
