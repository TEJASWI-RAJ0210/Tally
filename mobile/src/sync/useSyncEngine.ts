import { useEffect, useRef } from "react";
import NetInfo from "@react-native-community/netinfo";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { getOutbox, removeFromOutbox, OutboxAction } from "./outboxQueue";

export function useSyncEngine() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);
  const isSyncing = useRef(false);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const syncOutbox = async () => {
      if (isSyncing.current || !active) return;
      isSyncing.current = true;
      let shouldRetry = false;
      try {
        const queue = await getOutbox(userId);
        for (const action of queue) {
          try {
            await replay(action);
            await removeFromOutbox(action.id, userId);
          } catch (err) {
            console.warn("Sync failed for action", action.id, err);
            shouldRetry = true;
            break;
          }
        }
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["expenses"] }),
          queryClient.invalidateQueries({ queryKey: ["balances"] }),
          queryClient.invalidateQueries({ queryKey: ["groups"] }),
        ]);
      } catch (err) {
        console.warn("Offline queue sync failed", err);
        shouldRetry = true;
      } finally {
        isSyncing.current = false;
      }
      if (shouldRetry && active) retryTimer = setTimeout(() => void syncOutbox(), 15_000);
    };
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) void syncOutbox();
    });
    void NetInfo.fetch().then((state) => {
      if (state.isConnected) void syncOutbox();
    });
    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      unsubscribe();
    };
  }, [userId, queryClient]);
}

async function replay(action: OutboxAction) {
  switch (action.type) {
    case "CREATE_EXPENSE":
      return api.post("/expenses", action.payload);
    case "CREATE_SETTLEMENT":
      return api.post("/settlements", action.payload);
  }
}
