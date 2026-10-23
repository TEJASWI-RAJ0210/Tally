import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { useAuthStore } from "@/store/authStore";

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; name: string; username: string; email: string; avatarUrl?: string };
}

export interface SignupInput {
  name: string;
  username: string;
  email: string;
  password: string;
}

export function useSignup() {
  const queryClient = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: async (input: SignupInput) => (await api.post<AuthResponse>("/auth/signup", input)).data,
    onSuccess: async (data) => {
      queryClient.removeQueries();
      await setSession(data.user, data.accessToken, data.refreshToken);
    },
  });
}

export interface LoginInput {
  identifier: string; // email or username
  password: string;
}

export function useLogin() {
  const queryClient = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: async (input: LoginInput) => (await api.post<AuthResponse>("/auth/login", input)).data,
    onSuccess: async (data) => {
      queryClient.removeQueries();
      await setSession(data.user, data.accessToken, data.refreshToken);
    },
  });
}
