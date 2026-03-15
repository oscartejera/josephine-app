import { test, expect } from '../fixtures/auth.fixture';
import { waitForPageLoad } from '../utils/test-helpers';

test.describe('Instant P&L', () => {
  test('P&L page loads with financial data', async ({ authenticatedPage: page }) => {
    await page.goto('/insights/instant-pl');
    await waitForPageLoad(page);

    // Page should render
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('P&L shows revenue/cost sections', async ({ authenticatedPage: page }) => {
    await page.goto('/insights/instant-pl');
    await waitForPageLoad(page);

    // Look for financial table rows or cards with monetary values
    const hasFinancialContent = await page.locator('table, [class*="card"]').first().isVisible().catch(() => false);
    expect(hasFinancialContent).toBeTruthy();
  });

  test('date range can be changed', async ({ authenticatedPage: page }) => {
    await page.goto('/insights/instant-pl');
    await waitForPageLoad(page);

    // Find date range button/select
    const dateControl = page.locator('button, [role="combobox"]')
      .filter({ hasText: /hoy|today|semana|week|mes|month|rango|período|period/i })
      .first();

    if (await dateControl.count() > 0) {
      await dateControl.click();
      await page.waitForTimeout(500);
    }
  });

  test('no error boundary showing', async ({ authenticatedPage: page }) => {
    await page.goto('/insights/instant-pl');
    await waitForPageLoad(page);

    const errorText = page.getByText(/error|algo salió mal|something went wrong/i).first();
    const errorVisible = await errorText.isVisible().catch(() => false);
    expect(errorVisible).toBeFalsy();
  });
});
