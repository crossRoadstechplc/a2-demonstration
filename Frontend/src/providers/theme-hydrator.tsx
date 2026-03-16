"use client";

import { useEffect } from "react";

import { useUiStore } from "@/store/ui-store";

const THEME_STORAGE_KEY = "a2_theme_mode";

function applyThemeToDom(themeMode: "dark" | "light") {
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(themeMode);
}

export function ThemeHydrator() {
  const themeMode = useUiStore((state) => state.themeMode);
  const setThemeMode = useUiStore((state) => state.setThemeMode);

  useEffect(() => {
    const persisted = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (persisted === "light" || persisted === "dark") {
      if (persisted !== themeMode) {
        setThemeMode(persisted);
      }
      applyThemeToDom(persisted);
      return;
    }
    applyThemeToDom(themeMode);
    // Hydration should run once on mount to avoid setState loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyThemeToDom(themeMode);
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  return null;
}
