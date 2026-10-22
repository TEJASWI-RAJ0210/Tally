import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

type ThemeOverride = "light" | "dark" | null;

interface ThemeState {
  override: ThemeOverride;
  setOverride: (mode: ThemeOverride) => void;
  hydrate: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  override: null,
  setOverride: (mode) => {
    set({ override: mode });
    AsyncStorage.setItem("theme-override", mode ?? "system");
  },
  hydrate: async () => {
    const saved = await AsyncStorage.getItem("theme-override");
    if (saved && saved !== "system") set({ override: saved as ThemeOverride });
  },
}));
