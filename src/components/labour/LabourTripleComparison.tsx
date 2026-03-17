/**
 * LabourTripleComparison — Schedule vs Actual vs Payroll
 *
 * Shows three layers of labour cost comparison:
 * - Planificado (forecast_daily_metrics.planned_labor_cost)
 * - Actual (labour_daily.labour_cost — clock-in × rate)
 * - Nómina (v_payroll_monthly_cost — real payroll with SS)
 *
 * Displays as grouped horizontal bars with drift metrics.
 */

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { LabourKpis, MetricMode } from '@/hooks/useLabourData';

interface LabourTripleComparisonProps {
    kpis: LabourKpis | undefined;
    isLoading: boolean;
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
}

interface BarRowProps {
    label: string;
    value: number;
    maxValue: number;
    color: string;
    badge?: { text: string; className: string };
}

function BarRow({ label, value, maxValue, color, badge }: BarRowProps) {
    const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">{label}</span>
                    {badge && (
                        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase", badge.className)}>
                            {badge.text}
                        </span>
                    )}
                </div>
                <span className="text-sm font-semibold text-gray-900">{formatCurrency(value)}</span>
            </div>
            <div className="w-full h-4 bg-gray-100 rounded-sm overflow-hidden">
                <div
                    className={cn("h-full rounded-sm transition-all duration-500", color)}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

export function LabourTripleComparison({ kpis, isLoading }: LabourTripleComparisonProps) {
    if (isLoading || !kpis) {
        return (
            <Card className="p-6 bg-white">
                <div className="animate-pulse space-y-4">
                    <div className="h-5 w-48 bg-gray-200 rounded" />
                    <div className="h-4 w-full bg-gray-100 rounded" />
                    <div className="h-4 w-full bg-gray-100 rounded" />
                    <div className="h-4 w-full bg-gray-100 rounded" />
                </div>
            </Card>
        );
    }

    const planned = kpis.planned_labor_cost;
    const schedule = kpis.schedule_labor_cost;
    const payroll = kpis.labor_cost_source === 'payroll' ? kpis.actual_labor_cost : 0;
    const hasPayroll = kpis.labor_cost_source === 'payroll';

    // Max bar value for proportional scaling
    const maxVal = Math.max(planned, schedule, payroll, 1);

    // Drift metrics
    const scheduleVsPlanned = planned > 0 ? ((schedule - planned) / planned * 100) : 0;
    const payrollVsSchedule = hasPayroll && schedule > 0 ? ((payroll - schedule) / schedule * 100) : 0;
    const totalDrift = hasPayroll && planned > 0 ? ((payroll - planned) / planned * 100) : (planned > 0 ? ((schedule - planned) / planned * 100) : 0);

    return (
        <Card className="p-6 bg-white">
            <div className="space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-semibold text-gray-900">Planificado vs Actual vs Nómina</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Compara las tres capas de coste laboral</p>
                    </div>
                    {/* Drift indicator */}
                    <div className={cn(
                        "text-sm font-semibold px-3 py-1 rounded-full",
                        totalDrift <= 0
                            ? "bg-emerald-100 text-emerald-700"
                            : totalDrift <= 5
                                ? "bg-amber-100 text-amber-700"
                                : "bg-red-100 text-red-700"
                    )}>
                        Drift: {totalDrift > 0 ? '+' : ''}{totalDrift.toFixed(1)}%
                    </div>
                </div>

                {/* Three bars */}
                <div className="space-y-4">
                    <BarRow
                        label="Planificado"
                        value={planned}
                        maxValue={maxVal}
                        color="bg-gradient-to-r from-indigo-300 to-indigo-400"
                        badge={{ text: 'Forecast', className: 'bg-indigo-100 text-indigo-700' }}
                    />

                    <BarRow
                        label="Actual (horarios)"
                        value={schedule}
                        maxValue={maxVal}
                        color="bg-gradient-to-r from-blue-400 to-blue-500"
                        badge={{
                            text: scheduleVsPlanned > 0 ? `+${scheduleVsPlanned.toFixed(1)}%` : `${scheduleVsPlanned.toFixed(1)}%`,
                            className: scheduleVsPlanned <= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }}
                    />

                    {hasPayroll ? (
                        <BarRow
                            label="Nómina (real)"
                            value={payroll}
                            maxValue={maxVal}
                            color="bg-gradient-to-r from-emerald-500 to-emerald-600"
                            badge={{
                                text: payrollVsSchedule > 0 ? `+${payrollVsSchedule.toFixed(1)}%` : `${payrollVsSchedule.toFixed(1)}%`,
                                className: payrollVsSchedule <= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                            }}
                        />
                    ) : (
                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-400">Nómina (real)</span>
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase bg-gray-100 text-gray-500">
                                        Sin datos
                                    </span>
                                </div>
                                <span className="text-sm text-gray-400">—</span>
                            </div>
                            <div className="w-full h-4 bg-gray-50 rounded-sm border border-dashed border-gray-200" />
                        </div>
                    )}
                </div>

                {/* Summary row */}
                <div className="flex items-center gap-6 pt-2 border-t border-gray-100 text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm bg-indigo-400" />
                        <span>Planificado</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                        <span>Horarios</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                        <span>Nómina</span>
                    </div>
                    <div className="ml-auto text-gray-400">
                        Drift = diferencia entre planificado y coste real
                    </div>
                </div>
            </div>
        </Card>
    );
}
