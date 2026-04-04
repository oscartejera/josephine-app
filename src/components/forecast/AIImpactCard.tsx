/**
 * AIImpactCard — "Josephine AI Impact" ROI Dashboard
 * 
 * Shows the cumulative value created by Josephine's AI:
 * - Labour savings (actual COL% vs industry benchmark)
 * - Waste savings (actual waste% vs industry benchmark)
 * - Forecast accuracy (MAPE)
 * - Admin time saved (estimated from auto-scheduled shifts)
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { startOfMonth, format, subMonths } from 'date-fns';
import { Sparkles, TrendingDown, Clock, Target, ShieldCheck } from 'lucide-react';

const INDUSTRY_COL_BENCHMARK = 30;     // Industry avg COL% without AI
const INDUSTRY_WASTE_BENCHMARK = 5;    // Industry avg waste% without AI
const ADMIN_HOURS_SAVED_PER_SHIFT = 0.15; // ~9 min saved per auto-generated shift

interface ImpactMetrics {
    labourSavings: number;
    wasteSavings: number;
    mape: number | null;
    adminHoursSaved: number;
    totalSales: number;
    actualCol: number;
    actualWaste: number;
}

function useAIImpactData(): { data: ImpactMetrics | null; isLoading: boolean } {
    const { locations } = useApp();
    const { session } = useAuth();
    const locationIds = locations.map(l => l.id);

    return useQuery({
        queryKey: ['ai-impact', locationIds],
        enabled: locationIds.length > 0 && !!session,
        staleTime: 5 * 60 * 1000,
        queryFn: async (): Promise<ImpactMetrics> => {
            const now = new Date();
            const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
            const today = format(now, 'yyyy-MM-dd');
            const prevMonthStart = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');

            // Parallel queries — use direct table queries for demo compatibility
            const [salesRes, wasteRes, accuracyRes, shiftsRes] = await Promise.all([
                // MTD sales + labour from sales_daily_unified (direct table query)
                supabase
                    .from('sales_daily_unified')
                    .select('net_sales, labor_cost')
                    .in('location_id', locationIds)
                    .gte('date', monthStart)
                    .lte('date', today),
                // MTD waste
                supabase
                    .from('waste_events')
                    .select('waste_value')
                    .in('location_id', locationIds)
                    .gte('created_at', monthStart)
                    .lte('created_at', today + 'T23:59:59'),
                // Forecast accuracy
                supabase
                    .from('v_forecast_accuracy')
                    .select('mape, days_evaluated')
                    .in('location_id', locationIds)
                    .limit(5),
                // Auto-generated shifts count
                supabase
                    .from('planned_shifts')
                    .select('id', { count: 'exact', head: true })
                    .in('location_id', locationIds)
                    .gte('shift_date', prevMonthStart),
            ]);

            // Sum sales and labour from daily unified
            const salesRows = (salesRes.data || []) as any[];
            const totalSales = salesRows.reduce((s: number, r: any) => s + (Number(r.net_sales) || 0), 0);
            const labourCost = salesRows.reduce((s: number, r: any) => s + (Number(r.labor_cost) || 0), 0);
            const actualCol = totalSales > 0 ? (labourCost / totalSales) * 100 : 0;

            const totalWaste = (wasteRes.data || []).reduce(
                (sum: number, w: any) => sum + (Number(w.waste_value) || 0), 0
            );
            const actualWaste = totalSales > 0 ? (totalWaste / totalSales) * 100 : 0;

            // Aggregate MAPE
            const accuracyRows = (accuracyRes.data || []) as any[];
            let mape: number | null = null;
            if (accuracyRows.length > 0) {
                const totalDays = accuracyRows.reduce((s: number, r: any) => s + (r.days_evaluated || 0), 0);
                if (totalDays > 0) {
                    mape = accuracyRows.reduce((s: number, r: any) => s + (r.mape || 0) * (r.days_evaluated || 0), 0) / totalDays;
                }
            }

            const shiftsCount = shiftsRes.count || 0;
            const adminHoursSaved = shiftsCount * ADMIN_HOURS_SAVED_PER_SHIFT;

            const labourSavings = totalSales > 0
                ? ((INDUSTRY_COL_BENCHMARK - actualCol) / 100) * totalSales
                : 0;
            const wasteSavings = totalSales > 0
                ? ((INDUSTRY_WASTE_BENCHMARK - actualWaste) / 100) * totalSales
                : 0;

            return {
                labourSavings: Math.max(labourSavings, 0),
                wasteSavings: Math.max(wasteSavings, 0),
                mape,
                adminHoursSaved: Math.round(adminHoursSaved),
                totalSales,
                actualCol,
                actualWaste,
            };
        },
    });
}

function ImpactKPI({
    icon: Icon,
    label,
    value,
    subtitle,
    color,
}: {
    icon: typeof Sparkles;
    label: string;
    value: string;
    subtitle: string;
    color: string;
}) {
    return (
        <div className="flex items-start gap-3">
            <div className={`flex items-center justify-center h-9 w-9 rounded-lg ${color}`}>
                <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{label}</p>
                <p className="text-lg font-semibold leading-none mt-0.5">{value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>
            </div>
        </div>
    );
}

export function AIImpactCard() {
    const { data, isLoading } = useAIImpactData();

    if (isLoading) {
        return (
            <Card className="border-border">
                <CardHeader className="pb-2">
                    <Skeleton className="h-5 w-52" />
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <Skeleton key={i} className="h-16" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!data || data.totalSales === 0) {
        return null; // Don't show if no data
    }

    const fmt = (v: number) => `€${Math.abs(v).toLocaleString('es-ES', { maximumFractionDigits: 0 })}`;
    const totalSavings = data.labourSavings + data.wasteSavings;

    return (
        <Card className="border-border bg-gradient-to-br from-violet-500/5 via-transparent to-indigo-500/5">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-violet-500" />
                    Josephine AI Impact
                    <span className="text-xs font-normal text-muted-foreground">— este mes</span>
                </CardTitle>
                {totalSavings > 0 && (
                    <p className="text-xs text-emerald-600 font-medium">
                        Ahorro total estimado: {fmt(totalSavings)}
                    </p>
                )}
            </CardHeader>
            <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-4">
                    <ImpactKPI
                        icon={TrendingDown}
                        label="Ahorro Laboral"
                        value={data.labourSavings > 0 ? `+${fmt(data.labourSavings)}` : '—'}
                        subtitle={`COL ${(data.actualCol ?? 0).toFixed(1)}% vs ${INDUSTRY_COL_BENCHMARK}% benchmark`}
                        color="bg-emerald-50 text-emerald-600"
                    />
                    <ImpactKPI
                        icon={ShieldCheck}
                        label="Ahorro Merma"
                        value={data.wasteSavings > 0 ? `+${fmt(data.wasteSavings)}` : '—'}
                        subtitle={`Waste ${(data.actualWaste ?? 0).toFixed(1)}% vs ${INDUSTRY_WASTE_BENCHMARK}% benchmark`}
                        color="bg-blue-50 text-blue-600"
                    />
                    <ImpactKPI
                        icon={Target}
                        label="Precisión Forecast"
                        value={data.mape !== null ? `${(100 - data.mape).toFixed(0)}%` : 'Sin datos'}
                        subtitle={data.mape !== null ? `MAPE: ${data.mape.toFixed(1)}%` : 'Ejecuta backfill_forecast_accuracy()'}
                        color="bg-violet-50 text-violet-600"
                    />
                    <ImpactKPI
                        icon={Clock}
                        label="Admin Ahorrado"
                        value={data.adminHoursSaved > 0 ? `${data.adminHoursSaved}h` : '—'}
                        subtitle="Horas ahorradas en scheduling"
                        color="bg-amber-50 text-amber-600"
                    />
                </div>
            </CardContent>
        </Card>
    );
}
