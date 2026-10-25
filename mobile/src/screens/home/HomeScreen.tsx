import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { useBalances } from "@/api/hooks/useBalances";
import { formatCurrency } from "@/utils/currency";
import { useTheme } from "@/theme/ThemeProvider";
import { createCommonStyles } from "@/theme/commonStyles";
import Icon from "@/components/Icon";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import PendingPaymentRequests from "@/components/PendingPaymentRequests";

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { data, isLoading, isError, refetch, isRefetching } = useBalances();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const styles = createCommonStyles(colors);
  const insets = useSafeAreaInsets();

  const refreshHome = () => {
    void Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: ["settlements", "pending"] }),
    ]);
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ paddingTop: 14, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refreshHome} tintColor={colors.accent} />}
      >
        <Text style={styles.title}>Overview</Text>
        <Text style={[styles.muted, { marginTop: -12, marginBottom: 20 }]}>Your shared spending, at a glance.</Text>

        <Text style={[styles.subtitle, { marginBottom: 12 }]}>Personal balances</Text>
        <View style={[styles.card, { flexDirection: "row", marginBottom: 24 }]}>
          <View style={{ flex: 1 }}>
            <Icon name="arrow-down-left" color={colors.owed} size={20} />
            <Text style={[styles.muted, { marginBottom: 4 }]}>You are owed</Text>
            <Text style={{ color: colors.owed, fontSize: 22, fontWeight: "700" }}>
              {isLoading ? "..." : isError ? "—" : formatCurrency(data?.totalOwedToYou ?? "0")}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Icon name="arrow-up-right" color={colors.owe} size={20} />
            <Text style={[styles.muted, { marginBottom: 4 }]}>You owe</Text>
            <Text style={{ color: colors.owe, fontSize: 22, fontWeight: "700" }}>
              {isLoading ? "..." : isError ? "—" : formatCurrency(data?.totalYouOwe ?? "0")}
            </Text>
          </View>
        </View>
        <PendingPaymentRequests />

        <Text style={styles.subtitle}>Friends</Text>
        {(data?.balances ?? []).map((item) => {
          const amount = Number(item.balance);
          const isOwedToYou = amount > 0;
          return (
            <Pressable key={item.friend.id} onPress={() => navigation.navigate("FriendDetail", { friendId: item.friend.id })} style={styles.row}>
              <Text style={{ color: colors.text, fontSize: 16 }}>{item.friend.name}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ color: isOwedToYou ? colors.owed : colors.owe, fontWeight: "600" }}>
                  {formatCurrency(Math.abs(amount))}
                </Text>
                <Icon name="chevron-right" color={colors.muted} size={20} />
              </View>
            </Pressable>
          );
        })}
        {!data?.balances.length && (
          <Text style={[isError ? styles.errorText : styles.muted, { textAlign: "center", paddingVertical: 32 }]}>
            {isLoading ? "Loading balances…" : isError ? "Couldn't load balances. Pull down to retry." : "No balances yet — add a friend and your first expense to get started."}
          </Text>
        )}
        <Text style={[styles.subtitle, { marginTop: 28 }]}>Group balances</Text>
        {(data?.groupBalances ?? []).map(({ group, balance }) => {
          const amount = Number(balance);
          const color = amount > 0 ? colors.owed : amount < 0 ? colors.owe : colors.muted;
          return (
            <Pressable key={group.id} onPress={() => navigation.navigate("GroupDetail", { groupId: group.id })} style={styles.row}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ color: colors.text, fontSize: 16 }}>{group.name}</Text>
                <Text style={styles.muted}>{amount > 0 ? "Group owes you" : amount < 0 ? "You owe the group" : "All settled"}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ color, fontWeight: "600" }}>{formatCurrency(Math.abs(amount))}</Text>
                <Icon name="chevron-right" color={colors.muted} size={20} />
              </View>
            </Pressable>
          );
        })}
        {!isLoading && !isError && !(data?.groupBalances ?? []).length && (
          <Text style={[styles.muted, { paddingVertical: 12 }]}>Your group balances stay separate from personal balances.</Text>
        )}
      </ScrollView>

      <Pressable onPress={() => navigation.navigate("AddExpense")} style={[localStyles.fab, { backgroundColor: colors.accent, bottom: Math.max(insets.bottom, 12) + 16 }]}>
        <Icon name="plus" color="#fff" size={28} />
      </Pressable>
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  fab: { position: "absolute", bottom: 32, right: 24, width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", elevation: 4 },
});
