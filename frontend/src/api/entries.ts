import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { browserTimezone } from "./auth";
import { prepareReceipt } from "../lib/photo";
import type { Category, Entry, EntryCreated, EntryUpdate, PaymentMethod, MonthlyStats, Overview, UsageStatus } from "./types";

// One place to say "the numbers changed": every list, total and counter refetches.
function useRefreshData() {
  const qc = useQueryClient();
  return () =>
    Promise.all(
      ["entries", "stats", "overview", "usage"].map((key) => qc.invalidateQueries({ queryKey: [key] })),
    );
}

export const useEntries = (month: string) =>
  useQuery({
    queryKey: ["entries", month],
    queryFn: () => api<Entry[]>(`/entries?month=${month}&limit=100`),
  });

export const useMonthlyStats = (month: string, currency: string | null, enabled = true) =>
  useQuery({
    enabled,
    queryKey: ["stats", month, currency],
    queryFn: () => api<MonthlyStats>(`/stats/monthly?month=${month}${currency ? `&currency=${currency}` : ""}`),
    placeholderData: (previous) => previous, // keep the old chart on screen while the next month loads
  });

export const useUsage = () =>
  useQuery({ queryKey: ["usage"], queryFn: () => api<UsageStatus>("/usage") });

export const useOverview = () =>
  useQuery({ queryKey: ["overview"], queryFn: () => api<Overview>("/stats/overview") });

export function useAddEntry() {
  const refresh = useRefreshData();
  return useMutation({
    mutationFn: (input: string | { text: string; source: "voice" }) => {
      const { text, source } = typeof input === "string" ? { text: input, source: "text" as const } : input;
      return api<EntryCreated>("/entries", { method: "POST", body: { text, source, timezone: browserTimezone() } });
    },
    // A failed AI call still counts toward the daily cap, so refresh the counter either way.
    onSettled: refresh,
  });
}

/** Receipt photo -> one saved entry. The file is downscaled first; the server never stores it. */
export function useAddPhoto() {
  const refresh = useRefreshData();
  return useMutation({
    mutationFn: async ({ file, signal }: { file: File; signal?: AbortSignal }) => {
      const form = new FormData();
      form.append("file", await prepareReceipt(file), "receipt.jpg");
      form.append("timezone", browserTimezone());
      return api<Entry>("/entries/photo", { method: "POST", form, signal });
    },
    onSettled: refresh, // a failed read still counts toward the cap
  });
}

/** Voice clip -> transcript. Nothing is saved yet: the user confirms the words first. */
export function useTranscribe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (wav: Blob) => {
      const form = new FormData();
      form.append("file", wav, "clip.wav");
      return api<{ text: string }>("/entries/transcribe", { method: "POST", form });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["usage"] }), // every clip counts as a smart add
  });
}

export type ManualEntry = {
  date: string;
  merchant: string | null;
  note: string | null;
  amount: string;
  currency: string;
  category: Category;
  payment_method: PaymentMethod;
};

/** Enter an expense by hand: no AI, so it never uses a smart add. */
export function useCreateManual() {
  const refresh = useRefreshData();
  return useMutation({
    mutationFn: (entry: ManualEntry) => api<Entry>("/entries/manual", { method: "POST", body: entry }),
    onSuccess: refresh,
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
