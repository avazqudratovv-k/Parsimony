import "@fontsource-variable/inter";
import "@fontsource/newsreader/500-italic.css";
import "@fontsource/noto-sans-kr/400.css";
import "@fontsource/noto-sans-kr/600.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "./i18n";
import { createQueryClient } from "./lib/session";
import { createAppRouter } from "./router";
import { ToastProvider } from "./components/Toast";
import { AppThemeProvider } from "./theme";

const queryClient = createQueryClient(() => void router.navigate({ to: "/" }));
const router = createAppRouter(queryClient);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AppThemeProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </AppThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  </StrictMode>,
);
