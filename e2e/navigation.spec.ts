import { test, expect } from '@playwright/test';

/**
 * Navigation tests verify sidebar links render the correct pages.
 * These tests require authentication — skip if no test credentials.
 */
test.describe('Sidebar Navigation', () => {
  test.beforeEach(async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;

    test.skip(!email || !password, 'E2E_TEST_EMAIL and E2E_TEST_PASSWORD required');

    await page.goto('/login');
    await page.getByLabel(/correo|email/i).fill(email!);
    await page.getByLabel(/contraseña|password/i).fill(password!);
    await page.getByRole('button', { name: /iniciar sesión|log in/i }).click();
    await expect(page).toHaveURL(/dashboard|control-tower/, { timeout: 15_000 });
  });

  const pages = [
    { nav: /ventas|sales/i, url: /sales/, heading: /ventas|sales/i },
    { nav: /inventario|inventory/i, url: /inventory/, heading: /inventario|inventory/i },
    { nav: /personal|labour/i, url: /labour/, heading: /personal|labour/i },
    { nav: /mermas|waste/i, url: /waste/, heading: /mermas|waste/i },
    { nav: /turnos|scheduling|horarios/i, url: /scheduling/, heading: /turno|schedul/i },
    { nav: /ajustes|settings/i, url: /settings/, heading: /ajustes|settings/i },
  ];

  for (const { nav, url, heading } of pages) {
    test(`navigates to ${url}`, async ({ page }) => {
      // Click sidebar link
      const link = page.getByRole('link', { name: nav }).first();
      if (await link.isVisible()) {
        await link.click();
      } else {
        // Try button variant
        await page.getByRole('button', { name: nav }).first().click();
      }

      await expect(page).toHaveURL(url, { timeout: 10_000 });
      // Page should have some content loaded
      await expect(page.locator('main, [role="main"], .page-content').first()).toBeVisible();
    });
  }
});
