import { Card, CardContent } from '@/components/ui/card';
import { Star, TrendingUp, Gem, Search, Info, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { MenuEngineeringStats } from '@/hooks/useMenuEngineeringData';

interface MenuEngineeringKPICardsProps {
  stats: MenuEngineeringStats | null;
  loading: boolean;
}

const CARDS = [
  { key: 'stars' as const, label: 'Stars', emoji: '⭐', icon: Star, color: 'success', description: 'Popular and profitable' },
  { key: 'plowHorses' as const, label: 'Plow Horses', emoji: '🐴', icon: TrendingUp, color: 'info', description: 'High volume but low margin' },
  { key: 'puzzles' as const, label: 'Puzzles', emoji: '💎', icon: Gem, color: 'warning', description: 'Highly profitable but low volume' },
  { key: 'dogs' as const, label: 'Dogs', emoji: '🔍', icon: Search, color: 'destructive', description: 'Low volume and low margin' },
];

function formatCurrency(value: number): string {
  return `€${value.toFixed(2)}`;
}

export function MenuEngineeringKPICards({ stats, loading }: MenuEngineeringKPICardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-6 w-20 mb-2" /><Skeleton className="h-10 w-16" /></CardContent></Card>)}
      </div>
    );
  }

  const borderColors = { success: 'border-l-success', info: 'border-l-info', warning: 'border-l-warning', destructive: 'border-l-destructive' };

  const lowConfidencePct = stats && stats.totalItems > 0
    ? Math.round((stats.lowConfidenceCount / stats.totalItems) * 100)
    : 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {CARDS.map((card) => (
          <Card key={card.key} className={`border-l-4 ${borderColors[card.color as keyof typeof borderColors]}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{card.emoji}</span>
                <span className="text-sm font-medium text-muted-foreground">{card.label}</span>
              </div>
              <div className="text-3xl font-bold text-foreground mb-1">{stats?.[card.key] ?? 0}</div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Thresholds & data quality row */}
      {stats && (
        <div className="flex flex-wrap items-center gap-4 px-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5" />
            <span>
              Popularity threshold: <strong>{stats.popThreshold.toFixed(1)}%</strong> ·
              GP threshold: <strong>{formatCurrency(stats.marginThreshold)}</strong> ·
              {stats.totalItems} products · {stats.totalUnits.toLocaleString()} units sold
            </span>
          </div>
          {lowConfidencePct > 30 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{lowConfidencePct}% of products without actual cost — approximate results</span>
            </div>
          )}
          {!stats.isCanonical && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Select a category for canonical analysis</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
