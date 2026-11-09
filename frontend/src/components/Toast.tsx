import { Button, Snackbar } from "@mui/material";
import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

type ToastInput = { message: string; action?: { label: string; onClick: () => void } };
type Shown = ToastInput & { key: number };

const ToastContext = createContext<(toast: ToastInput) => void>(() => {});
export const useToast = () => useContext(ToastContext);

/** One small message at the bottom, with an optional action such as Undo. A new toast replaces the old one. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Shown | null>(null);
  const show = useCallback((input: ToastInput) => setToast({ ...input, key: Date.now() + Math.random() }), []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <Snackbar
        key={toast?.key}
        open={!!toast}
        autoHideDuration={5000}
        onClose={(_, reason) => reason !== "clickaway" && setToast(null)}
        message={toast?.message}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        // On phones the add bar is docked at the bottom, so sit above it.
        sx={{ bottom: { xs: "calc(max(12px, env(safe-area-inset-bottom)) + 100px)", sm: 24 } }}
        action={
          toast?.action && (
            <Button color="inherit" size="small" sx={{ fontWeight: 600 }} onClick={() => { toast.action!.onClick(); setToast(null); }}>
              {toast.action.label}
            </Button>
          )
        }
      />
    </ToastContext.Provider>
  );
}
