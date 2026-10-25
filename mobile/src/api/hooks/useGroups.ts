import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";

export function useGroups() {
  return useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const groups = (await api.get("/groups")).data?.groups;
      return Array.isArray(groups) ? groups : [];
    },
  });
}

export function useGroup(groupId: string) {
  return useQuery({
    queryKey: ["groups", groupId],
    queryFn: async () => {
      const group = (await api.get(`/groups/${groupId}`)).data?.group;
      if (!group) return null;
      return {
        ...group,
        members: Array.isArray(group.members) ? group.members : [],
        expenses: Array.isArray(group.expenses) ? group.expenses : [],
      };
    },
    enabled: !!groupId,
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; memberIds: string[] }) => (await api.post("/groups", input)).data.group,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["groups"] }),
        queryClient.invalidateQueries({ queryKey: ["balances"] }),
      ]);
    },
  });
}
