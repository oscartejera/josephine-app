/**
 * useLaborPlanUnified — Workforce planning via RPC.
 *
 * Calls get_labor_plan_unified() which:
 *  1. Resolves data source (demo/pos)
 *  2. Reads forecast_hourly_metrics
 *  3. Computes planned hours via SPLH goal
 *  4. Splits FOH/BOH and costs
 *
 * Returns metadata, hourly array, daily array, and flags.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface LaborPlanMetadata {
  data_source: 'pos' | 'demo';
  mode: 'auto' | 'manual';
  reason: string;
  last_synced_at: string | null;
  splh_goal: number;
  target_col_pct: number;
  hourly_rate_foh: number;
  hourly_rate_boh: number;
}

export interface LaborPlanHourly {
  ts_hour: string;
  forecast_sales: number;
  planned_hours_total: number;
  planned_hours_foh: number;
  planned_hours_boh: number;
  planned_cost: number;
}

export interface LaborPlanDaily {
  date: string;
  forecast_sales: number;
  planned_hours_total: number;
  planned_hours_foh: number;
  planned_hours_boh: number;
  planned_cost: number;
  splh: number;
  col_pct: number;
  understaff_risk: boolean;
}

export interface LaborPlanFlags {
  estimated_rates: boolean;
  data_quality: {
    total_days: number;
    data_sufficiency_level: 'LOW' | 'MID' | 'HIGH';
  };
}

export interface LaborPlanData {
  metadata: LaborPlanMetadata;
  hourly: LaborPlanHourly[];
  daily: LaborPlanDaily[];
  flags: LaborPlanFlags;
}

export function useLaborPlanUnified(
  locationIds: string[],
  from: string,
  to: string,
) {
  const { profile } = useAuth();
  const orgId = profile?.group_id;

  return useQuery<LaborPlanData | null>({
    queryKey: ['labor-plan-unified', orgId, locationIds, from, to],
    queryFn: async () => {
      if (!orgId || locationIds.length === 0) return null;

      const { data, error } = await supabase.rpc('get_labor_plan_unified', {
        p_org_id: orgId,
        p_location_ids: locationIds,
        p_from: from,
        p_to: to,
      });

      if (error) {
        console.error('get_labor_plan_unified error:', error.message);
        return null;
      }

      return data as unknown as LaborPlanData;
    },
    enabled: !!orgId && locationIds.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
