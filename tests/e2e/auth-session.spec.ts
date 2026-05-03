import { test, expect } from "@playwright/test";
import { login, getEnv } from "./helpers/auth";

test.describe("Auth and session", () => {
  test.beforeEach(async () => {
    const env = getEnv();
    if (!env.email || !env.password) {
      test.skip(true, "E2E_EMAIL and E2E_PASSWORD required");
    }
  });

  test("login works and reaches dashboard", async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/dashboard/);
  });

  test("session survives hard refresh", async ({ page }) => {
    await login(page);
    await page.reload();
    await page.waitForTimeout(2000);
    // Should still be on dashboard, not redirected to login
    const url = page.url();
    expect(url).not.toContain("/login");
  });

  test("no forbidden keys in localStorage", async ({ page }) => {
    await login(page);
    const forbidden = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      const bad = ["activeRestaurantId", "role", "membership", "settings", "ingredients", "recipes", "recipe_lines", "menuAnalytics", "priceLog", "snapshot", "batch", "priceTrend", "dishAnalysis", "impactCascade", "alerts", "dashboard", "team", "invitations"];
      return keys.filter((k) => bad.some((b) => k.toLowerCase().includes(b.toLowerCase())));
    });
    expect(forbidden).toHaveLength(0);
  });
});
