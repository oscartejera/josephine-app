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

interface BriefingData {
    narrative: string;
    alerts: Array<{ location: string; type: 'warning' | 'critical'; message: string }>;
    recommendations: string[];
}

function generateLocalBriefing(
    locations: Array<{ id: string; name: string }>,
    salesByLoc: Record<string, number>,
    labourByLoc: Record<string, number>,
    budgetByLoc: Record<string, { sales: number; labour: number }>,
    wasteTotal: number
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

        if (colPct > 35) {
            alerts.push({
                location: loc.name,
                type: 'critical',
                message: `COL% en ${colPct.toFixed(1)}% — supera el objetivo del 30%`,
            });
            recommendations.push(`Revisa la distribución de turnos en ${loc.name} para esta semana.`);
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

    narrativeParts.push(`El Prime Cost consolidado se situó en ${primePct.toFixed(1)}% (Labor €${Math.round(totalLabour).toLocaleString()} + Mermas €${Math.round(wasteTotal).toLocaleString()}).`);

    if (alerts.length === 0) {
        narrativeParts.push('Todos los locales operan dentro de los márgenes objetivo. Excelente jornada.');
    }

    if (recommendations.length === 0) {
        recommendations.push('No se requieren ajustes inmediatos. Mantén la estrategia actual.');
    }

    return {
        narrative: narrativeParts.join(', ') + '.',
        alerts,
        recommendations,
    };
}

export function ExecutiveBriefing() {
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

            // Fetch yesterday's labour
            const { data: labourData } = await (supabase as any)
                .from('labour_daily_unified')
                .select('location_id, actual_cost')
                .in('location_id', locIds)
                .eq('day', yesterday);

            // Fetch yesterday's budget
            const { data: budgetData } = await (supabase as any)
                .from('budget_daily_unified')
                .select('location_id, budget_sales, budget_labour')
                .in('location_id', locIds)
                .eq('day', yesterday);

            // Fetch waste
            const { data: wasteData } = await supabase
                .from('stock_movements')
                .select('waste_value')
                .in('location_id', locIds)
                .eq('movement_type', 'waste')
                .gte('created_at', `${yesterday}T00:00:00`)
                .lte('created_at', `${yesterday}T23:59:59`);

            // Aggregate by location
            const salesByLoc: Record<string, number> = {};
            (salesData || []).forEach((r: any) => { salesByLoc[r.location_id] = (salesByLoc[r.location_id] || 0) + (r.net_sales || 0); });

            const labourByLoc: Record<string, number> = {};
            (labourData || []).forEach((r: any) => { labourByLoc[r.location_id] = (labourByLoc[r.location_id] || 0) + (r.actual_cost || 0); });

            const budgetByLoc: Record<string, { sales: number; labour: number }> = {};
            (budgetData || []).forEach((r: any) => {
                if (!budgetByLoc[r.location_id]) budgetByLoc[r.location_id] = { sales: 0, labour: 0 };
                budgetByLoc[r.location_id].sales += r.budget_sales || 0;
                budgetByLoc[r.location_id].labour += r.budget_labour || 0;
            });

            const wasteTotal = (wasteData || []).reduce((sum: number, r: any) => sum + Math.abs(r.waste_value || 0), 0);

            const result = generateLocalBriefing(accessibleLocations, salesByLoc, labourByLoc, budgetByLoc, wasteTotal);
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
                        Morning Briefing
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
                        Morning Briefing — Josephine AI
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
                                ? 'bg-red-50 text-red-700 border border-red-100'
                                : 'bg-amber-50 text-amber-700 border border-amber-100'
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
                        <p className="text-xs font-medium text-muted-foreground mb-1">Recomendaciones:</p>
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
