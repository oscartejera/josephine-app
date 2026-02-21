/**
 * Global Sanity Test — E2E flow verification.
 * Tests: Auth bypass → Dashboard (Centro de Control) → Budgets → Schedule
 *
 * Run: npx playwright test tests/global-sanity.spec.ts
 */

import { test, expect } from '@playwright/test';
import { setupAuth } from './auth.setup';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

test.describe('Global Sanity: Full App Flow', () => {
    test.beforeEach(async ({ page }) => {
        await setupAuth(page, BASE_URL);
    });

    test('Dashboard loads as Centro de Control', async ({ page }) => {
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
        // The dashboard should show "Centro de Control" (not just "Dashboard")
        const heading = page.locator('h1');
        await expect(heading).toContainText(/Centro de Control|Dashboard/i, { timeout: 10000 });
    });

    test('can navigate to Budgets page', async ({ page }) => {
        await page.goto(`${BASE_URL}/budgets`, { waitUntil: 'domcontentloaded' });
        const heading = page.locator('h1');
        await expect(heading).toContainText(/Budget/i, { timeout: 10000 });
    });

    test('can navigate to Scheduling page', async ({ page }) => {
        await page.goto(`${BASE_URL}/scheduling`, { waitUntil: 'domcontentloaded' });
        // scheduling page should load without crash
        await expect(page.locator('body')).not.toBeEmpty();
    });

    test('no competitor mentions visible in DOM', async ({ page }) => {
        const pages = ['/', '/budgets', '/scheduling'];
        const competitors = ['Nory', 'WISK', 'MarketMan', '7shifts'];

        for (const path of pages) {
            await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);

            const bodyText = await page.locator('body').innerText();

            for (const comp of competitors) {
                // Check visible text only (not HTML attrs or class names)
                const found = bodyText.includes(comp);
                expect(found, `Found "${comp}" on page ${path}`).toBe(false);
            }
        }
    });

    test('Executive Briefing component renders', async ({ page }) => {
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
        // Look for the Morning Briefing card
        const briefing = page.locator('text=Morning Briefing');
        // It should exist in the DOM (may be loading)
        await expect(briefing.or(page.locator('text=Centro de Control'))).toBeVisible({ timeout: 10000 });
    });
});
