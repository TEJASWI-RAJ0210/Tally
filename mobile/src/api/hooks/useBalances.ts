import { useQuery } from "@tanstack/react-query";
import { api } from "../client";

export interface BalanceSummary {
  totalOwedToYou: string;
  totalYouOwe: string;
  balances: Array<{
    friend: { id: string; name: string; username: string; avatarUrl?: string };
    balance: string;
  }>;
  groupBalances: Array<{
    group: { id: string; name: string };
    balance: string;
  }>;
}

export function useBalances() {
  return useQuery({
    queryKey: ["balances"],
    queryFn: async () => {
      const response = (await api.get<Partial<BalanceSummary>>("/balances")).data;
      return {
        totalOwedToYou: response?.totalOwedToYou ?? "0.00",
        totalYouOwe: response?.totalYouOwe ?? "0.00",
        balances: Array.isArray(response?.balances) ? response.balances : [],
        groupBalances: Array.isArray(response?.groupBalances) ? response.groupBalances : [],
      } satisfies BalanceSummary;
    },
    staleTime: 30_000,
  });
}
