/**
 * StaffingHeatmap — Sales vs Staff by day of week
 *
 * Visual heatmap showing each day's staffing efficiency.
 * Highlights overstaffed/understaffed days with color codes
 * and estimated monthly savings from optimization.
 * Calls get_staffing_heatmap RPC.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface StaffingHeatmapProps {
    locationId?: string | null;
}

interface DayData {
    day_of_week: number;
    day_name: string;
    avg_daily_sales: number;
    avg_staff_count: number;
    avg_daily_splh: number;
    status: 'optimal' | 'overstaffed' | 'understaffed' | 'no_data';
}

interface HeatmapData {
    target_splh: number;
    operating_hours: { open: number; close: number };
    days: DayData[];
    summary: {
        overstaffed_days: number;
        understaffed_days: number;
        optimal_days: number;
        potential_savings: number;
    };
}

function fmt(v: number) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string; bar: string; emoji: string }> = {
    optimal: { label: 'Óptimo', bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-400', emoji: '✓' },
    overstaffed: { label: 'Exceso', bg: 'bg-blue-50', text: 'text-blue-700', bar: 'bg-blue-400', emoji: '⬆' },
    understaffed: { label: 'Falta', bg: 'bg-amber-50', text: 'text-amber-700', bar: 'bg-amber-400', emoji: '⬇' },
    no_data: { label: 'Sin datos', bg: 'bg-gray-50', text: 'text-gray-400', bar: 'bg-gray-200', emoji: '—' },
};

export function StaffingHeatmap({ locationId }: StaffingHeatmapProps) {
  const { t } = useTranslation();
    const { profile } = useAuth();
    const { accessibleLocations } = useApp();
    const orgId = profile?.group_id;
    const effectiveLocationId = locationId || (accessibleLocations.length > 0 ? accessibleLocations[0].id : null);

    const { data, isLoading } = useQuery({
        queryKey: ['staffing-heatmap', orgId, effectiveLocationId],
        queryFn: async (): Promise<HeatmapData | null> => {
            if (!effectiveLocationId) return null;

            // Try RPC first, fallback to client-side computation
            try {
                if (orgId) {
                    const { data: rpcData, error } = await supabase.rpc('get_staffing_heatmap' as any, {
                        p_org_id: orgId,
                        p_location_id: effectiveLocationId,
                        p_weeks_back: 4,
                    });
                    if (!error && rpcData) return rpcData as HeatmapData;
                }
            } catch { /* RPC not available, use fallback */ }

            // Client-side fallback: compute from planned_shifts + sales
            const fourWeeksAgo = new Date();
            fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
            const today = new Date();
            const fmt = (d: Date) => d.toISOString().split('T')[0];

            const [shiftsRes, salesRes] = await Promise.all([
                supabase.from('planned_shifts')
                    .select('shift_date, planned_hours')
                    .eq('location_id', effectiveLocationId)
                    .gte('shift_date', fmt(fourWeeksAgo))
                    .lte('shift_date', fmt(today)),
                supabase.from('sales_daily_unified')
                    .select('date, net_sales')
                    .eq('location_id', effectiveLocationId)
                    .gte('date', fmt(fourWeeksAgo))
                    .lte('date', fmt(today)),
            ]);

            const shifts = shiftsRes.data || [];
            const sales = salesRes.data || [];
            if (shifts.length === 0 && sales.length === 0) return null;

            // Aggregate by day-of-week (0=Sun, 1=Mon, ... 6=Sat)
            const TARGET_SPLH = 150;
            const OP_HOURS = { open: 10, close: 23 };
            const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            const buckets: Record<number, { totalSales: number; totalHours: number; count: number }> = {};

            // Build sales by date
            const salesByDate: Record<string, number> = {};
            sales.forEach((s: any) => { salesByDate[s.date] = (salesByDate[s.date] || 0) + Number(s.net_sales || 0); });

            // Build hours by date
            const hoursByDate: Record<string, number> = {};
            shifts.forEach((s: any) => { hoursByDate[s.shift_date] = (hoursByDate[s.shift_date] || 0) + Number(s.planned_hours || 0); });

            // Combine
            const allDates = new Set([...Object.keys(salesByDate), ...Object.keys(hoursByDate)]);
            allDates.forEach(dateStr => {
                const dow = new Date(dateStr).getDay();
                if (!buckets[dow]) buckets[dow] = { totalSales: 0, totalHours: 0, count: 0 };
                buckets[dow].totalSales += salesByDate[dateStr] || 0;
                buckets[dow].totalHours += hoursByDate[dateStr] || 0;
                buckets[dow].count += 1;
            });

            const days: DayData[] = Object.entries(buckets).map(([dow, b]) => {
                const dayNum = Number(dow);
                const avgSales = b.count > 0 ? b.totalSales / b.count : 0;
                const avgHours = b.count > 0 ? b.totalHours / b.count : 0;
                const avgStaff = avgHours / (OP_HOURS.close - OP_HOURS.open || 1);
                const splh = avgHours > 0 ? Math.round(avgSales / avgHours) : 0;
                const status: DayData['status'] = avgHours === 0 ? 'no_data'
                    : splh > TARGET_SPLH * 1.2 ? 'understaffed'
                        : splh < TARGET_SPLH * 0.8 ? 'overstaffed'
                            : 'optimal';
                return {
                    day_of_week: dayNum,
                    day_name: dayNames[dayNum],
                    avg_daily_sales: Math.round(avgSales),
                    avg_staff_count: Math.round(avgStaff * 10) / 10,
                    avg_daily_splh: splh,
                    status,
                };
            });

            const summary = {
                overstaffed_days: days.filter(d => d.status === 'overstaffed').length,
                understaffed_days: days.filter(d => d.status === 'understaffed').length,
                optimal_days: days.filter(d => d.status === 'optimal').length,
                potential_savings: days.filter(d => d.status === 'overstaffed')
                    .reduce((s, d) => s + d.avg_daily_sales * 0.03, 0) * 4,
            };

            return { target_splh: TARGET_SPLH, operating_hours: OP_HOURS, days, summary };
        },
        enabled: !!effectiveLocationId,
        staleTime: 120000,
    });

    if (!effectiveLocationId) {
        return (
            <Card className="bg-white">
                <CardHeader><CardTitle className="text-base">🔥 Mapa de Staffing</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-gray-500 text-center py-4">Selecciona una ubicación</p></CardContent>
            </Card>
        );
    }

    if (isLoading) {
        return (
            <Card className="bg-white">
                <CardHeader><CardTitle className="text-base">🔥 Mapa de Staffing</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid grid-cols-7 gap-2">
                        {[1, 2, 3, 4, 5, 6, 7].map(i => <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />)}
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!data || data.days.length === 0) {
        return (
            <Card className="bg-white">
                <CardHeader><CardTitle className="text-base">🔥 Mapa de Staffing</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-gray-500 text-center py-4">{t("labour.insufficientData")}</p></CardContent>
            </Card>
        );
    }

    // Sort days: Mon(1), Tue(2), ..., Sun(0)
    const orderedDays = [...data.days].sort((a, b) => {
        const aIdx = a.day_of_week === 0 ? 7 : a.day_of_week;
        const bIdx = b.day_of_week === 0 ? 7 : b.day_of_week;
        return aIdx - bIdx;
    });

    const maxSales = Math.max(...orderedDays.map(d => d.avg_daily_sales), 1);

    return (
        <Card className="bg-white">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base font-semibold">🔥 Mapa de Staffing</CardTitle>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Análisis de las últimas 4 semanas • SPLH objetivo: €{data.target_splh}
                        </p>
                    </div>
                    {data.summary.potential_savings > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            💰 Ahorro potencial: {fmt(data.summary.potential_savings)}/mes
                        </span>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Summary chips */}
                <div className="flex gap-2">
                    {data.summary.optimal_days > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            ✓ {data.summary.optimal_days} óptimos
                        </span>
                    )}
                    {data.summary.overstaffed_days > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            ⬆ {data.summary.overstaffed_days} con exceso
                        </span>
                    )}
                    {data.summary.understaffed_days > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            ⬇ {data.summary.understaffed_days} con falta
                        </span>
                    )}
                </div>

                {/* Day cards */}
                <div className="grid grid-cols-7 gap-2">
                    {orderedDays.map(day => {
                        const style = STATUS_STYLES[day.status] || STATUS_STYLES.no_data;
                        const salesPct = maxSales > 0 ? (day.avg_daily_sales / maxSales) * 100 : 0;

                        return (
                            <div key={day.day_of_week} className={cn(
                                "rounded-xl p-3 text-center transition-all hover:shadow-md border",
                                style.bg,
                                day.status === 'overstaffed' ? 'border-blue-200' :
                                    day.status === 'understaffed' ? 'border-amber-200' :
                                        day.status === 'optimal' ? 'border-emerald-200' :
                                            'border-gray-100'
                            )}>
                                {/* Day name */}
                                <div className={cn("text-xs font-bold", style.text)}>
                                    {day.day_name.substring(0, 3)}
                                </div>

                                {/* Sales bar */}
                                <div className="mt-2 h-16 flex items-end justify-center">
                                    <div
                                        className={cn("w-6 rounded-t transition-all", style.bar)}
                                        style={{ height: `${Math.max(salesPct, 8)}%` }}
                                    />
                                </div>

                                {/* Metrics */}
                                <div className="mt-2 space-y-0.5">
                                    <div className="text-xs font-bold text-gray-800">{fmt(day.avg_daily_sales)}</div>
                                    <div className="text-[10px] text-gray-500">
                                        {day.avg_staff_count.toFixed(1)} personas
                                    </div>
                                    <div className={cn("text-[10px] font-bold", style.text)}>
                                        €{day.avg_daily_splh} SPLH
                                    </div>
                                </div>

                                {/* Status badge */}
                                <div className={cn(
                                    "mt-2 text-[9px] font-bold rounded-full py-0.5",
                                    style.bg, style.text
                                )}>
                                    {style.emoji} {style.label}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Recommendations */}
                {(data.summary.overstaffed_days > 0 || data.summary.understaffed_days > 0) && (
                    <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-200/50">
                        <div className="text-xs font-semibold text-indigo-700 mb-1">💡 Recomendaciones</div>
                        <ul className="space-y-1">
                            {orderedDays.filter(d => d.status === 'overstaffed').map(d => (
                                <li key={d.day_of_week} className="text-[11px] text-indigo-600">
                                    <strong>{d.day_name}:</strong> Reduce {Math.max(1, Math.round(d.avg_staff_count - d.avg_daily_sales / (data.target_splh * (data.operating_hours.close - data.operating_hours.open))))} persona(s) — SPLH actual €{d.avg_daily_splh} (objetivo €{data.target_splh})
                                </li>
                            ))}
                            {orderedDays.filter(d => d.status === 'understaffed').map(d => (
                                <li key={d.day_of_week} className="text-[11px] text-amber-600">
                                    <strong>{d.day_name}:</strong> Añade {Math.max(1, Math.round(d.avg_daily_sales / (data.target_splh * (data.operating_hours.close - data.operating_hours.open)) - d.avg_staff_count))} persona(s) — SPLH actual €{d.avg_daily_splh} (objetivo €{data.target_splh})
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Footer */}
                <div className="text-[10px] text-gray-400">
                    Basado en ventas promedio y personal programado de las últimas 4 semanas
                </div>
            </CardContent>
        </Card>
    );
}
