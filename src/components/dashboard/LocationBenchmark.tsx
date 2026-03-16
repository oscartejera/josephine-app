import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildQueryContext, getKpiRangeSummary } from '@/data';
import { useTranslation } from 'react-i18next';

interface LocationKPI {
    id: string;
    name: string;
    revenue: number;
    gpPercent: number;
    colPercent: number;
    wastePercent: number;
    splh: number;
}

const KPI_TARGETS = {
    gpPercent: { target: 70, higher: 'good' as const },
    colPercent: { target: 30, higher: 'bad' as const },
    wastePercent: { target: 3, higher: 'bad' as const },
    splh: { target: 40, higher: 'good' as const },
};

function getKPIColor(value: number, kpi: keyof typeof KPI_TARGETS): string {
    const config = KPI_TARGETS[kpi];
    const diff = value - config.target;
    const isGood = config.higher === 'good' ? diff >= 0 : diff <= 0;
    return isGood ? 'text-emerald-600' : 'text-red-500';
}

function getKPIIcon(value: number, kpi: keyof typeof KPI_TARGETS) {
    const config = KPI_TARGETS[kpi];
    const diff = value - config.target;
    if (Math.abs(diff) < 1) return <Minus className="h-3 w-3" />;
    return diff > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />;
}

export function LocationBenchmark() {
  const { t } = useTranslation();
    const { accessibleLocations, canShowAllLocations, getDateRangeValues, dataSource, dateRange } = useApp();
    const { profile } = useAuth();
    const [kpis, setKpis] = useState<LocationKPI[]>([]);
    const [loading, setLoading] = useState(true);

    // Only show for owners with multiple locations
    if (!canShowAllLocations || accessibleLocations.length < 2) return null;

    useEffect(() => {
        async function fetchAllLocations() {
            if (!profile?.group_id || accessibleLocations.length < 2) {
                setLoading(false);
                return;
            }

            setLoading(true);
            const { from, to } = getDateRangeValues();
            const fromStr = from.toISOString().split('T')[0];
            const toStr = to.toISOString().split('T')[0];

            const results: LocationKPI[] = [];

            for (const loc of accessibleLocations) {
                try {
                    const ctx = buildQueryContext(profile.group_id, [loc.id], dataSource);
                    const kpiData = await getKpiRangeSummary(ctx, fromStr, toStr);
                    const c = kpiData.current;

                    results.push({
                        id: loc.id,
                        name: loc.name,
                        revenue: c.net_sales || 0,
                        gpPercent: c.gp_percent || 0,
                        colPercent: c.col_percent || 0,
                        wastePercent: 0, // waste not in KPI summary yet
                        splh: c.net_sales > 0 && c.labour_cost > 0
                            ? Math.round(c.net_sales / (c.labour_cost / 12) * 100) / 100
                            : 0,
                    });
                } catch {
                    results.push({
                        id: loc.id,
                        name: loc.name,
                        revenue: 0, gpPercent: 0, colPercent: 0, wastePercent: 0, splh: 0,
                    });
                }
            }

            setKpis(results);
            setLoading(false);
        }

        fetchAllLocations();
    }, [profile?.group_id, accessibleLocations, dataSource, dateRange]);

    if (loading) {
        return (
            <Card>
                <CardContent className="pt-6 flex items-center justify-center h-24">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    if (kpis.length === 0 || kpis.every(k => k.revenue === 0)) return null;

    const bestGP = kpis.reduce((best, loc) => loc.gpPercent > best.gpPercent ? loc : best, kpis[0]);

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Benchmarking Multi-Local
                </CardTitle>
                <CardDescription>Comparativa de KPIs entre locales</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto -mx-6 px-6">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Local</th>
                                <th className="text-right py-2 px-3 font-medium text-muted-foreground">Revenue</th>
                                <th className="text-right py-2 px-3 font-medium text-muted-foreground">GP%</th>
                                <th className="text-right py-2 px-3 font-medium text-muted-foreground">COL%</th>
                                <th className="text-right py-2 pl-3 font-medium text-muted-foreground">SPLH</th>
                            </tr>
                        </thead>
                        <tbody>
                            {kpis.map(loc => (
                                <tr key={loc.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                    <td className="py-2.5 pr-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                                {loc.name.charAt(0)}
                                            </div>
                                            <span className="font-medium truncate max-w-[120px]">{loc.name}</span>
                                            {loc.id === bestGP.id && bestGP.gpPercent > 0 && (
                                                <Badge variant="outline" className="text-[10px] py-0 px-1 border-emerald-300 text-emerald-600">
                                                    Best GP
                                                </Badge>
                                            )}
                                        </div>
                                    </td>
                                    <td className="text-right py-2.5 px-3 font-medium">
                                        €{loc.revenue.toLocaleString('es-ES', { maximumFractionDigits: 0 })}
                                    </td>
                                    <td className={cn("text-right py-2.5 px-3 font-medium", getKPIColor(loc.gpPercent, 'gpPercent'))}>
                                        <span className="inline-flex items-center gap-1">
                                            {getKPIIcon(loc.gpPercent, 'gpPercent')}
                                            {loc.gpPercent.toFixed(1)}%
                                        </span>
                                    </td>
                                    <td className={cn("text-right py-2.5 px-3 font-medium", getKPIColor(loc.colPercent, 'colPercent'))}>
                                        <span className="inline-flex items-center gap-1">
                                            {getKPIIcon(loc.colPercent, 'colPercent')}
                                            {loc.colPercent.toFixed(1)}%
                                        </span>
                                    </td>
                                    <td className={cn("text-right py-2.5 pl-3 font-medium", getKPIColor(loc.splh, 'splh'))}>
                                        <span className="inline-flex items-center gap-1">
                                            {getKPIIcon(loc.splh, 'splh')}
                                            €{loc.splh.toFixed(0)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-muted/30">
                                <td className="py-2 pr-4 text-xs font-medium text-muted-foreground">Objetivo</td>
                                <td className="text-right py-2 px-3 text-xs text-muted-foreground">—</td>
                                <td className="text-right py-2 px-3 text-xs text-muted-foreground">≥70%</td>
                                <td className="text-right py-2 px-3 text-xs text-muted-foreground">≤30%</td>
                                <td className="text-right py-2 pl-3 text-xs text-muted-foreground">≥€40</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
