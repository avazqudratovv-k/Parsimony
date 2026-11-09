import { Box, keyframes } from "@mui/material";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useI18n } from "../i18n";
import { useTokens } from "../theme";
import { Icon } from "./Icon";

type IconName = "check" | "trash" | "info" | "alert";
type ToastInput = {
  message: string;
  action?: { label: string; onClick: () => void };
  icon?: IconName;
  /** How long it stays, in ms. The thin bar at the bottom shows the time left. */
  duration?: number;
  /** Warm colour for "heads up" messages. */
  warn?: boolean;
};
type Shown = ToastInput & { key: number };

const ToastContext = createContext<(toast: ToastInput) => void>(() => {});
export const useToast = () => useContext(ToastContext);

const slideIn = keyframes`from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; }`;
const slideOut = keyframes`to { opacity: 0; transform: translateY(4px); }`;
const drain = keyframes`from { transform: scaleX(1); } to { transform: scaleX(0); }`;

/** One toast at a time (a new one replaces the old), following the Parsimony toast design:
 * icon, message, optional action, dismiss, and a thin bar that shows the time left. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const c = useTokens();
  const [toast, setToast] = useState<Shown | null>(null);
  const [leaving, setLeaving] = useState(false);
  const timer = useRef(0);
  const show = useCallback((input: ToastInput) => { setLeaving(false); setToast({ ...input, key: Date.now() + Math.random() }); }, []);
  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setLeaving(true);
    timer.current = window.setTimeout(() => setToast(null), 150);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // With reduced motion the bar is hidden, so a plain timer does the dismissing.
  useEffect(() => {
    if (!toast || !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setTimeout(hide, toast.duration ?? 5000);
    return () => window.clearTimeout(id);
  }, [toast, hide]);

  const accent = toast?.warn ? c.toastWarn : c.toastAction;
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <Box
          sx={{
            position: "fixed", zIndex: 1500, left: 16, right: 16, display: "flex", justifyContent: "center", pointerEvents: "none",
            // On phones the add bar is docked at the bottom, so sit above it.
            bottom: { xs: "calc(max(12px, env(safe-area-inset-bottom)) + 100px)", sm: 24 },
          }}
        >
          <Box
            key={toast.key} role="status" aria-live="polite"
            sx={{
              pointerEvents: "auto", position: "relative", overflow: "hidden", width: "100%", maxWidth: 440, minHeight: 52,
              display: "flex", alignItems: "center", gap: "10px", py: "6px", pr: "6px", pl: "14px",
              bgcolor: c.toastBg, color: c.toastInk, borderRadius: "12px", fontSize: 14, lineHeight: "20px",
              boxShadow: `0 -1px 0 0 ${c.line}, 0 12px 32px -8px rgba(31,36,33,0.28)`,
              animation: `${leaving ? slideOut : slideIn} ${leaving ? "150ms ease-in" : "220ms cubic-bezier(.2,.7,.2,1)"} both`,
              "@media (prefers-reduced-motion: reduce)": { animationDuration: "1ms" },
              "&:hover .bar, &:focus-within .bar": { animationPlayState: "paused" },
            }}
          >
            <Box sx={{ color: accent, display: "flex", flex: "none" }}><Icon name={toast.icon ?? "check"} size={20} /></Box>
            <Box sx={{ flex: 1, minWidth: 0, py: "8px" }}>{toast.message}</Box>
            {toast.action && (
              <Box
                component="button" type="button"
                onClick={() => { toast.action!.onClick(); hide(); }}
                sx={{ font: "inherit", fontWeight: 600, color: accent, bgcolor: "transparent", border: 0, minHeight: 44, px: "10px", borderRadius: "8px", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                {toast.action.label}
              </Box>
            )}
            <Box
              component="button" type="button" aria-label={t("toast.dismiss")} onClick={hide}
              sx={{ width: 40, height: 44, border: 0, bgcolor: "transparent", color: c.toastMuted, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "8px", cursor: "pointer", flex: "none" }}
            >
              <Icon name="x" size={18} />
            </Box>
            <Box
              className="bar" aria-hidden onAnimationEnd={hide}
              sx={{
                position: "absolute", left: 0, bottom: 0, height: 2, width: "100%", bgcolor: accent, opacity: 0.6, transformOrigin: "left",
                animation: `${drain} ${toast.duration ?? 5000}ms linear forwards`,
                "@media (prefers-reduced-motion: reduce)": { display: "none" },
              }}
            />
          </Box>
        </Box>
      )}
    </ToastContext.Provider>
  );
}
