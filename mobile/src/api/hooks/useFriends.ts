import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";

export interface Friend {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string;
  balance: string;
}

export interface FriendRequest {
  id: string;
  createdAt: string;
  from?: Pick<Friend, "id" | "name" | "username" | "avatarUrl">;
  to?: Pick<Friend, "id" | "name" | "username" | "avatarUrl">;
}

export interface FriendsResponse {
  friends: Friend[];
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
}

export function useFriends() {
  return useQuery({
    queryKey: ["friends"],
    queryFn: async () => {
      const response = (await api.get<Partial<FriendsResponse>>("/friends")).data;
      // Normalize older cached/API payloads so screens can always render lists.
      return {
        friends: Array.isArray(response?.friends) ? response.friends : [],
        incomingRequests: Array.isArray(response?.incomingRequests) ? response.incomingRequests : [],
        outgoingRequests: Array.isArray(response?.outgoingRequests) ? response.outgoingRequests : [],
      } satisfies FriendsResponse;
    },
  });
}

export function useSearchUsers(query: string) {
  return useQuery({
    queryKey: ["friends", "search", query],
    queryFn: async () => {
      const users = (await api.get(`/friends/search?u=${encodeURIComponent(query)}`)).data?.users;
      return Array.isArray(users) ? users : [];
    },
    enabled: query.length >= 2,
  });
}

export function useSendFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (username: string) => (await api.post("/friends/request", { username })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["friends"] }),
  });
}

export function useAcceptFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => (await api.post(`/friends/${requestId}/accept`)).data,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["friends"] }),
        queryClient.invalidateQueries({ queryKey: ["balances"] }),
      ]);
    },
  });
}
