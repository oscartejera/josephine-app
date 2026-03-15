import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('shows login page when not authenticated', async ({ page }) => {
    await page.goto('/');
    // Should redirect to login
    await expect(page).toHaveURL(/login/);
    await expect(page.getByRole('heading', { name: /iniciar sesión|log in/i })).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/correo|email/i).fill('invalid@test.com');
    await page.getByLabel(/contraseña|password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /iniciar sesión|log in/i }).click();
    // Expect error message
    await expect(page.getByText(/inválid|invalid|error/i)).toBeVisible({ timeout: 10_000 });
  });

  test('login with valid credentials redirects to dashboard', async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;

    test.skip(!email || !password, 'E2E_TEST_EMAIL and E2E_TEST_PASSWORD required');

    await page.goto('/login');
    await page.getByLabel(/correo|email/i).fill(email!);
    await page.getByLabel(/contraseña|password/i).fill(password!);
    await page.getByRole('button', { name: /iniciar sesión|log in/i }).click();

    // Should redirect to dashboard or control-tower
    await expect(page).toHaveURL(/dashboard|control-tower/, { timeout: 15_000 });
  });

  test('logout redirects to login', async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;

    test.skip(!email || !password, 'E2E_TEST_EMAIL and E2E_TEST_PASSWORD required');

    // Login first
    await page.goto('/login');
    await page.getByLabel(/correo|email/i).fill(email!);
    await page.getByLabel(/contraseña|password/i).fill(password!);
    await page.getByRole('button', { name: /iniciar sesión|log in/i }).click();
    await expect(page).toHaveURL(/dashboard|control-tower/, { timeout: 15_000 });

    // Logout
    const logoutButton = page.getByRole('button', { name: /cerrar sesión|log out/i });
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
    } else {
      // Try sidebar logout link
      await page.getByText(/cerrar sesión|log out/i).click();
    }

    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });
});
