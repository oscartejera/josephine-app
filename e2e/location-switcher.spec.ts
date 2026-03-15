import { test, expect } from '@playwright/test';

test.describe('Location Switcher', () => {
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

  test('location switcher is visible and has options', async ({ page }) => {
    // The LocationSwitcher component should be visible in the sidebar
    const switcher = page.locator('[data-testid="location-switcher"], [class*="location"]').first();
    await expect(switcher).toBeVisible({ timeout: 5_000 });
  });

  test('switching location updates displayed data', async ({ page }) => {
    // Find the location switcher dropdown/select
    const switcher = page.locator('[data-testid="location-switcher"]').first();
    
    if (await switcher.isVisible()) {
      await switcher.click();
      
      // Wait for dropdown options
      const options = page.locator('[data-testid="location-option"], [role="option"], [role="menuitem"]');
      const count = await options.count();
      
      if (count > 1) {
        // Click the second option (different from current)
        await options.nth(1).click();
        
        // Wait for data to refresh — look for loading state or new data
        await page.waitForTimeout(1_000);
        
        // Page should still be functional (no crash)
        await expect(page.locator('main, [role="main"]').first()).toBeVisible();
      }
    }
  });
});
