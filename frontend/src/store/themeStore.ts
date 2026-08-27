import { create } from "zustand";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "sma-theme";

function getSystemDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const isDark = theme === "dark" || (theme === "system" && getSystemDark());
  document.documentElement.classList.toggle("dark", isDark);
}

function loadStoredTheme(): Theme {
  if (
    typeof window === "undefined" ||
    typeof window.localStorage === "undefined" ||
    typeof window.localStorage.getItem !== "function"
  ) {
    return "system";
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "system";
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedDark: boolean;
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const theme = loadStoredTheme();
  applyTheme(theme);
  const resolvedDark = theme === "dark" || (theme === "system" && getSystemDark());

  if (typeof window !== "undefined" && theme === "system") {
    window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", () => {
      applyTheme("system");
      set({ resolvedDark: getSystemDark() });
    });
  }

  return {
    theme,
    resolvedDark,
    setTheme: (next: Theme) => {
      applyTheme(next);
      if (typeof window?.localStorage?.setItem === "function") {
        window.localStorage.setItem(STORAGE_KEY, next);
      }
      set({
        theme: next,
        resolvedDark: next === "dark" || (next === "system" && getSystemDark()),
      });
    },
  };
});
