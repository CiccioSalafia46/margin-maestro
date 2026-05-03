import { test, expect } from "@playwright/test";
import { login, goToRoute, getEnv } from "./helpers/auth";

test.describe("Settings and Team", () => {
  test.beforeEach(async ({ page }) => {
    const env = getEnv();
    if (!env.email || !env.password) {
      test.skip(true, "E2E_EMAIL and E2E_PASSWORD required");
      return;
    }
    await login(page);
  });

  test("Settings page loads", async ({ page }) => {
    await goToRoute(page, "/settings");
    const body = await page.textContent("body");
    expect(body).toContain("Settings");
  });

  test("Team tab loads without schema errors", async ({ page }) => {
    await goToRoute(page, "/settings");
    // Click Team tab
    const teamTab = page.locator("button", { hasText: "Team" });
    if (await teamTab.isVisible()) {
      await teamTab.click();
      await page.waitForTimeout(1500);
      const body = await page.textContent("body");
      // No schema cache / relationship errors
      expect(body).not.toContain("schema cache");
      expect(body).not.toContain("permission denied for table users");
      // Should show at least the current user
      expect(body).toContain("Owner") || expect(body).toContain("owner");
    }
  });

  test("Invite form shows no-email-delivery copy", async ({ page }) => {
    await goToRoute(page, "/settings");
    const teamTab = page.locator("button", { hasText: "Team" });
    if (await teamTab.isVisible()) {
      await teamTab.click();
      await page.waitForTimeout(1500);
      const body = await page.textContent("body");
      if (body?.includes("Invite member")) {
        expect(body).toContain("Email delivery is not enabled yet");
      }
    }
  });
});
