/**
 * LocationHealthIndicators — shows at-risk locations in the Control Tower.
 * Highlights locations with low SPLH or Prime Cost > 65%.
 */

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, TrendingDown, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';
import { format, subDays } from 'date-fns';

interface LocationHealth {
    locationId: string;
    locationName: string;
    sales: number;
    labourCost: number;
    cogs: number;
    primePct: number;
    colPct: number;
    splh: number;
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
}

export function LocationHealthIndicators() {
    const { accessibleLocations } = useApp();
    const [healthData, setHealthData] = useState<LocationHealth[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchHealth = async () => {
            if (accessibleLocations.length === 0) { setIsLoading(false); return; }

            try {
                const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
                const locIds = accessibleLocations.map(l => l.id);

                // Fetch yesterday's data in parallel
                const [salesRes, labourRes, cogsRes, shiftsRes] = await Promise.all([
                    supabase.from('sales_daily_unified').select('location_id, net_sales')
                        .in('location_id', locIds).eq('date', yesterday),
                    (supabase as any).from('labour_daily_unified').select('location_id, actual_cost, actual_hours')
                        .in('location_id', locIds).eq('day', yesterday),
                    supabase.from('cogs_daily').select('location_id, cogs_amount')
                        .in('location_id', locIds).eq('date', yesterday),
                    supabase.from('planned_shifts').select('location_id, planned_hours')
                        .in('location_id', locIds).eq('shift_date', yesterday),
                ]);

                // Aggregate by location
                const salesMap: Record<string, number> = {};
                (salesRes.data || []).forEach((r: any) => { salesMap[r.location_id] = (salesMap[r.location_id] || 0) + (r.net_sales || 0); });

                const labourMap: Record<string, { cost: number; hours: number }> = {};
                (labourRes.data || []).forEach((r: any) => {
                    if (!labourMap[r.location_id]) labourMap[r.location_id] = { cost: 0, hours: 0 };
                    labourMap[r.location_id].cost += r.actual_cost || 0;
                    labourMap[r.location_id].hours += r.actual_hours || 0;
                });

                const cogsMap: Record<string, number> = {};
                (cogsRes.data || []).forEach((r: any) => { cogsMap[r.location_id] = (cogsMap[r.location_id] || 0) + (r.cogs_amount || 0); });

                const shiftsMap: Record<string, number> = {};
                (shiftsRes.data || []).forEach((r: any) => { shiftsMap[r.location_id] = (shiftsMap[r.location_id] || 0) + (r.planned_hours || 0); });

                const results: LocationHealth[] = accessibleLocations.map(loc => {
                    const sales = salesMap[loc.id] || 0;
                    const labour = labourMap[loc.id]?.cost || 0;
                    const hours = labourMap[loc.id]?.hours || shiftsMap[loc.id] || 0;
                    const cogs = cogsMap[loc.id] || 0;
                    const primeCost = labour + cogs;
                    const primePct = sales > 0 ? (primeCost / sales) * 100 : 0;
                    const colPct = sales > 0 ? (labour / sales) * 100 : 0;
                    const splh = hours > 0 ? sales / hours : 0;
                    const issues: string[] = [];

                    if (primePct > 65) issues.push(`Prime Cost ${primePct.toFixed(0)}%`);
                    if (colPct > 35) issues.push(`COL% ${colPct.toFixed(0)}%`);
                    if (splh > 0 && splh < 40) issues.push(`SPLH €${splh.toFixed(0)}`);

                    let status: LocationHealth['status'] = 'healthy';
                    if (issues.length > 0) status = 'warning';
                    if (primePct > 70 || colPct > 40) status = 'critical';

                    return {
                        locationId: loc.id,
                        locationName: loc.name,
                        sales, labourCost: labour, cogs,
                        primePct, colPct, splh,
                        status, issues,
                    };
                });

                // Sort: critical first, then warning, then healthy
                results.sort((a, b) => {
                    const order = { critical: 0, warning: 1, healthy: 2 };
                    return order[a.status] - order[b.status];
                });

                setHealthData(results);
            } catch (err) {
                console.error('[LocationHealth]', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchHealth();
    }, [accessibleLocations]);

    if (isLoading) {
        return (
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <MapPin className="h-4 w-4" /> Salud de Locales
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                </CardContent>
            </Card>
        );
    }

    if (healthData.length === 0) return null;

    const atRiskCount = healthData.filter(h => h.status !== 'healthy').length;

    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <MapPin className="h-4 w-4" /> Salud de Locales
                    </CardTitle>
                    {atRiskCount > 0 && (
                        <Badge variant="destructive" className="text-[10px]">
                            {atRiskCount} alerta{atRiskCount > 1 ? 's' : ''}
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-1.5">
                {healthData.map(loc => (
                    <div
                        key={loc.locationId}
                        className={cn(
                            "flex items-center justify-between px-3 py-2 rounded-md text-sm",
                            loc.status === 'critical' ? 'bg-red-50 border border-red-100' :
                                loc.status === 'warning' ? 'bg-amber-50 border border-amber-100' :
                                    'bg-emerald-50/50 border border-emerald-100'
                        )}
                    >
                        <div className="flex items-center gap-2">
                            {loc.status === 'critical' ? (
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                            ) : loc.status === 'warning' ? (
                                <TrendingDown className="h-4 w-4 text-amber-500" />
                            ) : (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            )}
                            <span className="font-medium text-xs">{loc.locationName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {loc.issues.length > 0 ? (
                                loc.issues.map((issue, i) => (
                                    <Badge key={i} variant="outline" className={cn(
                                        "text-[10px] px-1.5",
                                        loc.status === 'critical' ? 'border-red-200 text-red-700' : 'border-amber-200 text-amber-700'
                                    )}>
                                        {issue}
                                    </Badge>
                                ))
                            ) : (
                                <span className="text-[10px] text-emerald-600">OK</span>
                            )}
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
