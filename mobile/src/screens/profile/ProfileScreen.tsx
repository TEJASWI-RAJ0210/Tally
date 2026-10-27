import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { useTheme } from "@/theme/ThemeProvider";
import { createCommonStyles } from "@/theme/commonStyles";
import Icon from "@/components/Icon";
import { SafeAreaView } from "react-native-safe-area-context";
import { getOutbox, removeFromOutbox, retryOutboxAction, triggerOutboxSync } from "@/sync/outboxQueue";

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { override, setOverride } = useThemeStore();
  const { colors } = useTheme();
  const styles = createCommonStyles(colors);
  const queryClient = useQueryClient();
  const { data: outbox = [] } = useQuery({
    queryKey: ["outbox", user?.id],
    queryFn: () => getOutbox(user!.id),
    enabled: !!user,
  });
  const attentionItems = outbox.filter((item) => item.status === "NEEDS_ATTENTION");

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: 24, paddingBottom: 36 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <Icon name="account-outline" color="#fff" size={36} />
      </View>
      <Text style={styles.title}>{user?.name}</Text>
      <Text style={[styles.muted, { marginBottom: 32 }]}>@{user?.username}</Text>

      <Text style={styles.subtitle}>Theme</Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 32 }}>
        {(["light", "dark", null] as const).map((mode) => (
          <Pressable
            key={mode ?? "system"}
            onPress={() => setOverride(mode)}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              backgroundColor: override === mode ? colors.accent : "transparent",
              borderColor: override === mode ? colors.accent : colors.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Icon name={mode === "light" ? "white-balance-sunny" : mode === "dark" ? "moon-waning-crescent" : "theme-light-dark"} color={override === mode ? "#fff" : colors.text} size={16} />
              <Text style={{ color: override === mode ? "#fff" : colors.text }}>{mode ? mode[0].toUpperCase() + mode.slice(1) : "System"}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      <Text style={styles.subtitle}>Offline items needing attention</Text>
      {attentionItems.length === 0 ? <Text style={[styles.muted, { marginBottom: 24 }]}>Nothing is waiting to sync.</Text> : attentionItems.map((item) => (
        <View key={item.id} style={[styles.card, { padding: 14, marginBottom: 10 }]}>
          <Text style={{ color: colors.text, fontWeight: "600" }}>{item.type === "CREATE_SETTLEMENT" ? "Payment" : "Expense"}</Text>
          <Text style={[styles.muted, { marginTop: 4 }]}>{item.lastError ?? "This item could not be synced."}</Text>
          <View style={{ flexDirection: "row", gap: 20, marginTop: 12 }}>
            <Pressable onPress={async () => { await retryOutboxAction(item.id, user!.id); await queryClient.invalidateQueries({ queryKey: ["outbox", user!.id] }); triggerOutboxSync(); }}>
              <Text style={{ color: colors.accent, fontWeight: "700" }}>Retry</Text>
            </Pressable>
            <Pressable onPress={async () => { await removeFromOutbox(item.id, user!.id); await queryClient.invalidateQueries({ queryKey: ["outbox", user!.id] }); }}>
              <Text style={{ color: colors.owe, fontWeight: "600" }}>Discard</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <Pressable onPress={() => logout()} style={{ paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon name="logout" color={colors.owe} size={20} />
        <Text style={{ color: colors.owe, fontWeight: "600" }}>Log out</Text>
      </Pressable>
    </ScrollView>
    </SafeAreaView>
  );
}
