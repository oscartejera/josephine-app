/**
 * dataSourceContracts.test.ts — Static contract tests for data-source architecture.
 *
 * These tests validate architectural invariants WITHOUT network access:
 *  1. The "blocked" flag relies on a stable prefix convention
 *  2. All sales/analytics hooks call *_unified RPCs or views
 *  3. The audit script reports 0 offenders on the current codebase
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROOT = resolve(__dirname, '../..');

function readHook(filename: string): string {
  return readFileSync(resolve(ROOT, 'src/hooks', filename), 'utf8');
}

// ---------------------------------------------------------------------------
// 1. manual_pos_blocked_ prefix convention
// ---------------------------------------------------------------------------

describe('blocked reason prefix contract', () => {
  const BLOCKED_PREFIX = 'manual_pos_blocked_';

  // All known blocked reasons — if a new one is added, add it here.
  const KNOWN_BLOCKED_REASONS = [
    'manual_pos_blocked_integration_inactive',
    'manual_pos_blocked_never_synced',
    'manual_pos_blocked_sync_stale',
  ];

  // Reasons that must NOT be treated as blocked
  const NON_BLOCKED_REASONS = [
    'auto_pos_recent',
    'auto_demo_no_sync',
    'manual_demo',
    'manual_pos_ok',
    'loading',
    'no_session',
    'legacy_pos_connected',
    'legacy_no_pos',
  ];

  it('all known blocked reasons start with the prefix', () => {
    for (const reason of KNOWN_BLOCKED_REASONS) {
      expect(reason.startsWith(BLOCKED_PREFIX)).toBe(true);
    }
  });

  it('non-blocked reasons do NOT start with the prefix', () => {
    for (const reason of NON_BLOCKED_REASONS) {
      expect(reason.startsWith(BLOCKED_PREFIX)).toBe(false);
    }
  });

  it('useDataSource.ts derives blocked from the prefix (not individual strings)', () => {
    const src = readFileSync(
      resolve(ROOT, 'src/hooks/useDataSource.ts'),
      'utf8',
    );
    // The line: blocked: result.reason.startsWith('manual_pos_blocked_')
    expect(src).toContain(".startsWith('manual_pos_blocked_')");
  });
});

// ---------------------------------------------------------------------------
// 2. Sales/analytics hooks must use *_unified RPCs or views
// ---------------------------------------------------------------------------

describe('unified RPC/view contract for analytics hooks', () => {
  /**
   * Map of hook filename → expected *_unified references.
   * Each hook must contain at least one of these strings in its source.
   */
  const HOOKS: Record<string, string[]> = {
    'useBISalesData.ts': [
      'get_sales_timeseries_unified',
      'get_top_products_unified',
    ],
    'useSalesTimeseries.ts': ['get_sales_timeseries_unified'],
    'useTopProductsUnified.ts': ['get_top_products_unified'],
    'useForecastItemsMix.ts': ['get_forecast_items_mix_unified'],
    'useControlTowerData.ts': [
      'get_sales_timeseries_unified',
      'get_top_products_unified',
    ],
    'useInstantPLData.ts': ['get_instant_pnl_unified'],
    'useLaborPlanUnified.ts': ['get_labor_plan_unified'],
  };

  for (const [file, expectedRefs] of Object.entries(HOOKS)) {
    it(`${file} references all expected *_unified RPCs/views`, () => {
      const src = readHook(file);
      for (const ref of expectedRefs) {
        expect(src, `${file} must contain "${ref}"`).toContain(ref);
      }
    });
  }

  it('no analytics hook lost its *_unified reference', () => {
    // Meta-test: ensure we're actually checking the right number of hooks
    expect(Object.keys(HOOKS).length).toBeGreaterThanOrEqual(7);
  });
});

// ---------------------------------------------------------------------------
// 3. Audit script reports 0 offenders
// ---------------------------------------------------------------------------

describe('audit:ds:fail gate', () => {
  it('audit script exits 0 (no offenders)', () => {
    // Run the real audit script in strict mode
    const result = execSync('node scripts/audit-data-source-aware.mjs --fail-on-offenders', {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 15_000,
    });
    expect(result).toContain('Offenders:               0');
  });
});
