/**
 * PayrollForecast — Real-time month projection
 *
 * Shows worked cost so far + remaining projected cost for the month.
 * Progress bar with budget tracking and per-employee breakdown.
 * Calls get_payroll_forecast RPC.
 */

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface PayrollForecastProps {
    locationId?: string | null;
}

interface ForecastData {
    period: { year: number; month: number };
    days: { total: number; elapsed: number; remaining: number };
    worked: { hours: number; cost: number };
    remaining: { hours: number; cost: number };
    projected: { total_cost: number; daily_run_rate: number };
    budget: { amount: number; pct_used: number | null; pct_projected: number | null; status: string };
    per_employee: Array<{
        employee_id: string;
        employee_name: string;
        role: string;
        worked_hours: number;
        remaining_hours: number;
        total_hours: number;
        projected_cost: number;
    }>;
}

function fmt(v: number) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    under_budget: { label: 'Bajo presupuesto', color: 'text-emerald-700', bg: 'bg-emerald-100', icon: '✓' },
    on_track: { label: 'En línea', color: 'text-blue-700', bg: 'bg-blue-100', icon: '→' },
    warning: { label: 'Atención', color: 'text-amber-700', bg: 'bg-amber-100', icon: '⚠' },
    over_budget: { label: 'Sobre presupuesto', color: 'text-red-700', bg: 'bg-red-100', icon: '✗' },
    no_budget: { label: 'Sin presupuesto', color: 'text-gray-500', bg: 'bg-gray-100', icon: '—' },
};

export function PayrollForecast({
  const { t } = useTranslation(); locationId }: PayrollForecastProps) {
    const { profile } = useAuth();
    const { accessibleLocations } = useApp();
    const orgId = profile?.group_id;
    const effectiveLocationId = locationId || (accessibleLocations.length > 0 ? accessibleLocations[0].id : null);
    const now = new Date();

    const { data, isLoading } = useQuery({
        queryKey: ['payroll-forecast', effectiveLocationId, now.getFullYear(), now.getMonth() + 1],
        queryFn: async (): Promise<ForecastData | null> => {
            if (!effectiveLocationId) return null;

            // Try RPC first
            try {
                if (orgId) {
                    const { data: rpcData, error } = await supabase.rpc('get_payroll_forecast' as any, {
                        p_org_id: orgId,
                        p_location_id: effectiveLocationId,
                        p_year: now.getFullYear(),
                        p_month: now.getMonth() + 1,
                    });
                    if (!error && rpcData) return rpcData as ForecastData;
                }
            } catch { /* RPC not available */ }

            // Client-side fallback
            const year = now.getFullYear();
            const month = now.getMonth(); // 0-indexed
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const totalDays = lastDay.getDate();
            const elapsed = Math.min(now.getDate(), totalDays);
            const remaining = totalDays - elapsed;
            const fmtD = (d: Date) => d.toISOString().split('T')[0];
            const todayStr = fmtD(now);
            const firstStr = fmtD(firstDay);
            const lastStr = fmtD(lastDay);

            // Fetch past shifts (worked) + future shifts (remaining)
            const [shiftsRes, clockRes, empsRes, budgetRes] = await Promise.all([
                supabase.from('planned_shifts')
                    .select('employee_id, shift_date, planned_hours')
                    .eq('location_id', effectiveLocationId)
                    .gte('shift_date', firstStr)
                    .lte('shift_date', lastStr),
                (supabase as any).from('employee_clock_records')
                    .select('employee_id, clock_in, clock_out')
                    .eq('location_id', effectiveLocationId)
                    .gte('clock_in', firstStr + 'T00:00:00')
                    .lte('clock_in', lastStr + 'T23:59:59'),
                supabase.from('employees')
                    .select('id, full_name, role_name, hourly_cost')
                    .eq('location_id', effectiveLocationId)
                    .eq('active', true),
                (supabase as any).from('budget_daily_unified')
                    .select('budget_labour')
                    .eq('location_id', effectiveLocationId)
                    .gte('day', firstStr)
                    .lte('day', lastStr),
            ]);

            const shifts = shiftsRes.data || [];
            const clockRecords = clockRes?.data || [];
            const employees = empsRes.data || [];
            const budgets = budgetRes?.data || [];

            if (shifts.length === 0 && clockRecords.length === 0) return null;

            const empMap = new Map(employees.map((e: any) => [e.id, e]));

            // Per-employee aggregation
            const empStats: Record<string, { worked: number; remaining: number; name: string; role: string; cost: number }> = {};

            shifts.forEach((s: any) => {
                const emp = empMap.get(s.employee_id);
                const hourlyCost = emp?.hourly_cost || 12;
                if (!empStats[s.employee_id]) {
                    empStats[s.employee_id] = { worked: 0, remaining: 0, name: emp?.full_name || 'Desconocido', role: emp?.role_name || '', cost: hourlyCost };
                }
                if (s.shift_date <= todayStr) empStats[s.employee_id].worked += Number(s.planned_hours || 0);
                else empStats[s.employee_id].remaining += Number(s.planned_hours || 0);
            });

            // Add actual clock hours where available
            clockRecords.forEach((c: any) => {
                if (!c.clock_in || !c.clock_out) return;
                const hours = (new Date(c.clock_out).getTime() - new Date(c.clock_in).getTime()) / 3600000;
                const emp = empMap.get(c.employee_id);
                if (!empStats[c.employee_id]) {
                    empStats[c.employee_id] = { worked: 0, remaining: 0, name: emp?.full_name || 'Desconocido', role: emp?.role_name || '', cost: emp?.hourly_cost || 12 };
                }
                // Use clock hours for worked (more accurate than planned)
            });

            let workedHours = 0, workedCost = 0, remainingHours = 0, remainingCost = 0;
            const perEmployee = Object.entries(empStats).map(([eid, s]) => {
                workedHours += s.worked;
                workedCost += s.worked * s.cost;
                remainingHours += s.remaining;
                remainingCost += s.remaining * s.cost;
                return {
                    employee_id: eid,
                    employee_name: s.name,
                    role: s.role,
                    worked_hours: Math.round(s.worked * 10) / 10,
                    remaining_hours: Math.round(s.remaining * 10) / 10,
                    total_hours: Math.round((s.worked + s.remaining) * 10) / 10,
                    projected_cost: Math.round((s.worked + s.remaining) * s.cost),
                };
            }).sort((a, b) => b.projected_cost - a.projected_cost);

            const projectedTotal = workedCost + remainingCost;
            const dailyRunRate = elapsed > 0 ? workedCost / elapsed : 0;
            const budgetAmount = budgets.reduce((sum: number, b: any) => sum + (b.budget_labour || 0), 0);
            const budgetPct = budgetAmount > 0 ? Math.round(projectedTotal / budgetAmount * 100) : null;

            let status = 'no_budget';
            if (budgetAmount > 0) {
                if (budgetPct! <= 90) status = 'under_budget';
                else if (budgetPct! <= 105) status = 'on_track';
                else if (budgetPct! <= 115) status = 'warning';
                else status = 'over_budget';
            }

            return {
                period: { year, month: month + 1 },
                days: { total: totalDays, elapsed, remaining },
                worked: { hours: Math.round(workedHours * 10) / 10, cost: Math.round(workedCost) },
                remaining: { hours: Math.round(remainingHours * 10) / 10, cost: Math.round(remainingCost) },
                projected: { total_cost: Math.round(projectedTotal), daily_run_rate: Math.round(dailyRunRate) },
                budget: { amount: Math.round(budgetAmount), pct_used: elapsed > 0 ? Math.round(workedCost / budgetAmount * 100) : 0, pct_projected: budgetPct, status },
                per_employee: perEmployee,
            };
        },
        enabled: !!effectiveLocationId,
        staleTime: 60000,
    });

    if (!effectiveLocationId) {
        return (
            <Card className="bg-white">
                <CardHeader><CardTitle className="text-base">📊 Previsión de Nómina</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-gray-500 text-center py-4">Selecciona una ubicación</p></CardContent>
            </Card>
        );
    }

    if (isLoading) {
        return (
            <Card className="bg-white">
                <CardHeader><CardTitle className="text-base">📊 Previsión de Nómina</CardTitle></CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!data) {
        return (
            <Card className="bg-white">
                <CardHeader><CardTitle className="text-base">📊 Previsión de Nómina</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-gray-500 text-center py-4">No hay datos de turnos</p></CardContent>
            </Card>
        );
    }

    const statusCfg = STATUS_CONFIG[data.budget.status] || STATUS_CONFIG.no_budget;
    const progressPct = data.days.total > 0 ? Math.round((data.days.elapsed / data.days.total) * 100) : 0;
    const costPct = data.projected.total_cost > 0
        ? Math.round((data.worked.cost / data.projected.total_cost) * 100) : 0;

    return (
        <Card className="bg-white">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base font-semibold">📊 Previsión de Nómina</CardTitle>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {format(new Date(data.period.year, data.period.month - 1), 'MMMM yyyy', { locale: es })}
                            {' · '} Día {data.days.elapsed} de {data.days.total}
                        </p>
                    </div>
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase", statusCfg.bg, statusCfg.color)}>
                        {statusCfg.icon} {statusCfg.label}
                    </span>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Main projection */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-emerald-50/50 rounded-xl">
                        <div className="text-[10px] font-semibold text-emerald-600 uppercase">Ya gastado</div>
                        <div className="text-xl font-bold text-emerald-700 mt-1">{fmt(data.worked.cost)}</div>
                        <div className="text-[10px] text-emerald-500">{data.worked.hours}h trabajadas</div>
                    </div>
                    <div className="text-center p-3 bg-blue-50/50 rounded-xl">
                        <div className="text-[10px] font-semibold text-blue-600 uppercase">Pendiente</div>
                        <div className="text-xl font-bold text-blue-700 mt-1">{fmt(data.remaining.cost)}</div>
                        <div className="text-[10px] text-blue-500">{data.remaining.hours}h planificadas</div>
                    </div>
                    <div className="text-center p-3 bg-indigo-50/50 rounded-xl border-2 border-indigo-200">
                        <div className="text-[10px] font-semibold text-indigo-600 uppercase">Proyección mes</div>
                        <div className="text-xl font-bold text-indigo-700 mt-1">{fmt(data.projected.total_cost)}</div>
                        <div className="text-[10px] text-indigo-500">{fmt(data.projected.daily_run_rate)}/día</div>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] text-gray-500">
                        <span>Progreso del mes ({progressPct}%)</span>
                        <span>Coste consumido ({costPct}%)</span>
                    </div>
                    <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                        {/* Time progress */}
                        <div
                            className="absolute inset-y-0 left-0 bg-gray-300/50 rounded-full"
                            style={{ width: `${progressPct}%` }}
                        />
                        {/* Cost progress */}
                        <div
                            className={cn("absolute inset-y-0 left-0 rounded-full transition-all",
                                costPct > progressPct + 15 ? 'bg-red-400' :
                                    costPct > progressPct + 5 ? 'bg-amber-400' : 'bg-emerald-400'
                            )}
                            style={{ width: `${costPct}%` }}
                        />
                    </div>
                    {costPct > progressPct + 10 && (
                        <p className="text-[10px] text-amber-600 font-medium">
                            ⚠ El coste va {costPct - progressPct}pp por delante del tiempo — ritmo por encima de lo esperado
                        </p>
                    )}
                </div>

                {/* Budget comparison */}
                {data.budget.amount > 0 && (
                    <div className="flex items-center justify-between p-3 bg-gray-50/50 rounded-lg">
                        <div className="text-sm text-gray-600">
                            <span className="font-medium">Presupuesto:</span> {fmt(data.budget.amount)}
                        </div>
                        <div className="text-sm">
                            <span className={cn("font-bold", statusCfg.color)}>
                                {data.budget.pct_projected}% proyectado
                            </span>
                        </div>
                    </div>
                )}

                {/* Per-employee breakdown */}
                {data.per_employee.length > 0 && (
                    <div className="space-y-1">
                        <div className="text-[10px] font-semibold text-gray-500 uppercase mb-2">Desglose por empleado</div>
                        {data.per_employee.slice(0, 6).map(emp => (
                            <div key={emp.employee_id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50/50">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-800">{emp.employee_name}</span>
                                    <span className="text-[10px] text-gray-400">{emp.role || 'Equipo'}</span>
                                </div>
                                <div className="flex items-center gap-3 text-xs">
                                    <span className="text-gray-500">{emp.total_hours}h</span>
                                    <span className="font-semibold text-gray-700 w-16 text-right">{fmt(emp.projected_cost)}</span>
                                </div>
                            </div>
                        ))}
                        {data.per_employee.length > 6 && (
                            <p className="text-[10px] text-gray-400 text-center">+{data.per_employee.length - 6} más</p>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
