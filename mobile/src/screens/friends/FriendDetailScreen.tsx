import React from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useExpenses } from "@/api/hooks/useExpenses";
import { useBalances } from "@/api/hooks/useBalances";
import { useAuthStore } from "@/store/authStore";
import { formatCurrency } from "@/utils/currency";
import { useTheme } from "@/theme/ThemeProvider";
import { createCommonStyles } from "@/theme/commonStyles";
import Icon from "@/components/Icon";
import { SafeAreaView } from "react-native-safe-area-context";

export default function FriendDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { friendId } = route.params;
  const user = useAuthStore((state) => state.user);
  const { data: expenses, isLoading, isError } = useExpenses({ friendId });
  const { data: balanceData, isLoading: balancesLoading, isError: balancesError } = useBalances();
  const { colors } = useTheme();
  const styles = createCommonStyles(colors);
  const balances = Array.isArray(balanceData?.balances) ? balanceData.balances : [];
  const friendBalance = balances.find((item) => item.friend?.id === friendId);
  const balance = friendBalance?.balance ?? "0.00";
  const numericBalance = Number(balance);
  const fromUserId = numericBalance > 0 ? friendId : user?.id;
  const toUserId = numericBalance > 0 ? user?.id : friendId;
  const friendName = friendBalance?.friend?.name ?? "your friend";
  const fromName = numericBalance > 0 ? friendName : user?.name;
  const toName = numericBalance > 0 ? user?.name : friendName;

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}
        data={expenses ?? []}
        keyExtractor={(e: any) => e.id}
        renderItem={({ item }: any) => (
          <View style={styles.row}>
            <View>
              <Text style={{ color: colors.text, fontWeight: "600" }}>{item.description}</Text>
              <Text style={[styles.muted, { fontSize: 13 }]}>{new Date(item.date).toLocaleDateString()}</Text>
              {!!item.shares?.length && <Text style={[styles.muted, { fontSize: 12, marginTop: 3 }]} numberOfLines={2}>
                {item.shares.map((share: any) => `${share.user?.name ?? "Member"} ${formatCurrency(share.amountOwed)}`).join(" · ")}
              </Text>}
            </View>
            <Text style={{ color: colors.text, fontWeight: "600" }}>{formatCurrency(item.amount)}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={[isError ? styles.errorText : styles.muted, { textAlign: "center", paddingVertical: 32 }]}>
            {isLoading ? "Loading shared expenses…" : isError ? "Couldn't load shared expenses." : "No shared expenses yet."}
          </Text>
        }
        ListHeaderComponent={
          <>
            <View style={[styles.card, { marginTop: 12, marginBottom: 12 }]}>
              <Text style={styles.muted}>{balancesLoading ? "Loading balance…" : balancesError ? "Balance unavailable" : numericBalance > 0 ? "They owe you" : numericBalance < 0 ? "You owe them" : "All settled"}</Text>
              <Text style={{ color: numericBalance >= 0 ? colors.owed : colors.owe, fontSize: 26, fontWeight: "700", marginTop: 4 }}>
                {formatCurrency(Math.abs(numericBalance))}
              </Text>
            </View>
            {isLoading && <Text style={[styles.muted, { paddingVertical: 8 }]}>Loading shared expenses…</Text>}
            {isError && <Text style={styles.errorText}>Couldn't load shared expenses. Check your connection and reopen this screen.</Text>}
            <Pressable onPress={() => navigation.navigate("AddExpense", { friendId })} style={[styles.primaryButton, { marginTop: 4 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Icon name="plus-circle-outline" color="#fff" size={20} />
                <Text style={styles.primaryButtonText}>Add shared expense</Text>
              </View>
            </Pressable>
          </>
        }
        ListFooterComponent={
          <View>
            <Pressable
              disabled={numericBalance === 0 || !user || balancesLoading || balancesError}
              onPress={() => navigation.navigate("SettleUp", { fromUserId, toUserId, fromName, toName, currentBalance: Math.abs(numericBalance), friendId })}
              style={[styles.primaryButton, { marginBottom: 20, opacity: numericBalance === 0 || balancesLoading ? 0.5 : 1 }]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Icon name="check-circle-outline" color="#fff" size={20} />
                <Text style={styles.primaryButtonText}>{numericBalance > 0 ? "Record payment received" : numericBalance < 0 ? "Settle up" : "Nothing to settle"}</Text>
              </View>
            </Pressable>
          </View>
        }
      />
    </View>
    </SafeAreaView>
  );
}
