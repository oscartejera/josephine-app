/**
 * Auth Setup — Playwright E2E Authentication Bypass
 * 
 * Injects a Supabase session directly into localStorage before tests run.
 * Uses the service role key to create a temporary auth session.
 *
 * Usage: Import and call `setupAuth(page)` before navigating to any route.
 */

import type { Page } from '@playwright/test';

// Use env vars or fallback to known dev values
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qixipveebfhurbarksib.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

/**
 * Injects a mock Supabase auth session into localStorage.
 * This bypasses the login screen for E2E tests.
 */
export async function setupAuth(page: Page, baseURL: string) {
    // Navigate to the base URL first to set localStorage on the correct origin
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });

    // Create a mock session token that Supabase client will accept
    // The key format is: sb-{project_ref}-auth-token
    const projectRef = 'qixipveebfhurbarksib';
    const storageKey = `sb-${projectRef}-auth-token`;

    // Inject a test session into localStorage
    // This creates a session that the Supabase client will read on startup
    const mockSession = {
        access_token: process.env.SUPABASE_TEST_TOKEN || 'test-bypass-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'test-refresh-token',
        user: {
            id: '00000000-0000-0000-0000-000000000000',
            email: 'e2e-test@josephine.app',
            role: 'authenticated',
            aud: 'authenticated',
        },
    };

    await page.evaluate(
        ({ key, session }) => {
            localStorage.setItem(key, JSON.stringify(session));
        },
        { key: storageKey, session: mockSession }
    );

    // Reload to let the app pick up the session
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Wait for the app to initialize
    await page.waitForTimeout(2000);
}

/**
 * Alternative: Use real Supabase login with test credentials.
 * Set SUPABASE_TEST_EMAIL and SUPABASE_TEST_PASSWORD env vars.
 */
export async function loginWithCredentials(page: Page, baseURL: string) {
    const email = process.env.SUPABASE_TEST_EMAIL;
    const password = process.env.SUPABASE_TEST_PASSWORD;

    if (!email || !password) {
        console.warn('[auth.setup] No test credentials provided, using mock session');
        return setupAuth(page, baseURL);
    }

    await page.goto(baseURL, { waitUntil: 'networkidle' });

    // Fill login form
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    if (await emailInput.isVisible({ timeout: 5000 })) {
        await emailInput.fill(email);
        await passwordInput.fill(password);
        await page.locator('button[type="submit"]').click();
        await page.waitForURL('**/dashboard**', { timeout: 10000 });
    }
}
