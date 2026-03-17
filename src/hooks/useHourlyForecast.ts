/**
 * useHourlyForecast — calls get_hourly_forecast() RPC.
 *
 * Returns hourly sales decomposition for a specific date.
 * Data comes from DOW × hour mix applied to the daily forecast.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CACHE } from '@/data/cache-config';
import { format } from 'date-fns';

// ── Types ─────────────────────────────────────────────────────

export interface HourlyForecastRow {
    hour: number;
    forecast_sales: number;
    mix_pct: number;
    is_peak: boolean;
}

// ── Hook ──────────────────────────────────────────────────────

interface UseHourlyForecastParams {
    locationId: string | undefined;
    date: Date;
    enabled?: boolean;
}

export function useHourlyForecast({
    locationId,
    date,
    enabled = true,
}: UseHourlyForecastParams) {
    const dateStr = format(date, 'yyyy-MM-dd');

    return useQuery({
        queryKey: ['hourly-forecast', locationId, dateStr],
        queryFn: async (): Promise<HourlyForecastRow[]> => {
            type RpcFn = (
                name: string,
                params: Record<string, unknown>,
            ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
            const rpc: RpcFn = supabase.rpc as unknown as RpcFn;

            const { data, error } = await rpc('get_hourly_forecast', {
                p_location_id: locationId,
                p_date: dateStr,
            });

            if (error) throw error;
            return (data || []) as HourlyForecastRow[];
        },
        enabled: enabled && !!locationId,
        ...CACHE.COMPUTED,
    });
}
