/**
 * useSalesTimeseries — thin wrapper for get_sales_timeseries_unified RPC
 * via data layer.
 *
 * Returns hourly, daily, kpis, busy_hours — all resolved server-side
 * (data source is determined by the RPC via resolve_data_source).
 */

import { useQuery } from '@tanstack/react-query';
import { buildQueryContext, getSalesTimeseriesRpc, type SalesTimeseriesRpcResult } from '@/data';
import { format } from 'date-fns';

// Re-export sub-types from data layer for backward compatibility
export type SalesTimeseriesResult = SalesTimeseriesRpcResult;

export interface TimeseriesHourly {
  ts_hour: string;
  actual_sales: number;
  actual_orders: number;
  forecast_sales: number;
  forecast_orders: number;
  lower: number;
  upper: number;
}

export interface TimeseriesDaily {
  date: string;
  actual_sales: number;
  actual_orders: number;
  forecast_sales: number;
  forecast_orders: number;
  lower: number;
  upper: number;
}

export interface TimeseriesKPIs {
  actual_sales: number;
  forecast_sales: number;
  actual_orders: number;
  forecast_orders: number;
  avg_check_actual: number;
  avg_check_forecast: number;
}

export interface BusyHour {
  date: string;
  hour: number;
  forecast_sales: number;
}

// ── Hook params ───────────────────────────────────────────────

interface UseSalesTimeseriesParams {
  orgId: string | undefined;
  locationIds: string[];
  from: Date;
  to: Date;
  enabled?: boolean;
}

// ── Hook ──────────────────────────────────────────────────────

export function useSalesTimeseries({
  orgId,
  locationIds,
  from,
  to,
  enabled = true,
}: UseSalesTimeseriesParams) {
  return useQuery({
    queryKey: [
      'sales-timeseries-unified',
      orgId,
      locationIds,
      format(from, 'yyyy-MM-dd'),
      format(to, 'yyyy-MM-dd'),
    ],
    queryFn: async (): Promise<SalesTimeseriesResult> => {
      const ctx = buildQueryContext(orgId, locationIds, 'pos');
      const range = {
        from: format(from, 'yyyy-MM-dd'),
        to: format(to, 'yyyy-MM-dd'),
      };

      const result = await getSalesTimeseriesRpc(ctx, range);
      return result as SalesTimeseriesResult;
    },
    enabled: enabled && !!orgId && locationIds.length > 0,
    staleTime: 30_000,
  });
}
