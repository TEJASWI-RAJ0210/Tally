import React, { useEffect } from "react";
import { AppState } from "react-native";
import { StatusBar } from "expo-status-bar";
import { focusManager, QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

import { ThemeProvider } from "@/theme/ThemeProvider";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import RootNavigator from "@/navigation/RootNavigator";
import { useSyncEngine } from "@/sync/useSyncEngine";
import { api } from "@/api/client";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      gcTime: 1000 * 60 * 60 * 24, // keep cached data around 24h for offline viewing
    },
  },
});

const persister = createAsyncStoragePersister({ storage: AsyncStorage });

function AppShell() {
  const user = useAuthStore((s) => s.user);
  const { mode } = useTheme();
  useSyncEngine(); // starts listening for reconnect, replays the offline outbox

  useEffect(() => {
    // Expo Go's Android client does not include the native push notification
    // modules required by expo-notifications. Load it only in a native build.
    if (user && Constants.executionEnvironment !== "storeClient") {
      void registerForPushNotifications();
    }
  }, [user]);

  return <>
    <StatusBar style={mode === "dark" ? "light" : "dark"} />
    <RootNavigator />
  </>;
}

async function registerForPushNotifications() {
  try {
    const Notifications = await import("expo-notifications");
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    const { status } = await Notifications.getPermissionsAsync();
    let finalStatus = status;
    if (status !== "granted") {
      const { status: requested } = await Notifications.requestPermissionsAsync();
      finalStatus = requested;
    }
    if (finalStatus !== "granted") return;

    const { data: token } = await Notifications.getExpoPushTokenAsync();
    await api.patch("/users/me/push-token", { token });
  } catch (error) {
    // Push registration is optional and can fail when the native app has no
    // notification module or the user denies permission.
    console.warn("Push notification setup unavailable", error);
  }
}

export default function App() {
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  useEffect(() => {
    hydrateAuth();
    hydrateTheme();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      focusManager.setFocused(state === "active");
    });
    return () => subscription.remove();
  }, []);

  if (!isHydrated) return null; // swap in a splash/loading component here

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      <ThemeProvider>
        <SafeAreaProvider>
          <AppShell />
        </SafeAreaProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}
