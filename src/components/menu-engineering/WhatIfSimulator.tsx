import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, TrendingUp, TrendingDown, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MenuEngineeringItem, MenuEngineeringStats, Classification } from '@/hooks/useMenuEngineeringData';

interface WhatIfSimulatorProps {
  items: MenuEngineeringItem[];
  stats: MenuEngineeringStats | null;
  loading: boolean;
}

interface SimulatedItem extends MenuEngineeringItem {
  simPrice: number;
  simGrossProfit: number;
  simClassification: Classification;
  changed: boolean;
}

const CLASS_EMOJI: Record<Classification, string> = {
  star: '⭐',
  plow_horse: '🐴',
  puzzle: '💎',
  dog: '🔍',
};

const CLASS_LABEL: Record<Classification, string> = {
  star: 'Star',
  plow_horse: 'Plow Horse',
  puzzle: 'Puzzle',
  dog: 'Dog',
};

const CLASS_COLOR: Record<Classification, string> = {
  star: 'text-emerald-600',
  plow_horse: 'text-blue-600',
  puzzle: 'text-amber-600',
  dog: 'text-red-600',
};

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000) return `€${(value / 1000).toFixed(1)}k`;
  return `€${value.toFixed(2)}`;
}

function classify(
  itemGP: number,
  avgGP: number,
  popPct: number,
  popThreshold: number,
): Classification {
  const highProfit = itemGP >= avgGP;
  const highPop = popPct >= popThreshold;

  if (highProfit && highPop) return 'star';
  if (!highProfit && highPop) return 'plow_horse';
  if (highProfit && !highPop) return 'puzzle';
  return 'dog';
}

export function WhatIfSimulator({ items, stats, loading }: WhatIfSimulatorProps) {
  // Track per-item simulated prices (key = product_id)
  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>({});

  const resetAll = useCallback(() => setPriceOverrides({}), []);

  // Recalculate everything when prices change
  const { simulatedItems, summary } = useMemo(() => {
    if (!stats || items.length === 0) {
      return { simulatedItems: [], summary: null };
    }

    // 1. Calculate simulated GP for each item
    const withSimGP = items.map((item) => {
      const simPrice = priceOverrides[item.product_id] ?? item.selling_price_ex_vat;
      const simGrossProfit = simPrice - item.unit_food_cost;
      return { ...item, simPrice, simGrossProfit };
    });

    // 2. Calculate new average CM (weighted)
    const totalUnits = withSimGP.reduce((s, i) => s + i.units_sold, 0);
    const totalSimGP = withSimGP.reduce((s, i) => s + i.simGrossProfit * i.units_sold, 0);
    const newAvgCM = totalUnits > 0 ? totalSimGP / totalUnits : 0;

    // 3. Popularity threshold doesn't change with price
    const popThreshold = stats.popThreshold;

    // 4. Reclassify each item
    const simItems: SimulatedItem[] = withSimGP.map((item) => {
      const simClass = classify(item.simGrossProfit, newAvgCM, item.popularity_pct, popThreshold);
      return {
        ...item,
        simClassification: simClass,
        changed: simClass !== item.classification,
      };
    });

    // 5. Summary
    const changedCount = simItems.filter((i) => i.changed).length;
    const originalTotalGP = items.reduce((s, i) => s + i.unit_gross_profit * i.units_sold, 0);
    const gpDelta = totalSimGP - originalTotalGP;
    const totalSimRevenue = withSimGP.reduce((s, i) => s + i.simPrice * i.units_sold, 0);
    const totalSimCost = withSimGP.reduce((s, i) => s + i.unit_food_cost * i.units_sold, 0);
    const newFcPct = totalSimRevenue > 0 ? (totalSimCost / totalSimRevenue) * 100 : 0;
    const hasChanges = Object.keys(priceOverrides).length > 0;

    const newStars = simItems.filter(i => i.simClassification === 'star').length;
    const newDogs = simItems.filter(i => i.simClassification === 'dog').length;

    return {
      simulatedItems: simItems,
      summary: {
        changedCount,
        gpDelta,
        newFcPct,
        hasChanges,
        newAvgCM,
        newStars,
        newDogs,
      },
    };
  }, [items, stats, priceOverrides]);

  const handlePriceChange = useCallback(
    (productId: string, originalPrice: number, value: string) => {
      const numVal = parseFloat(value);
      if (isNaN(numVal) || numVal < 0) return;

      // If same as original, remove the override
      if (Math.abs(numVal - originalPrice) < 0.01) {
        setPriceOverrides((prev) => {
          const next = { ...prev };
          delete next[productId];
          return next;
        });
      } else {
        setPriceOverrides((prev) => ({ ...prev, [productId]: numVal }));
      }
    },
    [],
  );

  if (loading || !stats || items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            {loading ? 'Loading data...' : 'No menu data available. Select a date range with sales data.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Impact Summary */}
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-blue-500 to-emerald-500" />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-500" />
              What-If Simulator
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={resetAll}
              disabled={!summary?.hasChanges}
              className="gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset all
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Adjust selling prices below and see how classifications change in real-time. No data is saved.
          </p>
        </CardHeader>
        <CardContent>
          {summary?.hasChanges ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className={cn(
                "rounded-lg p-3 text-center",
                summary.changedCount > 0 ? "bg-amber-50 dark:bg-amber-950/20" : "bg-muted/30",
              )}>
                <p className="text-2xl font-bold">{summary.changedCount}</p>
                <p className="text-[10px] text-muted-foreground">Items reclassified</p>
              </div>
              <div className={cn(
                "rounded-lg p-3 text-center",
                summary.gpDelta > 0 ? "bg-emerald-50 dark:bg-emerald-950/20" : summary.gpDelta < 0 ? "bg-red-50 dark:bg-red-950/20" : "bg-muted/30",
              )}>
                <p className={cn("text-2xl font-bold", summary.gpDelta > 0 ? "text-emerald-600" : summary.gpDelta < 0 ? "text-red-600" : "")}>
                  {summary.gpDelta >= 0 ? '+' : ''}{formatCurrency(summary.gpDelta)}
                </p>
                <p className="text-[10px] text-muted-foreground">Monthly GP change</p>
              </div>
              <div className="rounded-lg p-3 text-center bg-muted/30">
                <p className="text-2xl font-bold">{summary.newFcPct.toFixed(1)}%</p>
                <p className="text-[10px] text-muted-foreground">Simulated FC%</p>
              </div>
              <div className="rounded-lg p-3 text-center bg-muted/30">
                <p className="text-2xl font-bold">{summary.newStars} ⭐</p>
                <p className="text-[10px] text-muted-foreground">Stars after changes</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-3 text-sm text-muted-foreground">
              Modify a price below to see the simulated impact
            </div>
          )}
        </CardContent>
      </Card>

      {/* Simulation Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-medium text-muted-foreground">Item</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Current Price</th>
                  <th className="text-right p-3 font-medium text-muted-foreground w-32">Simulated Price</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Δ GP</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Current</th>
                  <th className="text-center p-3 font-medium text-muted-foreground"></th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Simulated</th>
                </tr>
              </thead>
              <tbody>
                {simulatedItems.map((item) => {
                  const gpDelta = item.simGrossProfit - item.unit_gross_profit;
                  const hasOverride = item.product_id in priceOverrides;

                  return (
                    <tr
                      key={item.product_id}
                      className={cn(
                        "border-b hover:bg-muted/20 transition-colors",
                        item.changed && "bg-amber-50/50 dark:bg-amber-950/10",
                      )}
                    >
                      {/* Item name */}
                      <td className="p-3">
                        <div className="font-medium truncate max-w-[200px]">{item.name}</div>
                        <div className="text-[10px] text-muted-foreground">{item.category}</div>
                      </td>

                      {/* Current price */}
                      <td className="p-3 text-right font-mono text-muted-foreground">
                        €{item.selling_price_ex_vat.toFixed(2)}
                      </td>

                      {/* Simulated price input */}
                      <td className="p-3 text-right">
                        <Input
                          type="number"
                          step="0.50"
                          min="0"
                          value={priceOverrides[item.product_id]?.toFixed(2) ?? item.selling_price_ex_vat.toFixed(2)}
                          onChange={(e) =>
                            handlePriceChange(item.product_id, item.selling_price_ex_vat, e.target.value)
                          }
                          className={cn(
                            "w-28 text-right h-8 text-sm font-mono ml-auto",
                            hasOverride && "border-violet-400 ring-1 ring-violet-200",
                          )}
                        />
                      </td>

                      {/* GP delta */}
                      <td className="p-3 text-right">
                        {Math.abs(gpDelta) > 0.01 ? (
                          <div className={cn("flex items-center justify-end gap-1 font-medium",
                            gpDelta > 0 ? "text-emerald-600" : "text-red-600"
                          )}>
                            {gpDelta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {gpDelta > 0 ? '+' : ''}€{gpDelta.toFixed(2)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Current classification */}
                      <td className="p-3 text-center">
                        <Badge variant="outline" className={cn("text-xs", CLASS_COLOR[item.classification])}>
                          {CLASS_EMOJI[item.classification]} {CLASS_LABEL[item.classification]}
                        </Badge>
                      </td>

                      {/* Arrow */}
                      <td className="p-3 text-center">
                        {item.changed ? (
                          <ArrowRight className="h-4 w-4 text-amber-500 mx-auto" />
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </td>

                      {/* Simulated classification */}
                      <td className="p-3 text-center">
                        {item.changed ? (
                          <Badge className={cn(
                            "text-xs border-0",
                            item.simClassification === 'star' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                            item.simClassification === 'plow_horse' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                            item.simClassification === 'puzzle' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                            "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          )}>
                            {CLASS_EMOJI[item.simClassification]} {CLASS_LABEL[item.simClassification]}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">No change</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <p className="text-[11px] text-muted-foreground text-center">
        This simulator recalculates classifications using Kasavana-Smith (1982) methodology.
        Popularity thresholds remain unchanged — only profitability thresholds shift with price changes.
        No data is saved until you apply changes in your POS.
      </p>
    </div>
  );
}
