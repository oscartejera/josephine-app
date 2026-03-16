/**
 * ForecastAccuracyTrend — MAPE trend over last 90 days.
 * Shows how forecast accuracy has evolved over time.
 */

import { Card } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Area, ComposedChart } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { useTranslation } from 'react-i18next';

interface AccuracyPoint {
    date: string;
    label: string;
    mape: number;
    actual_sales: number;
    forecast_sales: number;
}

export function ForecastAccuracyTrend({ locationIds }: { locationIds: string[] }) {
  const { t } = useTranslation();
    const { data: points, isLoading } = useQuery({
        queryKey: ['accuracy-trend', locationIds],
        enabled: locationIds.length > 0,
        staleTime: 10 * 60 * 1000,
        queryFn: async (): Promise<AccuracyPoint[]> => {
            const from = format(subDays(new Date(), 90), 'yyyy-MM-dd');
            const to = format(new Date(), 'yyyy-MM-dd');

            // Two parallel queries: forecasts + actuals
            const [forecastRes, actualRes] = await Promise.all([
                supabase
                    .from('forecast_daily_metrics')
                    .select('date, forecast_sales')
                    .in('location_id', locationIds)
                    .gte('date', from)
                    .lte('date', to)
                    .order('date', { ascending: true }),
                supabase
                    .from('sales_daily_unified')
                    .select('date, net_sales')
                    .in('location_id', locationIds)
                    .gte('date', from)
                    .lte('date', to)
                    .order('date', { ascending: true }),
            ]);

            // Group forecasts by date
            const forecastByDate = new Map<string, number>();
            for (const row of (forecastRes.data || []) as any[]) {
                const k = row.date;
                forecastByDate.set(k, (forecastByDate.get(k) || 0) + (Number(row.forecast_sales) || 0));
            }

            // Group actuals by date
            const actualByDate = new Map<string, number>();
            for (const row of (actualRes.data || []) as any[]) {
                const k = row.date;
                actualByDate.set(k, (actualByDate.get(k) || 0) + (Number(row.net_sales) || 0));
            }

            // Join — only include dates that have BOTH forecast and actual
            const results: AccuracyPoint[] = [];
            for (const [date, actual] of actualByDate) {
                const forecast = forecastByDate.get(date);
                if (forecast && actual > 0) {
                    results.push({
                        date,
                        label: format(new Date(date), 'dd/MM'),
                        mape: Math.abs((actual - forecast) / actual) * 100,
                        actual_sales: actual,
                        forecast_sales: forecast,
                    });
                }
            }

            return results.sort((a, b) => a.date.localeCompare(b.date));
        },
    });

    if (isLoading) {
        return (
            <Card className="p-5 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-48 mb-4" />
                <div className="h-32 bg-gray-100 rounded" />
            </Card>
        );
    }

    if (!points || points.length < 5) return null;

    const avgMape = points.reduce((s, p) => s + p.mape, 0) / points.length;
    const latestMape = points[points.length - 1]?.mape ?? 0;
    const improving = points.length > 10
        ? points.slice(-10).reduce((s, p) => s + p.mape, 0) / 10 < points.slice(0, 10).reduce((s, p) => s + p.mape, 0) / 10
        : false;

    return (
        <Card className="p-5 bg-white">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-violet-500" />
                    <h3 className="text-sm font-semibold text-gray-700">Tendencia de Precisión</h3>
                    <span className="text-xs text-muted-foreground">(últimos 90 días)</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground">
                        MAPE medio: <strong className={avgMape <= 10 ? 'text-emerald-600' : avgMape <= 20 ? 'text-amber-600' : 'text-red-600'}>{avgMape.toFixed(1)}%</strong>
                    </span>
                    {improving && (
                        <span className="text-emerald-600 font-medium">↗ Mejorando</span>
                    )}
                </div>
            </div>

            <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={points}>
                        <XAxis
                            dataKey="label"
                            tick={{ fontSize: 10, fill: '#9ca3af' }}
                            axisLine={{ stroke: '#e5e7eb' }}
                            tickLine={false}
                            interval={Math.floor(points.length / 8)}
                        />
                        <YAxis
                            domain={[0, Math.min(Math.max(...points.map(p => p.mape)) * 1.2, 50)]}
                            tickFormatter={(v) => `${v.toFixed(0)}%`}
                            tick={{ fontSize: 10, fill: '#9ca3af' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const d = payload[0].payload as AccuracyPoint;
                                return (
                                    <div className="bg-white border rounded-lg shadow-xl p-3 text-sm">
                                        <p className="font-semibold mb-1">{d.date}</p>
                                        <p>MAPE: <strong className={d.mape <= 10 ? 'text-emerald-600' : 'text-amber-600'}>{d.mape.toFixed(1)}%</strong></p>
                                        <p className="text-xs text-muted-foreground">
                                            Actual: €{d.actual_sales.toLocaleString('es-ES', { maximumFractionDigits: 0 })} vs
                                            Forecast: €{d.forecast_sales.toLocaleString('es-ES', { maximumFractionDigits: 0 })}
                                        </p>
                                    </div>
                                );
                            }}
                        />
                        <ReferenceLine y={10} stroke="#10b981" strokeDasharray="3 3" label={{ value: '10% target', position: 'right', fill: '#10b981', fontSize: 10 }} />
                        <Area
                            type="monotone"
                            dataKey="mape"
                            fill="#c7d2fe"
                            fillOpacity={0.3}
                            stroke="none"
                        />
                        <Line
                            type="monotone"
                            dataKey="mape"
                            stroke="#6366f1"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, fill: '#6366f1' }}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
}
