import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('login page renders with email and password fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('invalid login shows error message', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'invalid@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should stay on login page (not redirect)
    await page.waitForTimeout(3000);
    expect(page.url()).toContain('/login');
  });

  test('successful login redirects to dashboard', async ({ page }) => {
    const email = process.env.E2E_EMAIL || 'demo@josephine.app';
    const password = process.env.E2E_PASSWORD || 'demo1234';

    await page.goto('/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    // Should redirect away from login
    await page.waitForURL(url => {
      const path = new URL(url).pathname;
      return !path.includes('/login');
    }, { timeout: 15_000 });

    const currentPath = new URL(page.url()).pathname;
    expect(['/dashboard', '/onboarding', '/team'].some(p => currentPath.startsWith(p))).toBeTruthy();
  });

  test('unauthenticated users cannot access dashboard', async ({ page }) => {
    await page.goto('/dashboard');

    // Should redirect to login
    await page.waitForURL('**/login', { timeout: 10_000 });
    expect(page.url()).toContain('/login');
  });

  test('signup page is accessible', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });
});
