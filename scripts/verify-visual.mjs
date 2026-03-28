#!/usr/bin/env node
/**
 * Visual Verification — Browser Screenshot After Changes
 *
 * Launches the dev server, navigates to a page, captures screenshot,
 * and checks for console errors. Proves the change works visually.
 *
 * Usage:
 *   node scripts/verify-visual.mjs -- /insights/sales
 *   node scripts/verify-visual.mjs -- /dashboard
 *   node scripts/verify-visual.mjs -- /workforce/schedules --dark
 */

import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const args = process.argv.slice(2).filter(a => a !== '--');
const ROUTE = args.find(a => a.startsWith('/')) || '/dashboard';
const DARK = args.includes('--dark');
const PORT = 5173;

async function main() {
  console.log(`\n🔍 Visual Verification: ${ROUTE}`);
  console.log('─'.repeat(50));

  // Check if Playwright is installed
  try {
    execSync('npx playwright --version', { stdio: 'pipe', cwd: ROOT });
  } catch {
    console.log('❌ Playwright not installed. Run: npx playwright install');
    process.exit(1);
  }

  // Create screenshots dir
  const screenshotDir = join(ROOT, 'docs', 'screenshots');
  if (!existsSync(screenshotDir)) mkdirSync(screenshotDir, { recursive: true });

  const screenshotName = ROUTE.replace(/\//g, '_').replace(/^_/, '') || 'root';
  const screenshotPath = join(screenshotDir, `${screenshotName}.png`);

  // Write a temporary Playwright script
  const testScript = `
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ${DARK ? "colorScheme: 'dark'," : ''}
  });
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  try {
    await page.goto('http://localhost:${PORT}${ROUTE}', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '${screenshotPath.replace(/\\/g, '\\\\')}', fullPage: false });

    console.log('✅ Screenshot: ${screenshotPath.replace(/\\/g, '\\\\')}');

    if (errors.length > 0) {
      console.log('⚠️  Console errors found:');
      errors.forEach(e => console.log('   ❌ ' + e));
    } else {
      console.log('✅ No console errors');
    }
  } catch (err) {
    console.log('❌ Navigation failed: ' + err.message);
  }

  await browser.close();
})();
`;

  const tmpFile = join(ROOT, 'docs', 'screenshots', '_verify-tmp.cjs');
  const { writeFileSync, unlinkSync } = await import('fs');
  writeFileSync(tmpFile, testScript);

  try {
    execSync(`node "${tmpFile}"`, { stdio: 'inherit', cwd: ROOT, timeout: 60000 });
  } catch (err) {
    console.log('\n⚠️  Make sure dev server is running: npm run dev');
  }

  // Clean up
  try { unlinkSync(tmpFile); } catch {}

  console.log('─'.repeat(50));
  console.log(`📸 Route: ${ROUTE}`);
  console.log(`📁 Screenshot: docs/screenshots/${screenshotName}.png`);
  console.log('');
}

main();
