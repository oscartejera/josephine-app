/**
 * HourlyForecastChart — Hourly sales forecast bar chart.
 *
 * Shows hourly decomposition of daily forecast with peak hour highlighting.
 * Uses the get_hourly_forecast() RPC via useHourlyForecast hook.
 */

import { Card } from '@/components/ui/card';
import { useHourlyForecast, type HourlyForecastRow } from '@/hooks/useHourlyForecast';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// ── Colors ───────────────────────────────────────────────────

const COLOR_NORMAL = '#c7d2fe';    // indigo-200
const COLOR_PEAK = '#6366f1';      // indigo-500
const COLOR_SUPER_PEAK = '#4338ca'; // indigo-700

// ── Component ────────────────────────────────────────────────

interface HourlyForecastChartProps {
    locationId: string | undefined;
    date: Date;
}

export function HourlyForecastChart({ locationId, date }: HourlyForecastChartProps) {
  const { t } = useTranslation();
    const { data: rows, isLoading } = useHourlyForecast({ locationId, date });

    if (isLoading) {
        return (
            <Card className="p-5 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-48 mb-4" />
                <div className="h-48 bg-gray-100 rounded" />
            </Card>
        );
    }

    if (!rows || rows.length === 0) {
        return (
            <Card className="p-5">
                <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-gray-700">{t('forecast.forecastPorHora')}</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                    No hay datos horarios disponibles para esta fecha.
                </p>
            </Card>
        );
    }

    // Calculate peak info
    const peakHours = rows.filter((r) => r.is_peak);
    const peakSales = peakHours.reduce((sum, r) => sum + r.forecast_sales, 0);
    const totalSales = rows.reduce((sum, r) => sum + r.forecast_sales, 0);
    const peakPct = totalSales > 0 ? (peakSales / totalSales * 100).toFixed(0) : '0';
    const maxSales = Math.max(...rows.map((r) => r.forecast_sales));

    const chartData = rows.map((r) => ({
        hour: `${r.hour}:00`,
        sales: r.forecast_sales,
        mix: r.mix_pct,
        isPeak: r.is_peak,
        isSuperPeak: r.forecast_sales >= maxSales * 0.9,
    }));

    return (
        <Card className="p-5 bg-white">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-indigo-500" />
                    <h3 className="text-sm font-semibold text-gray-700">{t('forecast.forecastPorHora')}</h3>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLOR_PEAK }} />
                        Hora punta ({peakPct}% del total)
                    </span>
                    <span>
                        Total: €{totalSales.toLocaleString('es-ES', { maximumFractionDigits: 0 })}
                    </span>
                </div>
            </div>

            <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barCategoryGap="15%">
                        <XAxis
                            dataKey="hour"
                            tick={{ fontSize: 11, fill: '#6b7280' }}
                            axisLine={{ stroke: '#e5e7eb' }}
                            tickLine={false}
                        />
                        <YAxis
                            tickFormatter={(v) => `€${(v / 1000).toFixed(v >= 1000 ? 1 : 0)}${v >= 1000 ? 'K' : ''}`}
                            tick={{ fontSize: 11, fill: '#6b7280' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const d = payload[0].payload;
                                return (
                                    <div className="bg-white border rounded-lg shadow-xl p-3 text-sm">
                                        <p className="font-semibold mb-1">{d.hour}</p>
                                        <p>Forecast: <strong>€{d.sales.toLocaleString('es-ES')}</strong></p>
                                        <p>Mix: <strong>{d.mix.toFixed(1)}%</strong></p>
                                        {d.isPeak && <p className="text-indigo-600 font-medium">{t('forecast.horaPunta')}</p>}
                                    </div>
                                );
                            }}
                        />
                        <Bar dataKey="sales" radius={[4, 4, 0, 0]} maxBarSize={40}>
                            {chartData.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={
                                        entry.isSuperPeak ? COLOR_SUPER_PEAK
                                            : entry.isPeak ? COLOR_PEAK
                                                : COLOR_NORMAL
                                    }
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
}
