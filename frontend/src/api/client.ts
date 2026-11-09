// One small fetch wrapper. The session lives in an httpOnly cookie, so we never touch tokens.
export class ApiError extends Error {
  status: number;
  code: string | null;
  resetsAt: string | null;

  constructor(status: number, message: string, code: string | null = null, resetsAt: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.resetsAt = resetsAt;
  }
}

// FastAPI sends {detail: "text"}, {detail: {code, message, resets_at}} or {detail: [validation...]}.
function parseDetail(body: unknown): { message: string; code: string | null; resetsAt: string | null } {
  const fallback = { message: "Request failed", code: null, resetsAt: null };
  if (!body || typeof body !== "object" || !("detail" in body)) return fallback;
  const detail = (body as { detail: unknown }).detail;
  if (typeof detail === "string") return { ...fallback, message: detail };
  if (Array.isArray(detail)) return { ...fallback, message: "Invalid input", code: "validation" };
  if (detail && typeof detail === "object") {
    const d = detail as { code?: string; message?: string; resets_at?: string };
    return { message: d.message ?? fallback.message, code: d.code ?? null, resetsAt: d.resets_at ?? null };
  }
  return fallback;
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; form?: FormData; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? "GET",
      credentials: "include",
      headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      // A FormData body sets its own multipart header (with the boundary), so we must not.
      body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
      signal: init.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw new ApiError(0, "Cancelled", "aborted");
    throw new ApiError(0, "Network error", "network");
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const { message, code, resetsAt } = parseDetail(data);
    throw new ApiError(res.status, message, code, resetsAt);
  }
  return data as T;
}
