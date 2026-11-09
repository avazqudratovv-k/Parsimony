import { ApiError } from "../api/client";
import type { TFn } from "../i18n";

// Our own translated text for each way adding an entry can fail (the server's text is English only).
export function addErrorMessage(e: unknown, t: TFn): string {
  if (e instanceof ApiError) {
    if (e.code === "network" || e.status === 0) return t("auth.error.network");
    if (e.code === "daily_limit_account") return t("add.error.limitUser");
    if (e.code === "daily_limit_global") return t("add.error.limitGlobal");
    if (e.code === "typed_limit_account") return t("add.error.typedUser");
    if (e.code === "typed_limit_global") return t("add.error.typedGlobal");
    if (e.code === "entry_limit") return t("add.error.entryLimit");
    if (e.status === 422) return t("add.error.unreadable");
    if (e.status === 502 || e.status === 503) return t("add.error.unavailable");
  }
  return t("add.error.generic");
}
