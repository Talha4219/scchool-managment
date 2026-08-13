"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { type Lang, LANGUAGES, translate, translateNavLabel } from "@/lib/i18n/translations";

const STORAGE_KEY = "lang";

function applyLangAttrs(lang: Lang) {
  const meta = LANGUAGES.find(l => l.code === lang) ?? LANGUAGES[0];
  document.documentElement.setAttribute("lang", lang);
  document.documentElement.setAttribute("dir", meta.dir);
  document.documentElement.classList.toggle("font-urdu", lang === "ur");
}

interface LanguageCtx {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
  /** Translates a literal sidebar/nav label (e.g. "Dashboard") rather than a dot-namespaced key. */
  tn: (label: string) => string;
  dir: "ltr" | "rtl";
}

const LanguageContext = createContext<LanguageCtx>({
  lang: "en",
  setLang: () => {},
  t: key => key,
  tn: label => label,
  dir: "ltr",
});

/** Reads/writes the language choice, mirroring the dark-mode hook: a blocking
 *  inline script in the root layout already sets lang/dir before hydration,
 *  so this provider only needs to read it back on mount — never guess. */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const current = document.documentElement.getAttribute("lang");
    if (current === "ur" || current === "en") setLangState(current);
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    applyLangAttrs(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
  }, []);

  const t = useCallback((key: string) => translate(lang, key), [lang]);
  const tn = useCallback((label: string) => translateNavLabel(lang, label), [lang]);
  const dir = useMemo(() => (LANGUAGES.find(l => l.code === lang)?.dir ?? "ltr"), [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, tn, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
