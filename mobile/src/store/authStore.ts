import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  avatarUrl?: string | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isHydrated: boolean;
  setSession: (user: User, accessToken: string, refreshToken: string) => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isHydrated: false,

  setSession: async (user, accessToken, refreshToken) => {
    await SecureStore.setItemAsync("refreshToken", refreshToken);
    await SecureStore.setItemAsync("user", JSON.stringify(user));
    set({ user, accessToken, refreshToken });
  },

  setTokens: async (accessToken, refreshToken) => {
    await SecureStore.setItemAsync("refreshToken", refreshToken);
    set({ accessToken, refreshToken });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync("refreshToken");
    await SecureStore.deleteItemAsync("user");
    set({ user: null, accessToken: null, refreshToken: null });
  },

  hydrate: async () => {
    const [refreshToken, userJson] = await Promise.all([
      SecureStore.getItemAsync("refreshToken"),
      SecureStore.getItemAsync("user"),
    ]);
    if (refreshToken && userJson) {
      set({ refreshToken, user: JSON.parse(userJson) });
    }
    set({ isHydrated: true });
  },
}));
