import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  presetToDateRange,
  getPreviousPeriod,
  localISODate,
} from '@/hooks/useDashboardMetrics';

// ---------------------------------------------------------------------------
// localISODate
// ---------------------------------------------------------------------------

describe('localISODate', () => {
  it('returns YYYY-MM-DD in local timezone', () => {
    const d = new Date(2026, 1, 13); // Feb 13 2026 local
    expect(localISODate(d)).toBe('2026-02-13');
  });

  it('does not shift date at 23:30 Europe/Madrid-like local time', () => {
    // Simulate a date that would shift if UTC were used
    // e.g. Feb 13 at 23:30 local → Feb 14 in UTC for UTC+1
    const d = new Date(2026, 1, 13, 23, 30, 0);
    expect(localISODate(d)).toBe('2026-02-13');
  });

  it('handles single-digit months and days', () => {
    const d = new Date(2026, 0, 5); // Jan 5
    expect(localISODate(d)).toBe('2026-01-05');
  });
});

// ---------------------------------------------------------------------------
// presetToDateRange (mocked Date to be deterministic)
// ---------------------------------------------------------------------------

describe('presetToDateRange', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Fix "now" to 2026-02-13 14:00:00 local
    vi.setSystemTime(new Date(2026, 1, 13, 14, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('today → same from/to', () => {
    const r = presetToDateRange('today');
    expect(r.from).toBe('2026-02-13');
    expect(r.to).toBe('2026-02-13');
  });

  it('7d → 7-day span ending today', () => {
    const r = presetToDateRange('7d');
    expect(r.from).toBe('2026-02-07');
    expect(r.to).toBe('2026-02-13');
  });

  it('30d → 30-day span ending today', () => {
    const r = presetToDateRange('30d');
    expect(r.from).toBe('2026-01-15');
    expect(r.to).toBe('2026-02-13');
  });

  it('custom with dates → uses those dates', () => {
    const r = presetToDateRange('custom', {
      from: new Date(2026, 0, 1),
      to: new Date(2026, 0, 31),
    });
    expect(r.from).toBe('2026-01-01');
    expect(r.to).toBe('2026-01-31');
  });

  it('custom without dates → fallback to today', () => {
    const r = presetToDateRange('custom');
    expect(r.from).toBe('2026-02-13');
    expect(r.to).toBe('2026-02-13');
  });

  it('returns YYYY-MM-DD format (not ISO with T)', () => {
    const r = presetToDateRange('today');
    expect(r.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ---------------------------------------------------------------------------
// getPreviousPeriod
// ---------------------------------------------------------------------------

describe('getPreviousPeriod', () => {
  it('single day → previous day', () => {
    const prev = getPreviousPeriod('2026-02-13', '2026-02-13');
    expect(prev.from).toBe('2026-02-12');
    expect(prev.to).toBe('2026-02-12');
  });

  it('7-day range → previous 7 days', () => {
    const prev = getPreviousPeriod('2026-02-07', '2026-02-13');
    expect(prev.to).toBe('2026-02-06');
    // from should be 7 days before to
    expect(prev.from).toBe('2026-01-31');
  });

  it('preserves equal period length', () => {
    const from = '2026-02-01';
    const to = '2026-02-28';
    const prev = getPreviousPeriod(from, to);

    const originalMs = new Date(to + 'T23:59:59').getTime() - new Date(from + 'T00:00:00').getTime();
    const prevMs = new Date(prev.to + 'T23:59:59').getTime() - new Date(prev.from + 'T00:00:00').getTime();

    // Allow 1 day tolerance due to midnight rounding
    expect(Math.abs(originalMs - prevMs)).toBeLessThan(86400000);
  });

  it('previous period ends right before current period starts', () => {
    const prev = getPreviousPeriod('2026-02-10', '2026-02-13');
    // prev.to should be the day before from (2026-02-09)
    expect(prev.to).toBe('2026-02-09');
  });

  it('returns YYYY-MM-DD format', () => {
    const prev = getPreviousPeriod('2026-02-13', '2026-02-13');
    expect(prev.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(prev.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
