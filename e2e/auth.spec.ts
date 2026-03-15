import { test, expect } from '@playwright/test';

/**
 * Pre-dismiss the GDPR cookie consent banner so it doesn't overlay the page.
 * Sets localStorage 'josephine_consent' before navigating.
 */
async function dismissCookieBanner(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'josephine_consent',
      JSON.stringify({ essential: true, analytics: false, marketing: false, timestamp: Date.now() }),
    );
  });
}

test.describe('Authentication', () => {
  test('shows login page when not authenticated', async ({ page }) => {
    await dismissCookieBanner(page);
    await page.goto('/');
    // Should redirect to login
    await expect(page).toHaveURL(/login/);
    // Heading: "Bienvenido a Josephine" (es) / "Welcome to Josephine" (en)
    await expect(page.getByRole('heading', { name: /bienvenido|welcome/i })).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await dismissCookieBanner(page);
    await page.goto('/login');
    // Wait for the page to fully render
    await expect(page.getByRole('heading', { name: /bienvenido|welcome/i })).toBeVisible();

    // Fill form using input IDs
    await page.locator('#email').fill('invalid@test.com');
    await page.locator('#password').fill('wrongpassword');

    // Click the login submit button
    await page.locator('button[type="submit"]').click();

    // Wait for error toast — text varies by locale:
    //   EN: "Login error" + "Invalid login credentials"
    //   ES: "Error al iniciar sesión" + "Invalid login credentials"
    // Use .first() to avoid strict-mode errors when text matches multiple elements
    await expect(
      page.getByText(/login error|Error al iniciar/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('login with valid credentials redirects to dashboard', async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;

    test.skip(!email || !password, 'E2E_TEST_EMAIL and E2E_TEST_PASSWORD required');

    await dismissCookieBanner(page);
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /bienvenido|welcome/i })).toBeVisible();
    await page.locator('#email').fill(email!);
    await page.locator('#password').fill(password!);
    await page.locator('button[type="submit"]').click();

    // Should redirect to dashboard or control-tower
    await expect(page).toHaveURL(/dashboard|control-tower/, { timeout: 15_000 });
  });

  test('logout redirects to login', async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;

    test.skip(!email || !password, 'E2E_TEST_EMAIL and E2E_TEST_PASSWORD required');

    // Login first
    await dismissCookieBanner(page);
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /bienvenido|welcome/i })).toBeVisible();
    await page.locator('#email').fill(email!);
    await page.locator('#password').fill(password!);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/dashboard|control-tower/, { timeout: 15_000 });

    // Logout
    const logoutButton = page.getByRole('button', { name: /cerrar sesión|log out/i });
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
    } else {
      await page.getByText(/cerrar sesión|log out/i).click();
    }

    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });
});
