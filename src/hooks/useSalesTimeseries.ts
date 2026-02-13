/**
 * useSalesTimeseries — thin wrapper for get_sales_timeseries_unified RPC.
 *
 * Returns hourly, daily, kpis, busy_hours — all resolved server-side
 * (data source is determined by the RPC via resolve_data_source).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveDataSource } from '@/hooks/useEffectiveDataSource';
import { format } from 'date-fns';

// ── Response types ────────────────────────────────────────────

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

export interface SalesTimeseriesResult {
  data_source: string;
  mode: string;
  reason: string;
  last_synced_at: string | null;
  hourly: TimeseriesHourly[];
  daily: TimeseriesDaily[];
  kpis: TimeseriesKPIs;
  busy_hours: BusyHour[];
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
  const { dsUnified } = useEffectiveDataSource();

  return useQuery({
    queryKey: [
      'sales-timeseries-unified',
      orgId,
      locationIds,
      format(from, 'yyyy-MM-dd'),
      format(to, 'yyyy-MM-dd'),
      dsUnified,
    ],
    queryFn: async (): Promise<SalesTimeseriesResult> => {
      // RPC not yet in auto-generated types
      type RpcFn = (name: string, params: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
      const rpc: RpcFn = supabase.rpc as unknown as RpcFn;
      const { data, error } = await rpc(
        'get_sales_timeseries_unified',
        {
          p_org_id: orgId,
          p_location_ids: locationIds,
          p_from: format(from, 'yyyy-MM-dd'),
          p_to: format(to, 'yyyy-MM-dd'),
        },
      );

      if (error) throw error;
      return data as SalesTimeseriesResult;
    },
    enabled: enabled && !!orgId && locationIds.length > 0,
    staleTime: 30_000,
  });
}
