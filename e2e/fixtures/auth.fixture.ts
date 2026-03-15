import { test as base, expect, type Page } from '@playwright/test';

/**
 * Auth fixture — logs in via the UI (email/password) and caches
 * the session so subsequent tests in the same worker don't re-login.
 *
 * Set E2E_EMAIL / E2E_PASSWORD env vars or fall back to demo credentials.
 */
const E2E_EMAIL = process.env.E2E_EMAIL || 'demo@josephine.app';
const E2E_PASSWORD = process.env.E2E_PASSWORD || 'demo1234';

async function loginViaUI(page: Page) {
  await page.goto('/login');
  await page.waitForSelector('input[type="email"]', { timeout: 10_000 });
  await page.fill('input[type="email"]', E2E_EMAIL);
  await page.fill('input[type="password"]', E2E_PASSWORD);
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard or onboarding
  await page.waitForURL(url => {
    const path = new URL(url).pathname;
    return path.startsWith('/dashboard') || path.startsWith('/onboarding') || path.startsWith('/team');
  }, { timeout: 15_000 });
}

type AuthFixtures = {
  authenticatedPage: Page;
};

/**
 * Extended test that provides an `authenticatedPage` fixture.
 * Usage:
 *   import { test } from '../fixtures/auth.fixture';
 *   test('My test', async ({ authenticatedPage: page }) => { ... });
 */
export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    await loginViaUI(page);
    await use(page);
  },
});

export { expect };
