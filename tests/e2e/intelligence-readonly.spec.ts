import { test, expect } from "@playwright/test";
import { login, goToRoute, getEnv } from "./helpers/auth";

test.describe("Intelligence pages (read-only)", () => {
  test.beforeEach(async ({ page }) => {
    const env = getEnv();
    if (!env.email || !env.password) {
      test.skip(true, "E2E_EMAIL and E2E_PASSWORD required");
      return;
    }
    await login(page);
  });

  test("/dashboard loads panels", async ({ page }) => {
    await goToRoute(page, "/dashboard");
    const body = await page.textContent("body");
    expect(body).toContain("Dashboard");
    // Should have KPI cards or alert-first content
    expect(body?.length).toBeGreaterThan(200);
  });

  test("/menu-analytics loads", async ({ page }) => {
    await goToRoute(page, "/menu-analytics");
    const body = await page.textContent("body");
    expect(body).toContain("Menu Analytics");
  });

  test("/price-log loads", async ({ page }) => {
    await goToRoute(page, "/price-log");
    const body = await page.textContent("body");
    expect(body).toContain("Price Log");
  });

  test("/price-trend loads", async ({ page }) => {
    await goToRoute(page, "/price-trend");
    const body = await page.textContent("body");
    expect(body).toContain("Price Trend");
  });

  test("/impact-cascade loads", async ({ page }) => {
    await goToRoute(page, "/impact-cascade");
    const body = await page.textContent("body");
    expect(body).toContain("Impact Cascade");
  });

  test("/alerts loads", async ({ page }) => {
    await goToRoute(page, "/alerts");
    const body = await page.textContent("body");
    expect(body).toContain("Alerts");
  });
});
