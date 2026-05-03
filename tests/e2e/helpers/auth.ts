import { type Page, expect } from "@playwright/test";

export function getEnv() {
  const baseUrl = process.env.E2E_BASE_URL || "http://localhost:8085";
  const email = process.env.E2E_EMAIL || "";
  const password = process.env.E2E_PASSWORD || "";
  return { baseUrl, email, password };
}

export function requireEnv() {
  const env = getEnv();
  if (!env.email || !env.password) {
    throw new Error("E2E_EMAIL and E2E_PASSWORD are required. Set them in .env.local or environment.");
  }
  return env;
}

export async function login(page: Page) {
  const { baseUrl, email, password } = requireEnv();
  await page.goto(`${baseUrl}/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 15000 });
}

export async function logout(page: Page) {
  // Click user menu / sign out if available, or navigate
  await page.evaluate(() => {
    // Clear Supabase session via the app's sign out
    const btn = document.querySelector('[data-testid="sign-out"]') as HTMLButtonElement | null;
    if (btn) btn.click();
  });
}

export async function waitForAppReady(page: Page) {
  // Wait for the sidebar to appear (indicates app shell loaded)
  await page.waitForSelector("nav, aside, [data-slot='sidebar']", { timeout: 10000 });
}

export async function goToRoute(page: Page, route: string) {
  const { baseUrl } = getEnv();
  await page.goto(`${baseUrl}${route}`);
  await waitForAppReady(page);
}

export async function expectRouteLoads(page: Page, route: string) {
  await goToRoute(page, route);
  // No uncaught errors
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.waitForTimeout(1000);
  expect(errors.filter((e) => !e.includes("ResizeObserver"))).toHaveLength(0);
}
