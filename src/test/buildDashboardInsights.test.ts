import { describe, it, expect } from 'vitest';
import {
  buildDashboardInsights,
  type LowStockItem,
} from '@/lib/buildDashboardInsights';
import type { DashboardKpis, KpiResult } from '@/hooks/useDashboardMetrics';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function ok(value: number): KpiResult {
  return { available: true, value };
}

function missing(reason = 'test'): KpiResult {
  return { available: false, reason };
}

function makeKpis(overrides: Partial<DashboardKpis> = {}): DashboardKpis {
  return {
    sales: ok(10000),
    gpPercent: ok(68),
    cogs: ok(3200),
    labor: ok(2500),
    colPercent: ok(25),
    covers: ok(120),
    avgTicket: ok(83.33),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// null kpis
// ---------------------------------------------------------------------------

describe('buildDashboardInsights', () => {
  it('null kpis → missing message only', () => {
    const result = buildDashboardInsights(null, null, null, null);
    expect(result.actions).toHaveLength(0);
    expect(result.risks).toHaveLength(0);
    expect(result.missing).toContain('No hay datos de KPIs disponibles para generar insights.');
  });

  // -----------------------------------------------------------------------
  // Missing data tracking
  // -----------------------------------------------------------------------

  it('tracks missing sales, labor, cogs, covers', () => {
    const kpis = makeKpis({
      sales: missing(),
      labor: missing(),
      cogs: missing(),
      covers: missing(),
    });
    const result = buildDashboardInsights(kpis, null, null, null);
    expect(result.missing).toContain('ventas');
    expect(result.missing).toContain('coste laboral');
    expect(result.missing).toContain('COGS (recetas/costes no configurados)');
    expect(result.missing).toContain('covers');
  });

  it('does not report missing when KPIs are available', () => {
    const kpis = makeKpis();
    const result = buildDashboardInsights(kpis, null, null, null);
    expect(result.missing).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // COL% rules
  // -----------------------------------------------------------------------

  it('COL% >= 35 → risk', () => {
    const kpis = makeKpis({ colPercent: ok(36) });
    const result = buildDashboardInsights(kpis, null, null, null);
    expect(result.risks.some(r => r.text.includes('COL%') && r.text.includes('muy alto'))).toBe(true);
  });

  it('COL% >= 30 but < 35 → action', () => {
    const kpis = makeKpis({ colPercent: ok(32) });
    const result = buildDashboardInsights(kpis, null, null, null);
    expect(result.actions.some(a => a.text.includes('COL%') && a.text.includes('por encima'))).toBe(true);
  });

  it('COL% < 20 with labor → understaffing action', () => {
    const kpis = makeKpis({ colPercent: ok(15), labor: ok(1500) });
    const result = buildDashboardInsights(kpis, null, null, null);
    expect(result.actions.some(a => a.text.includes('muy bajo'))).toBe(true);
  });

  // -----------------------------------------------------------------------
  // GP% rules
  // -----------------------------------------------------------------------

  it('GP% < 50 → critical risk', () => {
    const kpis = makeKpis({ gpPercent: ok(45) });
    const result = buildDashboardInsights(kpis, null, null, null);
    expect(result.risks.some(r => r.text.includes('GP%') && r.text.includes('umbral crítico'))).toBe(true);
  });

  it('GP% < 60 → action', () => {
    const kpis = makeKpis({ gpPercent: ok(55) });
    const result = buildDashboardInsights(kpis, null, null, null);
    expect(result.actions.some(a => a.text.includes('GP%') && a.text.includes('Revisa productos'))).toBe(true);
  });

  it('GP% < 60 and dropping → includes "bajando"', () => {
    const kpis = makeKpis({ gpPercent: ok(55) });
    const prev = makeKpis({ gpPercent: ok(62) });
    const result = buildDashboardInsights(kpis, prev, null, null);
    expect(result.actions.some(a => a.text.includes('bajando'))).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Sales trend
  // -----------------------------------------------------------------------

  it('sales drop > 15% → risk', () => {
    const kpis = makeKpis({ sales: ok(8000) });
    const prev = makeKpis({ sales: ok(10000) });
    const result = buildDashboardInsights(kpis, prev, null, null);
    expect(result.risks.some(r => r.text.includes('Ventas caen'))).toBe(true);
  });

  it('sales rise > 15% → action', () => {
    const kpis = makeKpis({ sales: ok(12000) });
    const prev = makeKpis({ sales: ok(10000) });
    const result = buildDashboardInsights(kpis, prev, null, null);
    expect(result.actions.some(a => a.text.includes('Ventas suben'))).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Avg ticket
  // -----------------------------------------------------------------------

  it('low avg ticket with covers → upsell action', () => {
    const kpis = makeKpis({ avgTicket: ok(8.5), covers: ok(50) });
    const result = buildDashboardInsights(kpis, null, null, null);
    expect(result.actions.some(a => a.text.includes('upsell'))).toBe(true);
  });

  it('covers=0 → no avg ticket action (covers available but 0)', () => {
    const kpis = makeKpis({ covers: ok(0), avgTicket: missing('Covers = 0') });
    const result = buildDashboardInsights(kpis, null, null, null);
    expect(result.actions.some(a => a.text.includes('upsell'))).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Low stock with percentOfPar null (Fix E)
  // -----------------------------------------------------------------------

  it('ignores items with percentOfPar=null in critical check', () => {
    const items: LowStockItem[] = [
      { name: 'Tomates', percentOfPar: null },
      { name: 'Aceite', percentOfPar: null },
    ];
    const kpis = makeKpis();
    const result = buildDashboardInsights(kpis, null, null, items);
    // Should NOT fire "Stock crítico" because all items have null percentOfPar
    expect(result.risks.some(r => r.text.includes('Stock crítico'))).toBe(false);
    // Should still show "Stock bajo" since items exist
    expect(result.actions.some(a => a.text.includes('Stock bajo'))).toBe(true);
  });

  it('fires critical when percentOfPar <= 25', () => {
    const items: LowStockItem[] = [
      { name: 'Tomates', percentOfPar: 10 },
    ];
    const kpis = makeKpis();
    const result = buildDashboardInsights(kpis, null, null, items);
    expect(result.risks.some(r => r.text.includes('Stock crítico') && r.text.includes('Tomates'))).toBe(true);
  });

  it('fires stock bajo when percentOfPar > 25', () => {
    const items: LowStockItem[] = [
      { name: 'Aceite', percentOfPar: 60 },
    ];
    const kpis = makeKpis();
    const result = buildDashboardInsights(kpis, null, null, items);
    expect(result.actions.some(a => a.text.includes('Stock bajo'))).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Positive reinforcement
  // -----------------------------------------------------------------------

  it('good GP% and COL% → positive info', () => {
    const kpis = makeKpis({ gpPercent: ok(68), colPercent: ok(22) });
    const result = buildDashboardInsights(kpis, null, null, null);
    expect(result.actions.some(a => a.type === 'info' && a.text.includes('Buen balance'))).toBe(true);
  });

  it('no positive reinforcement when sales = 0', () => {
    const kpis = makeKpis({ sales: ok(0), gpPercent: ok(68), colPercent: ok(22) });
    const result = buildDashboardInsights(kpis, null, null, null);
    expect(result.actions.some(a => a.text.includes('Buen balance'))).toBe(false);
  });
});
