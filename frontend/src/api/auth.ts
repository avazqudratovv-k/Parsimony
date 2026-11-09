import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "./client";
import type { User } from "./types";

export const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

// "Who am I?" A 401 is a normal answer here (signed out), so it resolves to null, not an error.
export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async (): Promise<User | null> => {
    try {
      return await api<User>("/auth/me");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  },
  staleTime: 60_000,
  retry: false,
});

function useSetMe() {
  const qc = useQueryClient();
  return (user: User | null) => qc.setQueryData(meQuery.queryKey, user);
}

export function useSignup() {
  const setMe = useSetMe();
  return useMutation({
    mutationFn: (v: { email: string; password: string }) =>
      api<User>("/auth/signup", { method: "POST", body: { ...v, timezone: browserTimezone() } }),
    onSuccess: setMe,
  });
}

export function useLogin() {
  const setMe = useSetMe();
  return useMutation({
    mutationFn: (v: { email: string; password: string }) =>
      api<User>("/auth/login", { method: "POST", body: v }),
    onSuccess: setMe,
  });
}

export function useDemo() {
  const setMe = useSetMe();
  return useMutation({
    mutationFn: () => api<User>("/auth/demo", { method: "POST", body: { timezone: browserTimezone() } }),
    onSuccess: setMe,
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      qc.clear();
      qc.setQueryData(meQuery.queryKey, null);
    },
  });
}

export function useUpdateMe() {
  const setMe = useSetMe();
  return useMutation({
    mutationFn: (v: { default_currency?: string; timezone?: string }) =>
      api<User>("/auth/me", { method: "PATCH", body: v }),
    onSuccess: setMe,
  });
}

export function useDeleteMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("/auth/me", { method: "DELETE" }),
    onSuccess: () => {
      qc.clear();
      qc.setQueryData(meQuery.queryKey, null);
    },
  });
}
