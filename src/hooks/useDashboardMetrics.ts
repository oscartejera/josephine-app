import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DateRangePreset = 'today' | '7d' | '30d' | 'custom';

export interface DateRange {
  from: string; // ISO date string YYYY-MM-DD
  to: string;   // ISO date string YYYY-MM-DD
}

/** A KPI value that may or may not be available. */
export type KpiResult<T = number> =
  | { available: true; value: T }
  | { available: false; reason: string };

export interface DashboardKpis {
  sales: KpiResult;
  gpPercent: KpiResult;
  cogs: KpiResult;
  labor: KpiResult;
  colPercent: KpiResult;
  covers: KpiResult;
  avgTicket: KpiResult;
}

export interface DashboardMetricsResult {
  current: DashboardKpis;
  previous: DashboardKpis;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a Date as YYYY-MM-DD in the browser's local timezone (not UTC). */
export function localISODate(d: Date): string {
  return d.toLocaleDateString('en-CA'); // en-CA locale → YYYY-MM-DD
}

function kpiOk(value: number): KpiResult {
  return { available: true, value };
}

function kpiMissing(reason: string): KpiResult {
  return { available: false, reason };
}

/** @internal Stable signature for missing KPIs (sorted, deterministic). */
export function __buildMissingKpiSignature(result: Record<string, KpiResult>): string | null {
  const pairs = Object.entries(result)
    .filter(([, v]) => !v.available)
    .map(([k, v]) => `${k}:${(v as { reason: string }).reason}`)
    .sort();
  return pairs.length > 0 ? pairs.join('|') : null;
}

// Dev-only dedupe state (tree-shaken in prod)
const __devLastSig: Record<string, string> = {};
const __devLastAt: Record<string, number> = {};
const __DEV_THROTTLE_MS = 60_000;

/** Build the previous period of equal length ending right before `from`. */
export function getPreviousPeriod(from: string, to: string): DateRange {
  const f = new Date(from + 'T00:00:00');
  const t = new Date(to + 'T23:59:59');
  const lengthMs = t.getTime() - f.getTime();
  const prevTo = new Date(f.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - lengthMs);
  return {
    from: localISODate(prevFrom),
    to: localISODate(prevTo),
  };
}

/** Compute date range from a preset. */
export function presetToDateRange(preset: DateRangePreset, custom?: { from: Date; to: Date }): DateRange {
  const now = new Date();
  const todayStr = localISODate(now);

  switch (preset) {
    case 'today':
      return { from: todayStr, to: todayStr };
    case '7d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return { from: localISODate(d), to: todayStr };
    }
    case '30d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      return { from: localISODate(d), to: todayStr };
    }
    case 'custom':
      if (custom) {
        return {
          from: localISODate(custom.from),
          to: localISODate(custom.to),
        };
      }
      return { from: todayStr, to: todayStr };
  }
}

// ---------------------------------------------------------------------------
// Data fetchers
// ---------------------------------------------------------------------------

async function fetchPeriodKpis(
  dateRange: DateRange,
  locationId: string | null,
  dataSource: 'pos' | 'simulated',
): Promise<DashboardKpis> {
  const { from, to } = dateRange;
  const dsUnified = dataSource === 'pos' ? 'pos' : 'demo';

  // --- Sales -----------------------------------------------------------
  let salesQuery = supabase
    .from('v_pos_daily_finance_unified')
    .select('net_sales, orders_count')
    .eq('data_source_unified', dsUnified)
    .gte('date', from)
    .lte('date', to);

  if (locationId && locationId !== 'all') {
    salesQuery = salesQuery.eq('location_id', locationId);
  }

  const { data: salesRows, error: salesErr } = await salesQuery;

  let sales: KpiResult;
  let totalNetSales = 0;
  let totalOrders = 0;

  if (salesErr || !salesRows || salesRows.length === 0) {
    sales = kpiMissing('Sin datos de ventas para este periodo');
  } else {
    totalNetSales = salesRows.reduce((s, r) => s + (Number(r.net_sales) || 0), 0);
    totalOrders = salesRows.reduce((s, r) => s + (Number(r.orders_count) || 0), 0);
    sales = kpiOk(totalNetSales);
  }

  // --- Labor -----------------------------------------------------------
  let laborQuery = supabase
    .from('labour_daily')
    .select('labour_cost')
    .gte('date', from)
    .lte('date', to);

  if (locationId && locationId !== 'all') {
    laborQuery = laborQuery.eq('location_id', locationId);
  }

  const { data: laborRows } = await laborQuery;
  let labor: KpiResult;
  let totalLabor = 0;

  if (!laborRows || laborRows.length === 0) {
    labor = kpiMissing('Sin datos de nómina para este periodo');
  } else {
    totalLabor = laborRows.reduce((s, r) => s + (Number(r.labour_cost) || 0), 0);
    labor = kpiOk(totalLabor);
  }

  // --- COGS (real from cogs_daily) ------------------------------------
  let cogsQuery = supabase
    .from('cogs_daily')
    .select('cogs_amount')
    .gte('date', from)
    .lte('date', to);

  if (locationId && locationId !== 'all') {
    cogsQuery = cogsQuery.eq('location_id', locationId);
  }

  const { data: cogsRows } = await cogsQuery;
  let cogs: KpiResult;
  let totalCogs = 0;

  if (!cogsRows || cogsRows.length === 0) {
    cogs = kpiMissing('COGS no configurado — conecta recetas e inventario');
  } else {
    totalCogs = cogsRows.reduce((s, r) => s + (Number(r.cogs_amount) || 0), 0);
    cogs = kpiOk(totalCogs);
  }

  // --- GP% (needs sales + cogs) ----------------------------------------
  let gpPercent: KpiResult;
  if (sales.available && cogs.available) {
    const gp = totalNetSales > 0
      ? ((totalNetSales - totalCogs) / totalNetSales) * 100
      : 0;
    gpPercent = kpiOk(Math.round(gp * 10) / 10);
  } else if (!sales.available) {
    gpPercent = kpiMissing('Requiere datos de ventas');
  } else {
    gpPercent = kpiMissing('Requiere datos de COGS reales');
  }

  // --- COL% (needs sales + labor) --------------------------------------
  let colPercent: KpiResult;
  if (sales.available && labor.available) {
    const col = totalNetSales > 0
      ? (totalLabor / totalNetSales) * 100
      : 0;
    colPercent = kpiOk(Math.round(col * 10) / 10);
  } else if (!sales.available) {
    colPercent = kpiMissing('Requiere datos de ventas');
  } else {
    colPercent = kpiMissing('Requiere datos de nómina');
  }

  // --- Covers ----------------------------------------------------------
  let coversQuery = supabase
    .from('tickets')
    .select('covers')
    .gte('opened_at', from + 'T00:00:00')
    .lte('opened_at', to + 'T23:59:59');

  if (locationId && locationId !== 'all') {
    coversQuery = coversQuery.eq('location_id', locationId);
  }

  const { data: coverRows } = await coversQuery;
  let covers: KpiResult;
  let totalCovers = 0;

  if (!coverRows || coverRows.length === 0) {
    covers = kpiMissing('Sin datos de covers para este periodo');
  } else {
    totalCovers = coverRows.reduce((s, r) => s + (Number(r.covers) || 0), 0);
    covers = kpiOk(totalCovers);
  }

  // --- Avg Ticket ------------------------------------------------------
  let avgTicket: KpiResult;
  if (sales.available && covers.available && totalCovers > 0) {
    avgTicket = kpiOk(Math.round((totalNetSales / totalCovers) * 100) / 100);
  } else if (!sales.available) {
    avgTicket = kpiMissing('Requiere datos de ventas');
  } else if (!covers.available) {
    avgTicket = kpiMissing('Covers no disponible');
  } else {
    // covers === 0 with rows present
    avgTicket = kpiMissing('Covers = 0 en este periodo');
  }

  const result = { sales, gpPercent, cogs, labor, colPercent, covers, avgTicket };

  // Observability: log missing KPIs in dev (deduped per location+range, throttled 60s)
  if (import.meta.env.DEV) {
    const sig = __buildMissingKpiSignature(result);
    if (sig) {
      const scopeKey = `${locationId ?? 'all'}:${from}->${to}`;
      const now = Date.now();
      if (sig !== __devLastSig[scopeKey] || now - (__devLastAt[scopeKey] ?? 0) > __DEV_THROTTLE_MS) {
        console.warn('[Dashboard KPIs] missing:', sig.replace(/\|/g, ' | '));
        __devLastSig[scopeKey] = sig;
        __devLastAt[scopeKey] = now;
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseDashboardMetricsParams {
  locationId: string | null;
  dateRange: DateRange;
  dataSource: 'pos' | 'simulated';
}

export function useDashboardMetrics({ locationId, dateRange, dataSource }: UseDashboardMetricsParams) {
  return useQuery<DashboardMetricsResult>({
    queryKey: [
      'dashboard-metrics',
      locationId ?? 'all',
      dateRange.from,
      dateRange.to,
      dataSource,
    ],
    queryFn: async () => {
      const previousRange = getPreviousPeriod(dateRange.from, dateRange.to);

      const [current, previous] = await Promise.all([
        fetchPeriodKpis(dateRange, locationId, dataSource),
        fetchPeriodKpis(previousRange, locationId, dataSource),
      ]);

      return { current, previous };
    },
    staleTime: 30_000,
  });
}
