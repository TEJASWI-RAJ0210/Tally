import AsyncStorage from "@react-native-async-storage/async-storage";

const LEGACY_OUTBOX_KEY = "offline-outbox";
const syncListeners = new Set<() => void>();

export function registerOutboxSyncListener(listener: () => void) {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}

export function triggerOutboxSync() {
  syncListeners.forEach((listener) => listener());
}

export interface OutboxAction {
  id: string;
  type: "CREATE_EXPENSE" | "CREATE_SETTLEMENT";
  payload: unknown;
  createdAt: string;
  status?: "PENDING" | "NEEDS_ATTENTION";
  attempts?: number;
  lastError?: string;
}

function outboxKey(userId: string) {
  return `offline-outbox:${userId}`;
}

function localId() {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function enqueueOfflineAction(action: Omit<OutboxAction, "id" | "createdAt">, userId: string) {
  const queue = await getOutbox(userId);
  const id = localId();
  const payload = action.type === "CREATE_SETTLEMENT" && action.payload && typeof action.payload === "object"
    ? { ...(action.payload as Record<string, unknown>), idempotencyKey: id }
    : action.payload;
  queue.push({ ...action, payload, id, createdAt: new Date().toISOString(), status: "PENDING", attempts: 0 });
  await AsyncStorage.setItem(outboxKey(userId), JSON.stringify(queue));
}

export async function updateOutboxAction(id: string, userId: string, changes: Partial<OutboxAction>) {
  const queue = await getOutbox(userId);
  await AsyncStorage.setItem(outboxKey(userId), JSON.stringify(queue.map((action) => action.id === id ? { ...action, ...changes } : action)));
}

export async function retryOutboxAction(id: string, userId: string) {
  await updateOutboxAction(id, userId, { status: "PENDING", attempts: 0, lastError: undefined });
}

export async function makeIdempotencyKey() {
  return localId();
}

export async function getOutbox(userId: string): Promise<OutboxAction[]> {
  const key = outboxKey(userId);
  const raw = await AsyncStorage.getItem(key);
  if (raw) return JSON.parse(raw) as OutboxAction[];

  // Migrate actions created by earlier app versions to the account currently signed in.
  const legacyRaw = await AsyncStorage.getItem(LEGACY_OUTBOX_KEY);
  if (!legacyRaw) return [];
  const legacyQueue = (JSON.parse(legacyRaw) as OutboxAction[]).map((action) => {
    if (action.type !== "CREATE_SETTLEMENT" || !action.payload || typeof action.payload !== "object") return action;
    const payload = action.payload as Record<string, unknown>;
    return { ...action, payload: { ...payload, fromUserId: payload.fromUserId ?? userId } };
  });
  await AsyncStorage.setItem(key, JSON.stringify(legacyQueue));
  await AsyncStorage.removeItem(LEGACY_OUTBOX_KEY);
  return legacyQueue;
}

export async function removeFromOutbox(id: string, userId: string) {
  const queue = await getOutbox(userId);
  await AsyncStorage.setItem(outboxKey(userId), JSON.stringify(queue.filter((action) => action.id !== id)));
}

export async function clearOutbox(userId: string) {
  await AsyncStorage.removeItem(outboxKey(userId));
}
