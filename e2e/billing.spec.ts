import { test, expect } from '@playwright/test';

test.describe('Billing Settings', () => {
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

  test('billing tab shows plan information', async ({ page }) => {
    await page.goto('/settings');
    
    // Click billing tab
    const billingTab = page.getByRole('tab', { name: /facturación|billing/i }).first();
    if (await billingTab.isVisible()) {
      await billingTab.click();
    } else {
      // Try link variant
      await page.getByText(/facturación|billing/i).first().click();
    }

    // Should show plan info or billing section
    await expect(
      page.getByText(/plan|starter|profesional|professional|enterprise|suscripción|subscription/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
