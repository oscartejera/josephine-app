/**
 * useForecastItemsMix — thin wrapper for get_forecast_items_mix_unified RPC.
 *
 * Returns per-product forecast using DOW-based mix shares,
 * resolved server-side.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveDataSource } from '@/hooks/useEffectiveDataSource';
import { format } from 'date-fns';

// ── Response types ────────────────────────────────────────────

export interface ForecastItemDaily {
  date: string;
  forecast_sales: number;
  forecast_qty: number | null;
}

export interface ForecastMixItem {
  product_id: string;
  name: string;
  category: string;
  total_forecast_sales: number;
  total_forecast_qty: number | null;
  avg_unit_price: number;
  daily: ForecastItemDaily[];
}

export interface ForecastItemsMixResult {
  data_source: string;
  mode: string;
  reason: string;
  last_synced_at: string | null;
  hist_window: { from: string; to: string };
  horizon: { from: string; to: string };
  items: ForecastMixItem[];
}

// ── Hook params ───────────────────────────────────────────────

interface UseForecastItemsMixParams {
  orgId: string | undefined;
  locationIds: string[];
  from: Date;
  to: Date;
  horizonDays?: number;
  limit?: number;
  enabled?: boolean;
}

// ── Hook ──────────────────────────────────────────────────────

export function useForecastItemsMix({
  orgId,
  locationIds,
  from,
  to,
  horizonDays = 14,
  limit = 50,
  enabled = true,
}: UseForecastItemsMixParams) {
  const { dsUnified } = useEffectiveDataSource();

  return useQuery({
    queryKey: [
      'forecast-items-mix-unified',
      orgId,
      locationIds,
      format(from, 'yyyy-MM-dd'),
      format(to, 'yyyy-MM-dd'),
      horizonDays,
      limit,
      dsUnified,
    ],
    queryFn: async (): Promise<ForecastItemsMixResult> => {
      // RPC not yet in auto-generated types
      type RpcFn = (name: string, params: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
      const rpc: RpcFn = supabase.rpc as unknown as RpcFn;
      const { data, error } = await rpc(
        'get_forecast_items_mix_unified',
        {
          p_org_id: orgId,
          p_location_ids: locationIds,
          p_from: format(from, 'yyyy-MM-dd'),
          p_to: format(to, 'yyyy-MM-dd'),
          p_horizon_days: horizonDays,
          p_limit: limit,
        },
      );

      if (error) throw error;
      return data as ForecastItemsMixResult;
    },
    enabled: enabled && !!orgId && locationIds.length > 0,
    staleTime: 120_000,
  });
}
