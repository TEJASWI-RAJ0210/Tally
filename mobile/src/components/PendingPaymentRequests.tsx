import React, { useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useTheme } from "@/theme/ThemeProvider";
import { createCommonStyles } from "@/theme/commonStyles";
import { formatCurrency } from "@/utils/currency";

export default function PendingPaymentRequests() {
  const user = useAuthStore((state) => state.user);
  const { colors } = useTheme();
  const styles = createCommonStyles(colors);
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["settlements", "pending"],
    queryFn: async () => (await api.get("/settlements", { params: { status: "PENDING", limit: 20 } })).data,
    enabled: !!user,
    retry: false,
  });
  useFocusEffect(useCallback(() => {
    void refetch();
  }, [refetch]));
  const confirm = useMutation({
    mutationFn: async (id: string) => (await api.patch(`/settlements/${id}`, { action: "confirm" })).data,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["settlements"] }),
        queryClient.invalidateQueries({ queryKey: ["balances"] }),
        queryClient.invalidateQueries({ queryKey: ["groups"] }),
        queryClient.invalidateQueries({ queryKey: ["friends"] }),
      ]);
    },
  });
  const items = Array.isArray(data?.settlements) ? data.settlements : [];
  const apiError = (error as any)?.response?.data?.error;

  return (
    <View>
      <Text style={[styles.subtitle, { marginTop: 24, marginBottom: 8 }]}>Payment requests</Text>
      {isLoading && <Text style={styles.muted}>Loading requests…</Text>}
      {isError && <View>
        <Text style={styles.errorText}>{apiError ?? "Couldn't load payment requests. Check your connection and try again."}</Text>
        <Pressable onPress={() => void refetch()}><Text style={{ color: colors.accent, fontWeight: "700", paddingVertical: 8 }}>Retry</Text></Pressable>
      </View>}
      {!isLoading && !isError && items.length === 0 && <Text style={[styles.muted, { paddingVertical: 10 }]}>No pending payment requests.</Text>}
      {items.map((item: any) => (
        <View key={item.id} style={[styles.card, { marginVertical: 6 }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
            <Text style={{ color: colors.text, fontWeight: "600", flex: 1 }} numberOfLines={2}>
              {item.fromUser?.name ?? "Payer"} → {item.toUser?.name ?? "Recipient"}
            </Text>
            <Text style={{ color: colors.text, fontWeight: "700" }}>{formatCurrency(item.amount)}</Text>
          </View>
          <Text style={[styles.muted, { marginTop: 4 }]}>
            {item.initiatedById === user?.id ? `Waiting for ${item.fromUserId === user?.id ? item.toUser?.name : item.fromUser?.name} to confirm` : "Waiting for you to confirm"}
            {` · ${new Date(item.date).toLocaleDateString()}`}
          </Text>
          {!!item.note && <Text style={[styles.muted, { marginTop: 3 }]}>{item.note}</Text>}
          {user?.id !== item.initiatedById && (
            <Pressable disabled={confirm.isPending} onPress={() => confirm.mutate(item.id)} style={{ paddingTop: 12 }}>
              <Text style={{ color: colors.accent, fontWeight: "700", opacity: confirm.isPending ? 0.5 : 1 }}>Confirm payment received</Text>
            </Pressable>
          )}
        </View>
      ))}
      {confirm.isError && <Text style={[styles.errorText, { marginTop: 6 }]}>{(confirm.error as any)?.response?.data?.error ?? "Couldn't confirm this payment."}</Text>}
    </View>
  );
}
