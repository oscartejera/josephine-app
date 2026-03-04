/**
 * useLabourData - Hook for Labour page using optimized RPC calls
 * Calls get_labour_kpis, get_labour_timeseries, get_labour_locations_table
 */

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useApp } from '@/contexts/AppContext';
import { buildQueryContext, getLabourKpisRpc, getLabourTimeseriesRpc, getLabourLocationsRpc } from '@/data';

export type MetricMode = 'percentage' | 'amount' | 'hours';

export interface LabourDateRange {
  from: Date;
  to: Date;
}

// Single source of truth: types come from rpc-contracts.ts (Zod schemas)
import type { LabourKpisRpc, LabourTimeseriesRowRpc, LabourLocationRowRpc } from '@/data/rpc-contracts';

export type LabourKpis = LabourKpisRpc;
export type LabourTimeseriesRow = LabourTimeseriesRowRpc;
export type LabourLocationRow = LabourLocationRowRpc;

/** Sanitize a numeric value: replace NaN/Infinity with null */
function safeNum(v: unknown): number | null {
  const n = Number(v);
  if (!isFinite(n)) return null;
  return n;
}

/** Sanitize KPI response: guard divide-by-zero producing NaN/Infinity */
function sanitizeKpis(raw: Record<string, unknown>): LabourKpis {
  const sales = Number(raw.actual_sales) || 0;
  const hours = Number(raw.actual_labor_hours) || 0;
  const cost = Number(raw.actual_labor_cost) || 0;

  return {
    actual_sales: sales,
    forecast_sales: Number(raw.forecast_sales) || 0,
    actual_labor_cost: cost,
    planned_labor_cost: Number(raw.planned_labor_cost) || 0,
    actual_labor_hours: hours,
    planned_labor_hours: Number(raw.planned_labor_hours) || 0,
    actual_orders: Number(raw.actual_orders) || 0,
    forecast_orders: Number(raw.forecast_orders) || 0,
    // COL%: null when sales = 0 (not Infinity)
    actual_col_pct: sales > 0 ? (safeNum(raw.actual_col_pct) ?? (cost / sales) * 100) : 0,
    planned_col_pct: safeNum(raw.planned_col_pct) ?? 0,
    // SPLH: null when hours = 0
    actual_splh: hours > 0 ? (safeNum(raw.actual_splh) ?? sales / hours) : 0,
    planned_splh: safeNum(raw.planned_splh) ?? 0,
    actual_oplh: safeNum(raw.actual_oplh) ?? 0,
    planned_oplh: safeNum(raw.planned_oplh) ?? 0,
    sales_delta_pct: safeNum(raw.sales_delta_pct) ?? 0,
    col_delta_pct: safeNum(raw.col_delta_pct) ?? 0,
    hours_delta_pct: safeNum(raw.hours_delta_pct) ?? 0,
    splh_delta_pct: safeNum(raw.splh_delta_pct) ?? 0,
    oplh_delta_pct: safeNum(raw.oplh_delta_pct) ?? 0,
    // Wave 1: payroll-first fields
    labor_cost_source: (raw.labor_cost_source as string) === 'payroll' ? 'payroll' : 'schedule',
    schedule_labor_cost: Number(raw.schedule_labor_cost) || 0,
    cost_per_cover: safeNum(raw.cost_per_cover) ?? 0,
    cogs_total: Number(raw.cogs_total) || 0,
    cogs_pct: safeNum(raw.cogs_pct) ?? 0,
    prime_cost_pct: safeNum(raw.prime_cost_pct) ?? 0,
    prime_cost_amount: Number(raw.prime_cost_amount) || 0,
  };
}

interface UseLabourDataParams {
  dateRange: LabourDateRange;
  locationId?: string | null;
}

export function useLabourData({ dateRange, locationId }: UseLabourDataParams) {
  const { dataSource, loading: appLoading, group } = useApp();
  const dateFrom = format(dateRange.from, 'yyyy-MM-dd');
  const dateTo = format(dateRange.to, 'yyyy-MM-dd');
  const orgId = group?.id;

  // Fetch KPIs
  const kpisQuery = useQuery({
    queryKey: ['labour-kpis', dateFrom, dateTo, locationId, dataSource],
    enabled: !appLoading && !!dataSource && !!orgId,
    queryFn: async (): Promise<LabourKpis> => {
      const ctx = buildQueryContext(orgId, [], dataSource);
      const range = { from: dateFrom, to: dateTo };
      const data = await getLabourKpisRpc(ctx, range, locationId);
      return sanitizeKpis(data);
    },
  });

  // Fetch timeseries for chart
  const timeseriesQuery = useQuery({
    queryKey: ['labour-timeseries', dateFrom, dateTo, locationId, dataSource],
    enabled: !appLoading && !!dataSource && !!orgId,
    queryFn: async (): Promise<LabourTimeseriesRow[]> => {
      const ctx = buildQueryContext(orgId, [], dataSource);
      const range = { from: dateFrom, to: dateTo };
      const data = await getLabourTimeseriesRpc(ctx, range, locationId);
      return data as unknown as LabourTimeseriesRow[];
    },
  });

  // Fetch locations table
  const locationsQuery = useQuery({
    queryKey: ['labour-locations', dateFrom, dateTo, locationId, dataSource],
    enabled: !appLoading && !!dataSource && !!orgId,
    queryFn: async (): Promise<LabourLocationRow[]> => {
      const ctx = buildQueryContext(orgId, [], dataSource);
      const range = { from: dateFrom, to: dateTo };
      const data = await getLabourLocationsRpc(ctx, range, locationId);
      return data as unknown as LabourLocationRow[];
    },
  });

  // Check if data is empty (for showing seed button)
  const isEmpty =
    !kpisQuery.isLoading &&
    kpisQuery.data &&
    kpisQuery.data.actual_sales === 0 &&
    kpisQuery.data.forecast_sales === 0;

  return {
    kpis: kpisQuery.data,
    timeseries: timeseriesQuery.data || [],
    locations: locationsQuery.data || [],
    isLoading: kpisQuery.isLoading || timeseriesQuery.isLoading || locationsQuery.isLoading,
    isError: kpisQuery.isError || timeseriesQuery.isError || locationsQuery.isError,
    error: kpisQuery.error || timeseriesQuery.error || locationsQuery.error,
    isEmpty,
    refetch: () => {
      kpisQuery.refetch();
      timeseriesQuery.refetch();
      locationsQuery.refetch();
    },
  };
}

