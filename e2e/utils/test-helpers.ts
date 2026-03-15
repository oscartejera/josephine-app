import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Wait for the page skeleton/spinner to finish loading.
 * Most Josephine pages show a spinner div while lazy-loading.
 */
export async function waitForPageLoad(page: Page) {
  // Wait for any loading spinners to disappear
  const spinner = page.locator('.animate-spin');
  if (await spinner.count() > 0) {
    await spinner.first().waitFor({ state: 'hidden', timeout: 10_000 });
  }
}

/**
 * Navigate to a route and wait for the page content to settle.
 */
export async function navigateTo(page: Page, path: string) {
  await page.goto(path);
  await waitForPageLoad(page);
}

/**
 * Assert that at least one element matching the selector is visible.
 */
export async function expectVisible(page: Page, selector: string) {
  const el = page.locator(selector).first();
  await expect(el).toBeVisible({ timeout: 10_000 });
}

/**
 * Assert text content exists on the page.
 */
export async function expectTextOnPage(page: Page, text: string) {
  await expect(page.getByText(text, { exact: false }).first()).toBeVisible({ timeout: 10_000 });
}

/**
 * Open the location switcher and select a location by name.
 */
export async function switchLocation(page: Page, locationName: string) {
  // The LocationSwitcher is a dropdown trigger in the sidebar
  const trigger = page.locator('[data-testid="location-switcher"]').first();
  if (await trigger.count() > 0) {
    await trigger.click();
    await page.getByText(locationName, { exact: false }).first().click();
    await waitForPageLoad(page);
  }
}

/**
 * Get text content of an element, trimmed.
 */
export async function getTextContent(locator: Locator): Promise<string> {
  const text = await locator.textContent();
  return (text || '').trim();
}
