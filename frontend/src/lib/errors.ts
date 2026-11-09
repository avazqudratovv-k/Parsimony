import { ApiError } from "../api/client";
import type { TFn } from "../i18n";
import { MicError } from "./audio";

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

// Voice: the microphone itself can fail before the server is involved.
export function voiceErrorMessage(e: unknown, t: TFn): string {
  if (e instanceof MicError) {
    if (e.kind === "denied") return t("voice.error.denied");
    if (e.kind === "unsupported") return t("voice.error.unsupported");
    return t("voice.error.failed");
  }
  if (e instanceof ApiError) {
    if (e.status === 422) return t("voice.error.noSpeech");
    if (e.status === 413) return t("voice.error.long");
  }
  return addErrorMessage(e, t);
}

// Same idea for a receipt photo: the status says what went wrong with the picture itself.
export function photoErrorMessage(e: unknown, t: TFn): string {
  if (e instanceof ApiError) {
    if (e.status === 415) return t("photo.error.type");
    if (e.status === 413) return t("photo.error.size");
    if (e.status === 422) return t("photo.error.unreadable");
  }
  return addErrorMessage(e, t);
}
