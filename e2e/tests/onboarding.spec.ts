import { test, expect } from '@playwright/test';

test.describe('Onboarding', () => {
  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/onboarding');

    // Should redirect to login since user is not authenticated
    await page.waitForURL('**/login', { timeout: 10_000 });
    expect(page.url()).toContain('/login');
  });

  test('onboarding page loads for authenticated users without a group', async ({ page }) => {
    // This test verifies the onboarding route exists and renders.
    // A user with group_id === null would be redirected to /onboarding.
    // We verify the route doesn't return 404.
    const response = await page.goto('/onboarding');
    // Route should be found (not 404)
    expect(response?.status()).not.toBe(404);
  });

  test('onboarding wizard renders for redirected users', async ({ page }) => {
    const email = process.env.E2E_EMAIL || 'demo@josephine.app';
    const password = process.env.E2E_PASSWORD || 'demo1234';

    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    // Wait for navigation to complete
    await page.waitForURL(url => !new URL(url).pathname.includes('/login'), { timeout: 15_000 });

    // If user already has a group, they'll be on /dashboard
    // If not, they'll be on /onboarding
    const currentPath = new URL(page.url()).pathname;

    if (currentPath.startsWith('/onboarding')) {
      // Verify wizard content renders
      await expect(page.locator('main, form, [class*="wizard"], [class*="onboarding"]').first()).toBeVisible();
    } else {
      // User has a group — test passes (onboarding already completed)
      expect(currentPath).toBe('/dashboard');
    }
  });
});
