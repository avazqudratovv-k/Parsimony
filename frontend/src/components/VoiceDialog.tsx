import { Alert, Box, Button, CircularProgress, Dialog, DialogContent, DialogTitle, IconButton, TextField, Typography } from "@mui/material";
import { keyframes } from "@mui/material/styles";
import { useEffect, useRef, useState } from "react";
import { useAddEntry, useTranscribe } from "../api/entries";
import { MAX_SECONDS, startRecording } from "../lib/audio";
import type { Recorder } from "../lib/audio";
import { addErrorMessage, voiceErrorMessage } from "../lib/errors";
import { useT } from "../i18n";
import { Icon } from "./Icon";

const pulse = keyframes`0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}`;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Voice flow (design 5a/5b): record, write it down, let the user fix the words, then save. */
export function VoiceDialog({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const t = useT();
  const transcribe = useTranscribe();
  const add = useAddEntry();
  const recorder = useRef<Recorder | null>(null);
  const [phase, setPhase] = useState<"recording" | "working" | "confirm" | "error">("recording");
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [heard, setHeard] = useState(0);
  const [text, setText] = useState("");
  const [error, setError] = useState<unknown>(null);

  // (Re)start the microphone. The cleanup also covers closing the dialog and StrictMode's second pass.
  useEffect(() => {
    let cancelled = false;
    setPhase("recording");
    setReady(false);
    setSeconds(0);
    startRecording()
      .then((r) => {
        if (cancelled) return r.cancel();
        recorder.current = r;
        setReady(true);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e);
        setPhase("error");
      });
    return () => {
      cancelled = true;
      recorder.current?.cancel();
      recorder.current = null;
    };
  }, [attempt]);

  useEffect(() => {
    if (phase !== "recording" || !ready) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase, ready]);

  async function stop() {
    const r = recorder.current;
    if (!r) return;
    recorder.current = null;
    setHeard(seconds);
    setPhase("working");
    try {
      const wav = await r.stop();
      const result = await transcribe.mutateAsync(wav);
      setText(result.text);
      setPhase("confirm");
    } catch (e) {
      setError(e);
      setPhase("error");
    }
  }

  useEffect(() => {
    if (phase === "recording" && seconds >= MAX_SECONDS) void stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, phase]);

  const again = () => { add.reset(); setError(null); setAttempt((n) => n + 1); };
  const busy = phase === "working" || add.isPending;

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="xs" aria-labelledby="voice-title">
      <DialogTitle id="voice-title">{phase === "confirm" ? t("voice.confirmTitle") : t("voice.title")}</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: 4, pb: 5, pt: "8px !important" }}>
        {phase === "recording" && (
          <Box sx={{ display: "grid", gap: 4, justifyItems: "center", textAlign: "center" }}>
            <Box aria-hidden sx={{ display: "flex", alignItems: "center", gap: "4px", height: 36 }}>
              {Array.from({ length: 18 }, (_, i) => (
                <Box key={i} sx={{ width: 3, height: 32, borderRadius: 2, bgcolor: "primary.main", transformOrigin: "center", animation: `${pulse} ${0.7 + (i % 5) * 0.12}s ease-in-out ${i * 0.04}s infinite`, "@media (prefers-reduced-motion: reduce)": { animation: "none", transform: "scaleY(.5)" } }} />
              ))}
            </Box>
            <Typography role="timer" aria-live="off" sx={{ fontSize: 32, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{clock(seconds)}</Typography>
            <Typography color="text.secondary" variant="body2">
              {t("voice.hint")}<br /><Box component="span" sx={{ color: "text.primary" }}>{t("voice.example")}</Box>
            </Typography>
            <IconButton aria-label={t("voice.stop")} onClick={stop} disabled={!ready} sx={{ width: 64, height: 64, bgcolor: "primary.main", color: "primary.contrastText", "&:hover": { bgcolor: "primary.dark" }, "&.Mui-disabled": { bgcolor: "action.disabledBackground" } }}>
              <Icon name="stop" size={28} />
            </IconButton>
            <Typography variant="caption" color="text.secondary">{t("voice.stopHint")}</Typography>
            <Button onClick={onClose}>{t("voice.cancel")}</Button>
          </Box>
        )}
        {phase === "working" && (
          <Box role="status" sx={{ display: "flex", alignItems: "center", gap: 3, py: 4, justifyContent: "center" }}>
            <CircularProgress size={22} /><Typography>{t("voice.working")}</Typography>
          </Box>
        )}
        {phase === "confirm" && (
          <>
            <TextField
              label={`${t("voice.transcript")} · ${clock(heard)}`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              multiline minRows={2} fullWidth disabled={add.isPending}
              slotProps={{ htmlInput: { maxLength: 500 } }}
            />
            {add.isError && <Alert severity="error" role="alert">{addErrorMessage(add.error, t)}</Alert>}
            <Box sx={{ display: "grid", gap: 2 }}>
              <Button
                variant="contained" startIcon={<Icon name="check" size={18} />} disabled={!text.trim() || add.isPending}
                onClick={() => add.mutate({ text: text.trim(), source: "voice" }, { onSuccess: () => { onAdded(); onClose(); } })}
              >
                {t("voice.add")}
              </Button>
              <Button startIcon={<Icon name="mic" size={18} />} onClick={again} disabled={add.isPending}>{t("voice.again")}</Button>
            </Box>
          </>
        )}
        {phase === "error" && (
          <>
            <Alert severity="error" role="alert">{voiceErrorMessage(error, t)}</Alert>
            <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
              <Button variant="outlined" onClick={onClose}>{t("photo.close")}</Button>
              <Button variant="contained" onClick={again}>{t("photo.retry")}</Button>
            </Box>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
