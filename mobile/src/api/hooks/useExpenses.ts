import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { enqueueOfflineAction } from "@/sync/outboxQueue";
import NetInfo from "@react-native-community/netinfo";

export interface CreateExpenseInput {
  description: string;
  amount: number;
  category?: string;
  groupId?: string;
  paidById: string;
  splitType: "EQUAL" | "EXACT";
  shares: Array<{ userId: string; amountOwed: number }>;
}

export function useExpenses(params: { groupId?: string; friendId?: string }) {
  return useQuery({
    queryKey: ["expenses", params],
    queryFn: async () => {
      const qs = new URLSearchParams(params as Record<string, string>).toString();
      const expenses = (await api.get(`/expenses?${qs}`)).data?.expenses;
      return Array.isArray(expenses) ? expenses : [];
    },
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateExpenseInput) => {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        await enqueueOfflineAction({ type: "CREATE_EXPENSE", payload: input }, input.paidById);
        return { queued: true, ...input };
      }
      return (await api.post("/expenses", input)).data.expense;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
  });
}
