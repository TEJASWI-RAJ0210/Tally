import React, { createContext, useContext, useMemo } from "react";
import { Appearance } from "react-native";
import { useThemeStore } from "@/store/themeStore";
import { lightColors, darkColors } from "./tokens";

type ThemeContextValue = { mode: "light" | "dark"; colors: typeof lightColors };

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const override = useThemeStore((s) => s.override);
  const systemScheme = Appearance.getColorScheme() === "dark" ? "dark" : "light";
  const mode = override ?? systemScheme;
  const colors = mode === "dark" ? darkColors : lightColors;
  const value = useMemo(() => ({ mode, colors }), [mode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
