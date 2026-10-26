import { useEffect, useRef } from "react";
import NetInfo from "@react-native-community/netinfo";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { getOutbox, registerOutboxSyncListener, removeFromOutbox, updateOutboxAction, OutboxAction } from "./outboxQueue";

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
        const network = await NetInfo.fetch();
        if (!network.isConnected) return;
        const queue = await getOutbox(userId);
        for (const action of queue) {
          if (action.status === "NEEDS_ATTENTION") continue;
          try {
            await replay(action);
            await removeFromOutbox(action.id, userId);
          } catch (err) {
            console.warn("Sync failed for action", action.id, err);
            const status = (err as { response?: { status?: number } })?.response?.status;
            const attempts = (action.attempts ?? 0) + 1;
            const permanent = status !== undefined && status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429;
            const repeatedFailure = attempts >= 5;
            const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? (err instanceof Error ? err.message : "Could not sync this item");
            await updateOutboxAction(action.id, userId, {
              attempts,
              status: permanent || repeatedFailure ? "NEEDS_ATTENTION" : "PENDING",
              lastError: message,
            });
            if (!permanent && !repeatedFailure) {
              shouldRetry = true;
              break;
            }
          }
        }
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["expenses"] }),
          queryClient.invalidateQueries({ queryKey: ["balances"] }),
          queryClient.invalidateQueries({ queryKey: ["friends"] }),
          queryClient.invalidateQueries({ queryKey: ["groups"] }),
          queryClient.invalidateQueries({ queryKey: ["settlements"] }),
          queryClient.invalidateQueries({ queryKey: ["outbox", userId] }),
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
    const unsubscribeManual = registerOutboxSyncListener(() => void syncOutbox());
    void NetInfo.fetch().then((state) => {
      if (state.isConnected) void syncOutbox();
    });
    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      unsubscribe();
      unsubscribeManual();
    };
  }, [userId, queryClient]);
}

async function replay(action: OutboxAction) {
  switch (action.type) {
    case "CREATE_EXPENSE":
      return api.post("/expenses", action.payload);
    case "CREATE_SETTLEMENT":
      return api.post("/settlements", {
        ...(action.payload as Record<string, unknown>),
        idempotencyKey: (action.payload as Record<string, unknown>)?.idempotencyKey ?? action.id,
      });
  }
}
