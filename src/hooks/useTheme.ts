import { useCallback, useEffect, useState } from "react";

export type AppTheme = "matte" | "navy" | "cream";

const THEME_KEY = "fs_theme";

const isTheme = (v: unknown): v is AppTheme =>
  v === "matte" || v === "navy" || v === "cream";

export const getStoredTheme = (): AppTheme => {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (isTheme(raw)) return raw;
  } catch {
    // localStorage unavailable (private mode) — fall through to default.
  }
  return "matte";
};

const applyTheme = (theme: AppTheme) => {
  document.documentElement.dataset.theme = theme;
};

/** App-wide theme (matte black default, navy dark, cream light). Emerald accent is constant. */
export function useTheme() {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    const stored = getStoredTheme();
    applyTheme(stored);
    return stored;
  });

  // Re-apply on mount so the persisted theme takes effect on every full page
  // load (entry flow remounts from scratch; CSS default is matte).
  useEffect(() => {
    applyTheme(getStoredTheme());
  }, []);

  const setTheme = useCallback((next: AppTheme) => {
    setThemeState(next);
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Non-fatal: theme still applies for this session.
    }
  }, []);

  return { theme, setTheme };
}
