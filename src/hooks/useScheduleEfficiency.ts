import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface EfficiencyInsight {
    type: 'low_splh' | 'over_budget' | 'excess_hours';
    severity: 'info' | 'warning' | 'critical';
    message: string;
    [key: string]: any;
}

export interface ScheduleEfficiency {
    splh: number;
    splh_goal: number;
    total_forecast_sales: number;
    total_scheduled_hours: number;
    total_scheduled_cost: number;
    target_labour_hours: number;
    target_cogs_pct: number;
    target_cost: number;
    over_budget: boolean;
    budget_variance_pct: number;
    insights: EfficiencyInsight[];
}

export function useScheduleEfficiency(
    locationId: string | null,
    weekStart: Date,
    weekEnd: Date,
    enabled: boolean = true
) {
    return useQuery({
        queryKey: ['schedule-efficiency', locationId, format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd')],
        queryFn: async (): Promise<ScheduleEfficiency | null> => {
            if (!locationId) return null;
            const { data, error } = await (supabase.rpc as any)('calculate_schedule_efficiency', {
                p_location_id: locationId,
                p_week_start: format(weekStart, 'yyyy-MM-dd'),
                p_week_end: format(weekEnd, 'yyyy-MM-dd'),
            });
            if (error) {
                console.warn('[useScheduleEfficiency] RPC error:', error);
                return null;
            }
            return data as ScheduleEfficiency;
        },
        enabled: !!locationId && enabled,
        staleTime: 30 * 1000, // Refresh every 30s
        refetchOnWindowFocus: true,
    });
}
