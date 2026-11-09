/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In dev, the browser talks to Vite (5173) and Vite forwards /api to the backend (8000),
// so the session cookie is same-origin and no CORS setup is needed.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8000" },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    include: ["src/**/*.test.{ts,tsx}"], // e2e/ belongs to Playwright
  },
});
