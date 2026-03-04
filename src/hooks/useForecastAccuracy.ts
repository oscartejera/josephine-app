/**
 * useForecastAccuracy — reads v_forecast_accuracy view.
 *
 * Returns MAPE, bias, hit rates for each location/model.
 * Data updates daily (backfill_forecast_accuracy runs nightly).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CACHE } from '@/data/cache-config';

// ── Types ─────────────────────────────────────────────────────

export interface ForecastAccuracyRow {
    location_id: string;
    model_name: string;
    days_evaluated: number;
    days_pending: number;
    mape: number | null;
    bias_eur: number | null;
    hit_rate_10pct: number | null;
    hit_rate_5pct: number | null;
    first_date: string | null;
    last_date: string | null;
}

// ── Hook ──────────────────────────────────────────────────────

interface UseForecastAccuracyParams {
    locationIds: string[];
    enabled?: boolean;
}

export function useForecastAccuracy({
    locationIds,
    enabled = true,
}: UseForecastAccuracyParams) {
    return useQuery({
        queryKey: ['forecast-accuracy', locationIds],
        queryFn: async (): Promise<ForecastAccuracyRow[]> => {
            const { data, error } = await supabase
                .from('v_forecast_accuracy' as any)
                .select('*')
                .in('location_id', locationIds);

            if (error) throw error;
            return (data || []) as unknown as ForecastAccuracyRow[];
        },
        enabled: enabled && locationIds.length > 0,
        ...CACHE.ANALYTICS,
    });
}

// ── Trigger backfill (call from admin/cron) ───────────────────

export async function triggerBackfillForecastAccuracy(): Promise<{
    predictions_logged: number;
    actuals_backfilled: number;
}> {
    const { data, error } = await (supabase.rpc as any)(
        'backfill_forecast_accuracy',
        {},
    );

    if (error) throw error;
    return data;
}
