import React, { useState } from "react";
import { View, TextInput, Pressable, Text, Alert } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { enqueueOfflineAction, makeIdempotencyKey } from "@/sync/outboxQueue";
import NetInfo from "@react-native-community/netinfo";
import { useTheme } from "@/theme/ThemeProvider";
import { createCommonStyles } from "@/theme/commonStyles";
import Icon from "@/components/Icon";
import { useAuthStore } from "@/store/authStore";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SettleUpScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { fromUserId, toUserId, fromName, toName, currentBalance, groupId } = route.params ?? {};
  const user = useAuthStore((state) => state.user);
  const [amount, setAmount] = useState(currentBalance ? Math.abs(Number(currentBalance)).toFixed(2) : "");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const styles = createCommonStyles(colors);

  const settleUp = useMutation({
    mutationFn: async () => {
      const payload = { fromUserId, toUserId, amount: Number(amount), groupId, idempotencyKey: await makeIdempotencyKey() };
      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        if (!user) throw new Error("Please sign in again before recording a payment.");
        await enqueueOfflineAction({ type: "CREATE_SETTLEMENT", payload }, user.id);
        return { queued: true };
      }
      await api.post("/settlements", payload);
      return { queued: false };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["settlements"] });
    },
  });

  const numericAmount = Number(amount);
  const canSubmit = !!user && !!fromUserId && !!toUserId && fromUserId !== toUserId && Number.isFinite(numericAmount) && numericAmount > 0 && !settleUp.isPending;

  async function handleSubmit() {
    setError(null);
    if (!canSubmit) return setError("Enter a valid payment amount.");
    try {
      const result = await settleUp.mutateAsync();
      if (result.queued) Alert.alert("Saved offline", "This payment will sync when your connection is back.");
      navigation.goBack();
    } catch (cause) {
      const requestError = cause as { response?: { data?: { error?: string } } };
      setError(requestError.response?.data?.error ?? "Couldn't record the payment. Check your connection and try again.");
    }
  }

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={[styles.screen, { paddingTop: 18, paddingBottom: 20 }]}>
      <Text style={styles.subtitle}>{user?.id === fromUserId ? `You paid ${toName ?? "your friend"}` : `${fromName ?? "Your friend"} paid you`}</Text>
      <Text style={[styles.muted, { marginBottom: 12 }]}>This records a payment for the other person to confirm. Balances update after they confirm.</Text>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor={colors.muted}
        style={styles.amountText}
        maxLength={12}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
      <Pressable disabled={!canSubmit} onPress={handleSubmit} style={[styles.primaryButton, { opacity: canSubmit ? 1 : 0.4 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name="check-circle-outline" color="#fff" size={20} />
          <Text style={styles.primaryButtonText}>{settleUp.isPending ? "Recording..." : "Request payment confirmation"}</Text>
        </View>
      </Pressable>
    </View>
    </SafeAreaView>
  );
}
