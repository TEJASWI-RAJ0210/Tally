import axios from "axios";
import Constants from "expo-constants";
import { useAuthStore } from "@/store/authStore";

const API_URL = (Constants.expoConfig?.extra?.apiUrl as string) ?? "http://localhost:3000/api";

export const api = axios.create({ baseURL: API_URL, timeout: 8_000 });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let pendingQueue: Array<{ resolve: () => void; reject: (error: unknown) => void }> = [];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }
    original._retry = true;

    const { refreshToken, setTokens, logout } = useAuthStore.getState();
    if (!refreshToken) {
      await logout();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      await new Promise<void>((resolve, reject) => pendingQueue.push({ resolve, reject }));
      return api(original);
    }

    isRefreshing = true;
    try {
      const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
      await setTokens(data.accessToken, data.refreshToken);
      pendingQueue.forEach((waiter) => waiter.resolve());
      pendingQueue = [];
      return api(original);
    } catch (refreshError) {
      pendingQueue.forEach((waiter) => waiter.reject(refreshError));
      pendingQueue = [];
      await logout();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
