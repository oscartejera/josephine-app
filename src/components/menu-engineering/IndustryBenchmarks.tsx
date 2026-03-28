import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MenuEngineeringItem, MenuEngineeringStats } from '@/hooks/useMenuEngineeringData';

interface IndustryBenchmarksProps {
  items: MenuEngineeringItem[];
  stats: MenuEngineeringStats | null;
  loading: boolean;
}

/**
 * Industry benchmarks for restaurant menu performance.
 *
 * Sources: NRA (National Restaurant Association), Deloitte, and industry averages.
 * These are reference points, not absolute rules — varies by cuisine and market.
 */
const BENCHMARKS = {
  foodCostPct: { label: 'Food Cost %', low: 25, ideal: 30, high: 35, unit: '%' },
  starsRatio: { label: 'Stars Ratio', low: 15, ideal: 25, high: 40, unit: '%' },
  dogsRatio: { label: 'Dogs Ratio', low: 5, ideal: 15, high: 25, unit: '%' },
  avgGpPerPlate: { label: 'Avg GP/Plate', low: 5, ideal: 10, high: 20, unit: '€' },
};

function getStatus(value: number, benchmark: typeof BENCHMARKS.foodCostPct, isInverted = false) {
  if (isInverted) {
    // Lower is better (FC%, Dogs ratio)
    if (value <= benchmark.low) return { status: 'great' as const, icon: <TrendingUp className="h-3.5 w-3.5" /> };
    if (value <= benchmark.ideal) return { status: 'good' as const, icon: <Minus className="h-3.5 w-3.5" /> };
    if (value <= benchmark.high) return { status: 'warning' as const, icon: <TrendingDown className="h-3.5 w-3.5" /> };
    return { status: 'bad' as const, icon: <TrendingDown className="h-3.5 w-3.5" /> };
  }
  // Higher is better (Stars ratio, GP/plate)
  if (value >= benchmark.high) return { status: 'great' as const, icon: <TrendingUp className="h-3.5 w-3.5" /> };
  if (value >= benchmark.ideal) return { status: 'good' as const, icon: <Minus className="h-3.5 w-3.5" /> };
  if (value >= benchmark.low) return { status: 'warning' as const, icon: <TrendingDown className="h-3.5 w-3.5" /> };
  return { status: 'bad' as const, icon: <TrendingDown className="h-3.5 w-3.5" /> };
}

const statusStyles = {
  great: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800',
  good: 'text-blue-600 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800',
  warning: 'text-amber-600 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800',
  bad: 'text-red-600 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
};

const statusLabel = {
  great: 'Above average',
  good: 'On target',
  warning: 'Below average',
  bad: 'Needs attention',
};

export function IndustryBenchmarks({ items, stats, loading }: IndustryBenchmarksProps) {
  if (loading || !stats || items.length === 0) return null;

  const totalRevenue = items.reduce((s, i) => s + i.selling_price_ex_vat * i.units_sold, 0);
  const totalFoodCost = items.reduce((s, i) => s + i.unit_food_cost * i.units_sold, 0);
  const avgFcPct = totalRevenue > 0 ? (totalFoodCost / totalRevenue) * 100 : 0;
  const starsRatio = items.length > 0 ? (stats.stars / items.length) * 100 : 0;
  const dogsRatio = items.length > 0 ? (stats.dogs / items.length) * 100 : 0;
  const avgGp = stats.marginThreshold;

  const metrics = [
    {
      ...BENCHMARKS.foodCostPct,
      value: avgFcPct,
      displayValue: `${avgFcPct.toFixed(1)}%`,
      ...getStatus(avgFcPct, BENCHMARKS.foodCostPct, true),
      tooltip: `Industry target: ${BENCHMARKS.foodCostPct.ideal}%. You're at ${avgFcPct.toFixed(1)}%.`,
      inverted: true,
    },
    {
      ...BENCHMARKS.starsRatio,
      value: starsRatio,
      displayValue: `${starsRatio.toFixed(0)}%`,
      ...getStatus(starsRatio, BENCHMARKS.starsRatio, false),
      tooltip: `${stats.stars} of ${items.length} items are Stars (${starsRatio.toFixed(0)}%). Target: ≥${BENCHMARKS.starsRatio.ideal}%.`,
      inverted: false,
    },
    {
      ...BENCHMARKS.dogsRatio,
      value: dogsRatio,
      displayValue: `${dogsRatio.toFixed(0)}%`,
      ...getStatus(dogsRatio, BENCHMARKS.dogsRatio, true),
      tooltip: `${stats.dogs} of ${items.length} items are Dogs (${dogsRatio.toFixed(0)}%). Target: ≤${BENCHMARKS.dogsRatio.ideal}%.`,
      inverted: true,
    },
    {
      ...BENCHMARKS.avgGpPerPlate,
      value: avgGp,
      displayValue: `€${avgGp.toFixed(2)}`,
      ...getStatus(avgGp, BENCHMARKS.avgGpPerPlate, false),
      tooltip: `Average gross profit per plate: €${avgGp.toFixed(2)}. Industry target: ≥€${BENCHMARKS.avgGpPerPlate.ideal}.`,
      inverted: false,
    },
  ];

  return (
    <Card className="overflow-hidden">
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Industry Benchmarks</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {metrics.map((m, idx) => (
            <TooltipProvider key={idx}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn('rounded-lg border p-2.5 cursor-help transition-colors', statusStyles[m.status])}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-medium opacity-70">{m.label}</span>
                      {m.icon}
                    </div>
                    <div className="text-lg font-bold">{m.displayValue}</div>
                    <div className="text-[10px] opacity-60">{statusLabel[m.status]}</div>

                    {/* Mini bar showing position in range */}
                    <div className="mt-1.5 h-1 rounded-full bg-current/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-current transition-all"
                        style={{
                          width: `${Math.min(100, m.inverted
                            ? Math.max(5, 100 - ((m.value - m.low) / (m.high - m.low)) * 100)
                            : Math.max(5, ((m.value - m.low) / (m.high - m.low)) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">{m.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
