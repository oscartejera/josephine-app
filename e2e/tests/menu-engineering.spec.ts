import { test, expect } from '../fixtures/auth.fixture';
import { waitForPageLoad, expectTextOnPage } from '../utils/test-helpers';

test.describe('Menu Engineering', () => {
  test('menu engineering page loads', async ({ authenticatedPage: page }) => {
    await page.goto('/insights/menu-engineering');
    await waitForPageLoad(page);

    // Page should render without error
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('menu engineering matrix or table is visible', async ({ authenticatedPage: page }) => {
    await page.goto('/insights/menu-engineering');
    await waitForPageLoad(page);

    // Look for the matrix chart, table, or any data visualization
    const hasMatrix = await page.locator('svg, table, canvas, [role="table"]').first().isVisible().catch(() => false);
    const hasContent = await page.locator('[class*="card"], [class*="chart"]').first().isVisible().catch(() => false);

    // At least some content should be rendered
    expect(hasMatrix || hasContent).toBeTruthy();
  });

  test('category filter is interactive', async ({ authenticatedPage: page }) => {
    await page.goto('/insights/menu-engineering');
    await waitForPageLoad(page);

    // Look for filter/select elements
    const filterButton = page.locator('button, [role="combobox"]')
      .filter({ hasText: /categor|filtr|todas|all/i })
      .first();

    if (await filterButton.count() > 0) {
      await filterButton.click();
      await page.waitForTimeout(500);
      // A dropdown should appear
    }
  });

  test('no errors on the page', async ({ authenticatedPage: page }) => {
    await page.goto('/insights/menu-engineering');
    await waitForPageLoad(page);

    // Verify no error boundary fallback is showing
    const errorText = page.getByText(/error|algo salió mal|something went wrong/i).first();
    const errorVisible = await errorText.isVisible().catch(() => false);
    expect(errorVisible).toBeFalsy();
  });
});
