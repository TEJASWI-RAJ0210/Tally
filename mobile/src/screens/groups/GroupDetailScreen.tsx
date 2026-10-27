import React from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useGroup } from "@/api/hooks/useGroups";
import { formatCurrency } from "@/utils/currency";
import { useTheme } from "@/theme/ThemeProvider";
import { createCommonStyles } from "@/theme/commonStyles";
import Icon from "@/components/Icon";
import { useAuthStore } from "@/store/authStore";
import { SafeAreaView } from "react-native-safe-area-context";

export default function GroupDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { groupId } = route.params;
  const user = useAuthStore((state) => state.user);
  const { data: group, isLoading: groupLoading, isError: groupError, isRefetching: groupRefreshing, refetch: refetchGroup } = useGroup(groupId);
  const { colors } = useTheme();
  const styles = createCommonStyles(colors);

  const { data, isLoading: balancesLoading, isError: balancesError, isRefetching: balancesRefreshing, refetch: refetchBalances } = useQuery({
    queryKey: ["balances", "group", groupId],
    queryFn: async () => (await api.get(`/balances/group/${groupId}`)).data,
  });

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
      refreshControl={<RefreshControl refreshing={groupRefreshing || balancesRefreshing} onRefresh={() => { void Promise.all([refetchGroup(), refetchBalances()]); }} tintColor={colors.accent} />}
    >
      {group && (
        <View style={[styles.card, { marginBottom: 20 }]}>
          <Text style={styles.title}>{group.name}</Text>
          <Text style={styles.subtitle}>Members · {group.members.length}</Text>
          <Text style={styles.muted}>{(Array.isArray(group.members) ? group.members : []).map((member: any) => member.user?.name).filter(Boolean).join(", ")}</Text>
        </View>
      )}
      {groupLoading && <Text style={styles.muted}>Loading group…</Text>}
      {groupError && <Text style={styles.errorText}>Couldn't load this group. It may have been removed or you may no longer be a member.</Text>}

      <Pressable onPress={() => navigation.navigate("AddExpense", { groupId })} style={[styles.primaryButton, { marginTop: 0, marginBottom: 20 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name="plus-circle-outline" color="#fff" size={20} />
          <Text style={styles.primaryButtonText}>Add group expense</Text>
        </View>
      </Pressable>

      <Text style={styles.subtitle}>Group expenses</Text>
      {(Array.isArray(group?.expenses) ? group.expenses : []).map((expense: any) => (
        <View key={expense.id} style={styles.row}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ color: colors.text, fontWeight: "600" }}>{expense.description}</Text>
            <Text style={styles.muted}>Paid by {expense.paidBy.name} · {new Date(expense.date).toLocaleDateString()}</Text>
            {!!expense.shares?.length && <Text style={[styles.muted, { fontSize: 12, marginTop: 3 }]} numberOfLines={2}>
              {expense.shares.map((share: any) => `${share.user?.name ?? "Member"} ${formatCurrency(share.amountOwed)}`).join(" · ")}
            </Text>}
          </View>
          <Text style={{ color: colors.text, fontWeight: "600" }}>{formatCurrency(expense.amount)}</Text>
        </View>
      ))}
      {!groupLoading && !groupError && (!Array.isArray(group?.expenses) || group.expenses.length === 0) && (
        <Text style={[styles.muted, { paddingVertical: 12 }]}>No group expenses yet.</Text>
      )}

      <Text style={[styles.subtitle, { marginTop: 24 }]}>Simplified settle-up</Text>
      {balancesLoading && <Text style={styles.muted}>Calculating balances…</Text>}
      {balancesError && <Text style={styles.errorText}>Couldn't load group balances. Pull down to retry.</Text>}
      {!balancesError && (Array.isArray(data?.simplifiedSettlementPlan) ? data.simplifiedSettlementPlan : []).map((item: any, index: number) => {
        const canRecord = user?.id === item.from.id || user?.id === item.to.id;
        return (
          <View key={`${item.from.id}-${item.to.id}-${index}`} style={[styles.row, { gap: 12 }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text }}>{item.from.name} pays {item.to.name}</Text>
              <Text style={{ color: colors.text, fontWeight: "700" }}>{formatCurrency(item.amount)}</Text>
            </View>
            {canRecord && (
              <Pressable
                onPress={() => navigation.navigate("SettleUp", {
                  fromUserId: item.from.id,
                  toUserId: item.to.id,
                  fromName: item.from.name,
                  toName: item.to.name,
                  currentBalance: item.amount,
                  groupId,
                })}
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Icon name="check-circle-outline" color={colors.accent} size={18} />
                <Text style={{ color: colors.accent, fontWeight: "600" }}>{user?.id === item.from.id ? "Pay" : "Confirm"}</Text>
              </Pressable>
            )}
          </View>
        );
      })}
      {!balancesLoading && !balancesError && (!Array.isArray(data?.simplifiedSettlementPlan) || data.simplifiedSettlementPlan.length === 0) && (
        <Text style={[styles.muted, { paddingVertical: 12 }]}>Everyone's settled up.</Text>
      )}
    </ScrollView>
    </SafeAreaView>
  );
}
