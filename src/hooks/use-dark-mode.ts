"use client";

import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "theme";

function applyThemeClass(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
}

/** Reads/writes the `.dark` class on <html> and persists the choice to localStorage.
 *  The blocking inline script in the root layout already sets the class before
 *  hydration, so this hook only needs to read it back — never a default guess. */
export function useDarkMode() {
  const [darkMode, setDarkModeState] = useState(false);

  useEffect(() => {
    setDarkModeState(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkModeState(prev => {
      const next = !prev;
      applyThemeClass(next);
      try { localStorage.setItem(STORAGE_KEY, next ? "dark" : "light"); } catch {}
      return next;
    });
  }, []);

  return { darkMode, toggleDarkMode };
}
