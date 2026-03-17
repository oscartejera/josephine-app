import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface FoodCostData {
    theoretical_cogs: number;
    actual_purchases: number;
    waste_value: number;
    variance: number;
    variance_pct: number;
    total_revenue: number;
    theoretical_food_cost_pct: number;
    actual_food_cost_pct: number;
}

export function FoodCostVarianceCard() {
  const { t } = useTranslation();
    const { selectedLocationId, accessibleLocations, getDateRangeValues, dateRange, loading: appLoading } = useApp();
    const [data, setData] = useState<FoodCostData | null>(null);
    const [loading, setLoading] = useState(true);

    // Resolve location — if 'all', pick first accessible location
    const effectiveLocationId = selectedLocationId === 'all'
        ? accessibleLocations[0]?.id || null
        : selectedLocationId;

    useEffect(() => {
        async function fetchVariance() {
            if (!effectiveLocationId || appLoading) {
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const { from, to } = getDateRangeValues();
                const { data: result, error } = await (supabase.rpc as any)('get_food_cost_variance', {
                    _location_id: effectiveLocationId,
                    _from: from.toISOString().split('T')[0],
                    _to: to.toISOString().split('T')[0],
                });

                if (result && !error) {
                    setData(result as FoodCostData);
                }
            } catch (err) {
                console.warn('[FoodCostVariance] RPC unavailable:', err);
            } finally {
                setLoading(false);
            }
        }

        fetchVariance();
    }, [effectiveLocationId, dateRange, appLoading]);

    if (loading) {
        return (
            <Card>
                <CardContent className="pt-6 flex items-center justify-center h-32">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    if (!data || data.total_revenue === 0) return null;

    const isOverBudget = data.variance > 0;
    const varianceColor = isOverBudget ? 'text-red-500' : 'text-emerald-500';
    const Icon = isOverBudget ? AlertTriangle : CheckCircle2;

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", varianceColor)} />
                    Food Cost: Real vs Teórico
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex items-end justify-between">
                    <div>
                        <p className="text-2xl font-bold">
                            {data.actual_food_cost_pct.toFixed(1)}%
                        </p>
                        <p className="text-xs text-muted-foreground">Coste real</p>
                    </div>
                    <div className="text-right">
                        <p className="text-lg font-semibold text-muted-foreground">
                            {data.theoretical_food_cost_pct.toFixed(1)}%
                        </p>
                        <p className="text-xs text-muted-foreground">{t('dashboard.teoricoRecetas')}</p>
                    </div>
                </div>

                {/* Variance bar */}
                <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Varianza</span>
                        <Badge
                            variant="outline"
                            className={cn(
                                "text-xs gap-1",
                                isOverBudget
                                    ? "border-red-200 text-red-600 bg-red-50 dark:bg-red-950/20"
                                    : "border-emerald-200 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20"
                            )}
                        >
                            {isOverBudget ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {data.variance_pct > 0 ? '+' : ''}{data.variance_pct.toFixed(1)}%
                        </Badge>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                            className={cn(
                                "h-full rounded-full transition-all",
                                isOverBudget ? "bg-red-500" : "bg-emerald-500"
                            )}
                            style={{ width: `${Math.min(100, Math.abs(data.variance_pct) * 2 + 50)}%` }}
                        />
                    </div>
                </div>

                {/* Breakdown */}
                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="p-2 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">Compras</p>
                        <p className="text-sm font-semibold">€{data.actual_purchases.toFixed(0)}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">{t('dashboard.teorico')}</p>
                        <p className="text-sm font-semibold">€{data.theoretical_cogs.toFixed(0)}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">Merma</p>
                        <p className="text-sm font-semibold text-warning">€{data.waste_value.toFixed(0)}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
