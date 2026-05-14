import { test, expect } from "@playwright/test";
import { login, goToRoute, getEnv } from "./helpers/auth";

const QA_ROUTES = [
  "/qa-mvp-readiness",
  "/qa-auth",
  "/qa-team-management",
  "/qa-transactional-invites",
  "/qa-dashboard",
  "/qa-alerts",
  "/qa-impact-cascade",
  "/qa-dish-analysis",
  "/qa-price-trend",
  "/qa-price-log-snapshot",
  "/qa-menu-analytics",
  "/qa-menu-price-audit",
  "/qa-recipe-import",
  "/qa-atomic-rpc",
  "/qa-recipes",
  "/qa-ingredients",
  "/qa-settings-admin",
  "/qa-calculations",
  "/qa-data-integrity",
];

test.describe("QA route smoke tests", () => {
  test.beforeEach(async ({ page }) => {
    const env = getEnv();
    if (!env.email || !env.password) {
      test.skip(true, "E2E_EMAIL and E2E_PASSWORD required");
      return;
    }
    await login(page);
  });

  for (const route of QA_ROUTES) {
    test(`${route} loads and shows status`, async ({ page }) => {
      await goToRoute(page, route);
      const body = await page.textContent("body");
      expect(body?.length).toBeGreaterThan(50);
      // QA pages should not have critical FAIL text caused by schema issues
      // (data-dependent warnings are acceptable)
      expect(body).not.toContain("permission denied for table users");
      expect(body).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    });
  }
});
