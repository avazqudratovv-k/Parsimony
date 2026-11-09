import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { browserTimezone } from "./auth";
import type { Entry, EntryUpdate, Overview, UsageStatus } from "./types";

// One place to say "the numbers changed": every list, total and counter refetches.
function useRefreshData() {
  const qc = useQueryClient();
  return () =>
    Promise.all(
      ["entries", "overview", "usage"].map((key) => qc.invalidateQueries({ queryKey: [key] })),
    );
}

export const useEntries = () =>
  useQuery({ queryKey: ["entries"], queryFn: () => api<Entry[]>("/entries?limit=100") });

export const useUsage = () =>
  useQuery({ queryKey: ["usage"], queryFn: () => api<UsageStatus>("/usage") });

export const useOverview = () =>
  useQuery({ queryKey: ["overview"], queryFn: () => api<Overview>("/stats/overview") });

export function useAddEntry() {
  const refresh = useRefreshData();
  return useMutation({
    mutationFn: (text: string) =>
      api<Entry>("/entries", { method: "POST", body: { text, timezone: browserTimezone() } }),
    // A failed AI call still counts toward the daily cap, so refresh the counter either way.
    onSettled: refresh,
  });
}

export function useUpdateEntry() {
  const refresh = useRefreshData();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: EntryUpdate }) =>
      api<Entry>(`/entries/${id}`, { method: "PATCH", body: changes }),
    onSuccess: refresh,
  });
}

export function useDeleteEntry() {
  const refresh = useRefreshData();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/entries/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
}
