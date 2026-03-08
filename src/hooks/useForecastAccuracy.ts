/**
 * useForecastAccuracy — reads v_forecast_accuracy view.
 *
 * Returns MAPE, bias, hit rates for each location/model.
 * Falls back to client-side computation if the view returns stale data.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CACHE } from '@/data/cache-config';
import { subDays, format } from 'date-fns';

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
            // Client-side computation: MAPE from forecast_daily_metrics + sales_daily_unified
            // (v_forecast_accuracy view is unreliable — backfill doesn't recalculate correctly)
            const endDate = format(new Date(), 'yyyy-MM-dd');
            const startDate = format(subDays(new Date(), 90), 'yyyy-MM-dd');

            const [forecastRes, salesRes] = await Promise.all([
                supabase
                    .from('forecast_daily_metrics')
                    .select('date, location_id, forecast_sales')
                    .in('location_id', locationIds)
                    .gte('date', startDate)
                    .lte('date', endDate),
                supabase
                    .from('sales_daily_unified')
                    .select('date, location_id, net_sales')
                    .in('location_id', locationIds)
                    .gte('date', startDate)
                    .lte('date', endDate),
            ]);

            const forecasts = forecastRes.data || [];
            const sales = salesRes.data || [];

            if (forecasts.length === 0) return [];

            // Build SUM'd sales lookup
            const salesMap = new Map<string, number>();
            sales.forEach((s: any) => {
                const k = `${s.date}|${s.location_id}`;
                salesMap.set(k, (salesMap.get(k) || 0) + Number(s.net_sales || 0));
            });

            // Aggregate by location
            const locStats: Record<string, {
                totalAPE: number; totalBias: number; matched: number; pending: number;
                within10: number; within5: number; minDate: string; maxDate: string;
            }> = {};

            forecasts.forEach((f: any) => {
                const lid = f.location_id;
                if (!locStats[lid]) locStats[lid] = { totalAPE: 0, totalBias: 0, matched: 0, pending: 0, within10: 0, within5: 0, minDate: f.date, maxDate: f.date };
                const stats = locStats[lid];
                const k = `${f.date}|${lid}`;
                const actual = salesMap.get(k);

                if (!actual || actual <= 0) {
                    stats.pending++;
                    return;
                }

                const ape = Math.abs(f.forecast_sales - actual) / actual * 100;
                const bias = f.forecast_sales - actual;
                stats.totalAPE += ape;
                stats.totalBias += bias;
                stats.matched++;
                if (ape <= 10) stats.within10++;
                if (ape <= 5) stats.within5++;
                if (f.date < stats.minDate) stats.minDate = f.date;
                if (f.date > stats.maxDate) stats.maxDate = f.date;
            });

            return Object.entries(locStats).map(([lid, s]) => ({
                location_id: lid,
                model_name: 'ensemble_v6',
                days_evaluated: s.matched,
                days_pending: s.pending,
                mape: s.matched > 0 ? Math.round((s.totalAPE / s.matched) * 10) / 10 : null,
                bias_eur: s.matched > 0 ? Math.round(s.totalBias / s.matched) : null,
                hit_rate_10pct: s.matched > 0 ? Math.round((s.within10 / s.matched) * 1000) / 10 : null,
                hit_rate_5pct: s.matched > 0 ? Math.round((s.within5 / s.matched) * 1000) / 10 : null,
                first_date: s.minDate,
                last_date: s.maxDate,
            }));
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
