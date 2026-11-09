import { defineConfig, devices } from "@playwright/test";

// Smoke tests run in a real browser against the real backend (port 8000) through Vite (port 5173).
// Start the backend first (docker compose up, or uvicorn); Playwright starts Vite itself.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    // Locally, use the Chrome that is already installed. In CI (or when PW_CHROME is set) use that binary / the downloaded Chromium.
    channel: process.env.CI || process.env.PW_CHROME ? undefined : "chrome",
    launchOptions: process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME, args: ["--no-sandbox"] } : {},
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
