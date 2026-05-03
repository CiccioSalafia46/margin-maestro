import { test, expect } from "@playwright/test";
import { login, goToRoute, getEnv } from "./helpers/auth";

const ROUTES = [
  "/dashboard",
  "/settings",
  "/ingredients",
  "/recipes",
  "/menu-analytics",
  "/price-log",
  "/price-trend",
  "/dish-analysis",
  "/impact-cascade",
  "/alerts",
];

test.describe("Route smoke tests", () => {
  test.beforeEach(async ({ page }) => {
    const env = getEnv();
    if (!env.email || !env.password) {
      test.skip(true, "E2E_EMAIL and E2E_PASSWORD required");
      return;
    }
    await login(page);
  });

  for (const route of ROUTES) {
    test(`${route} loads without crash`, async ({ page }) => {
      await goToRoute(page, route);
      // Page should not show a blank body
      const body = await page.textContent("body");
      expect(body?.length).toBeGreaterThan(50);
      // No service role key exposed
      expect(body).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    });
  }
});
