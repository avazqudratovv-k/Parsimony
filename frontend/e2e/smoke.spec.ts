import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Adding an entry calls the AI model, so these tests do not add entries (the unit tests cover that with a fake API).
// What they prove: the real frontend, real backend and real database work together for the main journeys.

const PASSWORD = "correct horse battery";
const uniqueEmail = () => `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

async function signUp(page: Page, email: string) {
  await page.goto("/");
  await page.getByRole("tab", { name: "Sign up" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

test("Try demo opens a sandbox with sample data, a chart, and Fix this works; then logs out", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try it as a guest" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("note")).toContainText("Guest account");
  await expect(page.getByRole("heading", { name: "Your expenses" })).toBeVisible();
  // Demo accounts start with sample entries, so the chart and the list both have content.
  await expect(page.getByRole("region", { name: "Spending by category" })).toBeAttached();
  await expect(page.getByRole("button", { name: "Fix this" }).first()).toBeVisible();

  await page.getByRole("button", { name: "Fix this" }).first().click();
  await page.getByLabel("Merchant").fill("E2E Cafe");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("E2E Cafe")).toBeVisible();

  await page.getByRole("link", { name: "My page" }).click();
  await expect(page).toHaveURL(/\/me$/);
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Try it as a guest" })).toBeVisible();
});

test("sign up, stay signed in after a reload, log out, log back in", async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your expenses" })).toBeVisible();

  await page.getByRole("link", { name: "My page" }).click();
  await expect(page.getByText(email).first()).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.getByRole("tab", { name: "Log in" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).last().click();
  await expect(page).toHaveURL(/\/app$/);
});

test("a wrong password shows an error and stays on the page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Log in" }).click();
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).last().click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("month controls move back and forward", async ({ page }) => {
  await signUp(page, uniqueEmail());
  const heading = page.getByRole("heading", { level: 2 }).filter({ hasText: /\d{4}/ });
  const current = await heading.textContent();
  await page.getByRole("button", { name: "Previous month" }).click();
  await expect(heading).not.toHaveText(current!);
  await expect(page.getByText("No expenses in this month.")).toBeVisible();
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(heading).toHaveText(current!);
  await expect(page.getByRole("button", { name: "Next month" })).toBeDisabled();
});

test("the language switch changes the text and is remembered", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Change language" }).click();
  await page.getByRole("menuitemradio", { name: /한국어/ }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
});

test("an unknown address shows the not-found page", async ({ page }) => {
  await page.goto("/nope");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await page.getByRole("link", { name: "Go home" }).click();
  await expect(page).toHaveURL(/\/$/);
});
