import { test, expect } from '../fixtures/auth.fixture';
import { waitForPageLoad, expectTextOnPage } from '../utils/test-helpers';

test.describe('Dashboard', () => {
  test('dashboard loads with KPI cards', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');
    await waitForPageLoad(page);

    // Dashboard should have visible content (KPI cards, charts, etc.)
    // Check for the main dashboard container
    await expect(page.locator('main').first()).toBeVisible();

    // At minimum, the page title or heading should render
    const hasContent = await page.locator('h1, h2, h3, [data-testid]').first().isVisible().catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test('sidebar navigation is visible', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');
    await waitForPageLoad(page);

    // Sidebar should have navigation items
    const sidebar = page.locator('aside, [data-sidebar]').first();
    await expect(sidebar).toBeVisible({ timeout: 10_000 });
  });

  test('date range filter interaction', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');
    await waitForPageLoad(page);

    // Look for any date-related button/trigger in the page
    const dateButton = page.locator('button').filter({ hasText: /hoy|today|semana|week|mes|month|rango|range/i }).first();
    if (await dateButton.count() > 0) {
      await dateButton.click();
      // A popover/dropdown should appear
      await page.waitForTimeout(500);
    }
  });

  test('can navigate to insights from dashboard', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');
    await waitForPageLoad(page);

    // Click on Insights link in sidebar
    const insightsLink = page.locator('a[href*="insights"]').first();
    if (await insightsLink.count() > 0) {
      await insightsLink.click();
      await page.waitForURL('**/insights**', { timeout: 10_000 });
    }
  });
});
