/**
 * ExecutiveBriefing — AI-generated morning briefing for the Control Tower.
 * Shows a prescriptive narrative based on yesterday's data.
 */

import { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, Coffee, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { format, subDays } from 'date-fns';
import { useTranslation } from 'react-i18next';

interface BriefingData {
    narrative: string;
    alerts: Array<{ location: string; type: 'warning' | 'critical'; message: string }>;
    recommendations: string[];
}

function generateLocalBriefing(
    locations: Array<{ id: string; name: string }>{t('dashboard.ExecutiveBriefing.salesbylocRecord')}<string, number>{t('dashboard.ExecutiveBriefing.labourbylocRecord')}<string, number>{t('dashboard.ExecutiveBriefing.budgetbylocRecord')}<string, { sales: number; labour: number }>{t('dashboard.ExecutiveBriefing.wastetotalNumberTargetcolbylocRecord')}<string, number> = {}
): BriefingData {
    const alerts: BriefingData['alerts'] = [];
    const recommendations: string[] = [];
    const narrativeParts: string[] = [];
    const yesterday = format(subDays(new Date(), 1), "d 'de' MMMM");

    let totalSales = 0;
    let totalLabour = 0;
    let totalBudgetSales = 0;

    locations.forEach(loc => {
        const sales = salesByLoc[loc.id] || 0;
        const labour = labourByLoc[loc.id] || 0;
        const budget = budgetByLoc[loc.id] || { sales: 0, labour: 0 };
        totalSales += sales;
        totalLabour += labour;
        totalBudgetSales += budget.sales;

        const colPct = sales > 0 ? (labour / sales) * 100 : 0;
        const salesVar = budget.sales > 0 ? ((sales - budget.sales) / budget.sales) * 100 : 0;
        const labourVar = budget.labour > 0 ? ((labour - budget.labour) / budget.labour) * 100 : 0;

        const locTarget = targetColByLoc[loc.id] || 30;

        if (colPct > locTarget) {
            alerts.push({
                location: loc.name,
                type: colPct > locTarget + 5 ? 'critical' : 'warning',
                message: `COL% en ${colPct.toFixed(1)}% — supera el objetivo del ${locTarget}%`,
            });
            recommendations.push(`Revisa la distribución de turnos en ${loc.name} para esta semana. Objetivo: ${locTarget}%.`);
        }

        if (salesVar < -10) {
            alerts.push({
                location: loc.name,
                type: 'warning',
                message: `Ventas ${salesVar.toFixed(0)}% por debajo del presupuesto`,
            });
            recommendations.push(`Evalúa acciones comerciales en ${loc.name}: promociones, eventos o ajustes de carta para recuperar ventas.`);
        }

        if (labourVar > 10) {
            alerts.push({
                location: loc.name,
                type: 'warning',
                message: `Coste laboral +${labourVar.toFixed(0)}% sobre presupuesto`,
            });
            if (labourVar > 30) {
                recommendations.push(`⚠️ ${loc.name}: coste laboral +${labourVar.toFixed(0)}% sobre presupuesto. Revisa horas extra, turnos innecesarios y ajusta la planificación semanal urgentemente.`);
            } else {
                recommendations.push(`${loc.name}: revisa las horas programadas vs demanda prevista. Considera ajustar turnos para reducir el sobrecoste laboral del +${labourVar.toFixed(0)}%.`);
            }
        }
    });

    const primeCost = totalLabour + wasteTotal;
    const primePct = totalSales > 0 ? (primeCost / totalSales) * 100 : 0;
    const salesVsTarget = totalBudgetSales > 0 ? ((totalSales - totalBudgetSales) / totalBudgetSales) * 100 : 0;

    narrativeParts.push(`Ayer (${yesterday}) las ventas totales fueron €${Math.round(totalSales).toLocaleString()}`);

    if (salesVsTarget > 0) {
        narrativeParts.push(`un ${salesVsTarget.toFixed(1)}% por encima del presupuesto`);
    } else if (salesVsTarget < 0) {
        narrativeParts.push(`un ${Math.abs(salesVsTarget).toFixed(1)}% por debajo del presupuesto`);
    }

    const overallColPct = totalSales > 0 ? (totalLabour / totalSales) * 100 : 0;

    narrativeParts.push(`El Prime Cost consolidado se situó en ${primePct.toFixed(1)}% (Labor €${Math.round(totalLabour).toLocaleString()} · COL% ${overallColPct.toFixed(1)}% + Mermas €${Math.round(wasteTotal).toLocaleString()}).`);

    // Flag zero sales as a data gap — never praise €0 as 'excellent'
    if (totalSales <= 0) {
        alerts.push({
            location: 'Todos',
            type: 'critical' as const,
            message: t('dashboard.noSeHanRegistradoVentas'),
        });
        recommendations.push(t('dashboard.sin_datos_de_ventas_revisa_que_el_pos_este_conecta'));
    }

    if (alerts.length === 0) {
        narrativeParts.push(t('dashboard.todosLosLocalesOperanDentro'));
    }

    if (recommendations.length === 0) {
        recommendations.push(t('dashboard.noSeRequierenAjustesInmediatos'));
    }

    return {
        narrative: narrativeParts.join(', ') + '.',
        alerts,
        recommendations,
    };
}

export function ExecutiveBriefing() {
  const { t } = useTranslation();
    const { accessibleLocations } = useApp();
    const [briefing, setBriefing] = useState<BriefingData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchBriefing = async () => {
        setIsLoading(true);
        try {
            const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
            const locIds = accessibleLocations.map(l => l.id);
            if (locIds.length === 0) { setIsLoading(false); return; }

            // Fetch yesterday's sales
            const { data: salesData } = await supabase
                .from('sales_daily_unified')
                .select('location_id, net_sales')
                .in('location_id', locIds)
                .eq('date', yesterday);

            // Fetch yesterday's labour cost per location
            // Fallback: compute SUM(planned_hours × hourly_cost) from planned_shifts + employees
            let labourData: any[] | null = null;
            try {
                const { data: rpcResult, error: rpcErr } = await (supabase as any).rpc('get_labour_cost_by_date', {
                    _location_ids: locIds,
                    _from: yesterday,
                    _to: yesterday,
                });
                if (!rpcErr && rpcResult) labourData = rpcResult;
                else if (rpcErr) console.warn('[ExecutiveBriefing] RPC labour error:', rpcErr.message);
            } catch (e) { console.warn('[ExecutiveBriefing] RPC call failed, using fallback'); }

            if (!labourData || labourData.length === 0) {
                // Client-side fallback
                const { data: shifts } = await supabase
                    .from('planned_shifts')
                    .select('location_id, planned_hours, employee_id')
                    .in('location_id', locIds)
                    .eq('shift_date', yesterday);

                if (shifts && shifts.length > 0) {
                    const empIds = [...new Set(shifts.map((s: any) => s.employee_id))];
                    const { data: emps } = await supabase
                        .from('employees')
                        .select('id, hourly_cost')
                        .in('id', empIds);
                    const costMap = new Map((emps || []).map((e: any) => {t('dashboard.ExecutiveBriefing.eidEhourlycost12ConstLoccosts')}<string, number> = {};
                    shifts.forEach((s: any) => {
                        const cost = (s.planned_hours || 0) * (costMap.get(s.employee_id) || 12);
                        locCosts[s.location_id] = (locCosts[s.location_id] || 0) + cost;
                    });
                    labourData = Object.entries(locCosts).map(([lid, cost]) => ({
                        location_id: lid,
                        labour_cost: cost,
                    }));
                }
            }

            // Fetch yesterday's budget
            const { data: budgetData } = await (supabase as any)
                .from('budget_daily_unified')
                .select('location_id, budget_sales, budget_labour')
                .in('location_id', locIds)
                .eq('day', yesterday);

            // Fetch waste (no waste_value column → compute from qty_delta × unit_cost)
            const { data: wasteData } = await supabase
                .from('stock_movements')
                .select('qty_delta, unit_cost')
                .in('location_id', locIds)
                .eq('movement_type', 'waste')
                .gte('created_at', `${yesterday}T00:00:00`)
                .lte('created_at', `${yesterday}T23:59:59`);

            // Aggregate by location
            const salesByLoc: Record<string, number> = {};
            (salesData || []).forEach((r: any) => { salesByLoc[r.location_id] = (salesByLoc[r.location_id] || 0) + (r.net_sales || 0); });

            const labourByLoc: Record<string, number> = {};
            (labourData || []).forEach((r: any) => {
                labourByLoc[r.location_id] = (labourByLoc[r.location_id] || 0) + (r.labour_cost || 0);
            });

            const budgetByLoc: Record<string, { sales: number; labour: number }> = {};
            (budgetData || []).forEach((r: any) => {
                if (!budgetByLoc[r.location_id]) budgetByLoc[r.location_id] = { sales: 0, labour: 0 };
                budgetByLoc[r.location_id].sales += r.budget_sales || 0;
                budgetByLoc[r.location_id].labour += r.budget_labour || 0;
            });

            const wasteTotal = (wasteData || []).reduce((sum: number, r: any) => {t('dashboard.ExecutiveBriefing.sumMathabsrqtydelta0Runitcost0')}<string, number> = {};
            try {
                const { data: settingsData } = await (supabase as any)
                    .from('location_settings')
                    .select('location_id, target_col_percent')
                    .in('location_id', locIds);
                (settingsData || []).forEach((s: any) => {
                    if (s.target_col_percent) targetColByLoc[s.location_id] = s.target_col_percent;
                });
            } catch { /* location_settings may not exist */ }

            const result = generateLocalBriefing(accessibleLocations, salesByLoc, labourByLoc, budgetByLoc, wasteTotal, targetColByLoc);
            setBriefing(result);
        } catch (err) {
            console.error('[ExecutiveBriefing]', err);
            setBriefing({
                narrative: 'No se pudo generar el briefing de hoy. Los datos de ayer pueden estar incompletos.',
                alerts: [],
                recommendations: ['Verifica que los datos de ventas y labor estén sincronizados.'],
            });
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        if (accessibleLocations.length > 0) fetchBriefing();
    }, [accessibleLocations.length]);

    if (isLoading) {
        return (
            <Card className="border-l-4 border-l-violet-500">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-violet-500" />
                        {t('dashboard.ExecutiveBriefing.morningBriefing')}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-4 w-3/5" />
                </CardContent>
            </Card>
        );
    }

    if (!briefing) return null;

    return (
        <Card className="border-l-4 border-l-violet-500">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Coffee className="h-4 w-4 text-violet-500" />
                        {t('dashboard.ExecutiveBriefing.morningBriefingJosephineAi')}
                    </CardTitle>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setIsRefreshing(true); fetchBriefing(); }}
                        disabled={isRefreshing}
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Narrative */}
                <p className="text-sm text-foreground leading-relaxed">{briefing.narrative}</p>

                {/* Alerts */}
                {briefing.alerts.length > 0 && (
                    <div className="space-y-1.5">
                        {briefing.alerts.slice(0, 3).map((alert, i) => (
                            <div key={i} className={`flex items-start gap-2 text-xs px-2.5 py-1.5 rounded ${alert.type === 'critical'
                                ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-800'
                                : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-800'
                                }`}>
                                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                <span><strong>{alert.location}:</strong> {alert.message}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Recommendations */}
                {briefing.recommendations.length > 0 && (
                    <div className="border-t pt-2">
                        <p className="text-xs font-medium text-muted-foreground mb-1">{t('dashboard.ExecutiveBriefing.recomendaciones')}</p>
                        {briefing.recommendations.slice(0, 2).map((rec, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                <TrendingUp className="h-3 w-3 mt-0.5 shrink-0 text-emerald-500" />
                                <span>{rec}</span>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
