import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Trophy, Eye, Moon, XCircle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PavesicAnalysisResult, PavesicClassification } from '@/hooks/usePavesicAnalysis';
import type { Classification } from '@/hooks/useMenuEngineeringData';

interface PavesicAnalysisProps {
  result: PavesicAnalysisResult | null;
  loading: boolean;
}

/* ────────── Labels for restaurateurs (no jargon) ────────── */

const PAVESIC_UI: Record<PavesicClassification, {
  emoji: string; label: string; color: string; bg: string; advice: string;
}> = {
  prime: {
    emoji: '🏆', label: 'Top Performer', color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800',
    advice: 'Best dish — high profit, low cost. Protect it.',
  },
  standard: {
    emoji: '👀', label: 'Watch Cost', color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800',
    advice: 'Makes money but costs are high. Negotiate suppliers or reduce portion.',
  },
  sleeper: {
    emoji: '💤', label: 'Hidden Gem', color: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800',
    advice: 'Low cost, good margins — just needs more sales. Promote it.',
  },
  problem: {
    emoji: '⚠️', label: 'Needs Action', color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
    advice: 'Expensive to make and barely sells. Reformulate or remove.',
  },
};

const KASAVANA_EMOJI: Record<string, string> = {
  star: '⭐', plow_horse: '🐴', puzzle: '💎', dog: '🔍',
};

const KASAVANA_LABEL: Record<string, string> = {
  star: 'Star', plow_horse: 'Plow Horse', puzzle: 'Puzzle', dog: 'Dog',
};

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatCurrency(value: number): string {
  return `€${value.toFixed(2)}`;
}

export function PavesicAnalysis({ result, loading }: PavesicAnalysisProps) {
  const [filter, setFilter] = useState<PavesicClassification | 'disagreement' | null>(null);

  const filteredItems = useMemo(() => {
    if (!result) return [];
    if (!filter) return result.items;
    if (filter === 'disagreement') return result.disagreement_items;
    return result.items.filter((i) => i.pavesic_classification === filter);
  }, [result, filter]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground animate-pulse">Analyzing cost efficiency...</p>
        </CardContent>
      </Card>
    );
  }

  if (!result || result.items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">No data available for cost analysis.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Classification summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(['prime', 'standard', 'sleeper', 'problem'] as PavesicClassification[]).map((cls) => {
          const ui = PAVESIC_UI[cls];
          const count = result[`${cls}s` as keyof PavesicAnalysisResult] as number;
          const isActive = filter === cls;
          return (
            <Card
              key={cls}
              onClick={() => setFilter(isActive ? null : cls)}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md border",
                isActive ? ui.bg + ' ring-2 ring-offset-1 ring-current ' + ui.color : 'hover:border-muted-foreground/30',
              )}
            >
              <CardContent className="py-4 px-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-2xl">{ui.emoji}</span>
                  <span className="text-2xl font-bold">{count}</span>
                </div>
                <p className={cn("text-sm font-semibold", ui.color)}>{ui.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{ui.advice}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Disagreement alert */}
      {result.disagreement_count > 0 && (
        <Card
          onClick={() => setFilter(filter === 'disagreement' ? null : 'disagreement')}
          className={cn(
            "cursor-pointer transition-all border-amber-300 dark:border-amber-700",
            filter === 'disagreement'
              ? 'bg-amber-50 dark:bg-amber-950/30 ring-2 ring-amber-400 ring-offset-1'
              : 'bg-amber-50/50 dark:bg-amber-950/10 hover:bg-amber-50 dark:hover:bg-amber-950/20',
          )}
        >
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  {result.disagreement_count} dish{result.disagreement_count !== 1 ? 'es' : ''} need a second look
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400/70">
                  The popularity analysis and cost analysis disagree. Click to see which dishes.
                </p>
              </div>
              <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300 shrink-0">
                {result.disagreement_count}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Thresholds context bar */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
        <span>Avg Food Cost: <strong className="text-foreground">{formatPct(result.avg_food_cost_pct)}</strong></span>
        <span className="text-muted-foreground/30">|</span>
        <span>Avg Weighted Profit: <strong className="text-foreground">{formatCurrency(result.avg_weighted_cm)}</strong></span>
        <span className="text-muted-foreground/30">|</span>
        <span>Showing: <strong className="text-foreground">
          {!filter ? 'All items' : filter === 'disagreement' ? 'Disagreements only' : PAVESIC_UI[filter].label}
        </strong></span>
      </div>

      {/* Items table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-medium text-muted-foreground">Dish</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Price</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Food Cost %</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Profit / plate</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Popularity</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Cost Check</th>
                  <th className="text-center p-3 font-medium text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const pui = PAVESIC_UI[item.pavesic_classification];
                  return (
                    <tr
                      key={item.product_id}
                      className={cn(
                        "border-b hover:bg-muted/20 transition-colors",
                        item.has_disagreement && 'bg-amber-50/40 dark:bg-amber-950/10',
                      )}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="font-medium truncate max-w-[160px]">{item.name}</div>
                          {item.has_disagreement && (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{item.category}</div>
                      </td>

                      <td className="p-3 text-right font-mono text-muted-foreground">
                        {formatCurrency(item.selling_price)}
                      </td>

                      <td className="p-3 text-right">
                        <span className={cn(
                          "font-mono text-sm",
                          item.food_cost_pct > 35 ? "text-red-600" :
                          item.food_cost_pct > 30 ? "text-amber-600" : "text-emerald-600",
                        )}>
                          {formatPct(item.food_cost_pct)}
                        </span>
                      </td>

                      <td className="p-3 text-right font-mono">
                        {formatCurrency(item.unit_gross_profit)}
                      </td>

                      {/* Kasavana-Smith classification */}
                      <td className="p-3 text-center">
                        <Badge variant="outline" className="text-xs gap-1">
                          {KASAVANA_EMOJI[item.kasavana_classification]}
                          {KASAVANA_LABEL[item.kasavana_classification] ?? item.kasavana_classification}
                        </Badge>
                      </td>

                      {/* Pavesic classification */}
                      <td className="p-3 text-center">
                        <Badge className={cn("text-xs border-0 gap-1", pui.bg, pui.color)}>
                          {pui.emoji} {pui.label}
                        </Badge>
                      </td>

                      {/* Disagreement indicator */}
                      <td className="p-3 text-center w-8">
                        {item.has_disagreement && (
                          <span className="text-amber-500 text-xs font-medium" title="Popularity says one thing, cost says another">
                            ⚡
                          </span>
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

      {/* Simple footer explanation */}
      <p className="text-[11px] text-muted-foreground text-center px-4">
        <strong>Popularity analysis</strong> (Star/Plow Horse/Puzzle/Dog) looks at profit and demand.
        <strong> Cost check</strong> (above) adds food cost % as a safety net — a dish can look profitable but have unsustainable costs.
        ⚡ = the two analyses disagree.
      </p>
    </div>
  );
}
