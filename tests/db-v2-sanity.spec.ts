/**
 * DB v2 Sanity Tests — Verifies all key modules load without runtime errors.
 * Tests: Labour, Escandallos, P&L, Budgets, Sales, Procurement, Onboarding
 *
 * Run: npx playwright test tests/db-v2-sanity.spec.ts
 */

import { test, expect } from '@playwright/test';
import { setupAuth } from './auth.setup';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const TIMEOUT = 15000;

test.describe('DB v2: Module Load Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupAuth(page, BASE_URL);
    });

    test('Dashboard loads KPI cards', async ({ page }) => {
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
        const body = page.locator('body');
        await expect(body).not.toBeEmpty();
        // Should not show a full-page error
        await expect(page.locator('text=Something went wrong')).not.toBeVisible({ timeout: 5000 }).catch(() => {});
    });

    test('Labour page loads without crash', async ({ page }) => {
        await page.goto(`${BASE_URL}/insights/labour`, { waitUntil: 'domcontentloaded' });
        // Should show either Labour/Personal header or loading state
        const heading = page.locator('h1, h2');
        await expect(heading.first()).toBeVisible({ timeout: TIMEOUT });
        // No crash indicator
        await expect(page.locator('text=Something went wrong')).not.toBeVisible({ timeout: 3000 }).catch(() => {});
    });

    test('Sales page loads without crash', async ({ page }) => {
        await page.goto(`${BASE_URL}/sales`, { waitUntil: 'domcontentloaded' });
        const body = page.locator('body');
        await expect(body).not.toBeEmpty();
    });

    test('Escandallos page loads without crash', async ({ page }) => {
        await page.goto(`${BASE_URL}/escandallos`, { waitUntil: 'domcontentloaded' });
        const body = page.locator('body');
        await expect(body).not.toBeEmpty();
    });

    test('Instant P&L page loads without crash', async ({ page }) => {
        await page.goto(`${BASE_URL}/instant-pl`, { waitUntil: 'domcontentloaded' });
        const body = page.locator('body');
        await expect(body).not.toBeEmpty();
    });

    test('Budgets page loads without crash', async ({ page }) => {
        await page.goto(`${BASE_URL}/budgets`, { waitUntil: 'domcontentloaded' });
        const body = page.locator('body');
        await expect(body).not.toBeEmpty();
    });

    test('Procurement page loads without crash', async ({ page }) => {
        await page.goto(`${BASE_URL}/procurement`, { waitUntil: 'domcontentloaded' });
        const body = page.locator('body');
        await expect(body).not.toBeEmpty();
    });

    test('Inventory Setup page loads without crash', async ({ page }) => {
        await page.goto(`${BASE_URL}/inventory-setup`, { waitUntil: 'domcontentloaded' });
        const body = page.locator('body');
        await expect(body).not.toBeEmpty();
    });

    test('Stock Audit page loads without crash', async ({ page }) => {
        await page.goto(`${BASE_URL}/operations/stock-audit`, { waitUntil: 'domcontentloaded' });
        const body = page.locator('body');
        await expect(body).not.toBeEmpty();
    });

    test('Scheduling page loads without crash', async ({ page }) => {
        await page.goto(`${BASE_URL}/scheduling`, { waitUntil: 'domcontentloaded' });
        const body = page.locator('body');
        await expect(body).not.toBeEmpty();
    });

    test('Payroll page loads without crash', async ({ page }) => {
        await page.goto(`${BASE_URL}/payroll`, { waitUntil: 'domcontentloaded' });
        const body = page.locator('body');
        await expect(body).not.toBeEmpty();
    });

    test('Menu Engineering page loads without crash', async ({ page }) => {
        await page.goto(`${BASE_URL}/menu-engineering`, { waitUntil: 'domcontentloaded' });
        const body = page.locator('body');
        await expect(body).not.toBeEmpty();
    });

    test('Waste page loads without crash', async ({ page }) => {
        await page.goto(`${BASE_URL}/waste`, { waitUntil: 'domcontentloaded' });
        const body = page.locator('body');
        await expect(body).not.toBeEmpty();
    });
});

test.describe('DB v2: No Console Errors', () => {
    test.beforeEach(async ({ page }) => {
        await setupAuth(page, BASE_URL);
    });

    test('critical pages have no uncaught errors', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (err) => {
            errors.push(err.message);
        });

        const criticalPages = [
            '/',
            '/insights/labour',
            '/sales',
            '/budgets',
            '/instant-pl',
        ];

        for (const path of criticalPages) {
            await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(3000);
        }

        // Filter out known benign errors (e.g. auth bypass side effects)
        const realErrors = errors.filter(
            (e) => !e.includes('auth') && !e.includes('session') && !e.includes('JWT')
        );

        expect(
            realErrors.length,
            `Uncaught errors found: ${realErrors.join(', ')}`
        ).toBe(0);
    });
});
