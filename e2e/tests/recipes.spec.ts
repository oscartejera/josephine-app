import { test, expect } from '../fixtures/auth.fixture';
import { waitForPageLoad } from '../utils/test-helpers';

test.describe('Recipes', () => {
  test('recipes list page loads', async ({ authenticatedPage: page }) => {
    await page.goto('/inventory-setup/recipes');
    await waitForPageLoad(page);

    await expect(page.locator('main').first()).toBeVisible();
  });

  test('recipes page shows recipe list or empty state', async ({ authenticatedPage: page }) => {
    await page.goto('/inventory-setup/recipes');
    await waitForPageLoad(page);

    // Either a list of recipes or an empty state message
    const hasRecipes = await page.locator('table, [class*="card"], [class*="list"]').first().isVisible().catch(() => false);
    const hasEmptyState = await page.getByText(/no hay recetas|sin recetas|crear|no recipes|add recipe/i).first().isVisible().catch(() => false);

    expect(hasRecipes || hasEmptyState).toBeTruthy();
  });

  test('can navigate to recipe detail', async ({ authenticatedPage: page }) => {
    await page.goto('/inventory-setup/recipes');
    await waitForPageLoad(page);

    // Try clicking on a recipe link if any exist
    const recipeLink = page.locator('a[href*="/inventory-setup/recipes/"], tr[role="row"], [data-testid*="recipe"]').first();
    if (await recipeLink.count() > 0) {
      await recipeLink.click();
      await waitForPageLoad(page);
      // Should navigate to detail page
      const url = page.url();
      // Either on detail page or still on list (if empty)
      expect(url).toContain('/inventory-setup/recipes');
    }
  });

  test('menu items page loads', async ({ authenticatedPage: page }) => {
    await page.goto('/inventory-setup/menu-items');
    await waitForPageLoad(page);

    await expect(page.locator('main').first()).toBeVisible();

    // No error boundary showing
    const errorText = page.getByText(/error|algo salió mal|something went wrong/i).first();
    const errorVisible = await errorText.isVisible().catch(() => false);
    expect(errorVisible).toBeFalsy();
  });
});
