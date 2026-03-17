import { Card, CardContent } from '@/components/ui/card';
import { Info, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { MenuEngineeringStats } from '@/hooks/useMenuEngineeringData';

interface MenuEngineeringKPICardsProps {
  stats: MenuEngineeringStats | null;
  loading: boolean;
}

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000) return `€${(value / 1000).toFixed(1)}k`;
  return `€${value.toFixed(0)}`;
}

export function MenuEngineeringKPICards({ stats, loading }: MenuEngineeringKPICardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-6 w-20 mb-2" /><Skeleton className="h-10 w-16" /></CardContent></Card>)}
      </div>
    );
  }

  const lowConfidencePct = stats && stats.totalItems > 0
    ? Math.round((stats.lowConfidenceCount / stats.totalItems) * 100)
    : 0;

  const cards = [
    {
      emoji: '⭐',
      count: stats?.stars ?? 0,
      label: 'Stars',
      tagline: 'Your money makers',
      sublabel: 'Protect these dishes! Keep recipe consistent.',
      borderColor: 'border-l-emerald-500',
    },
    {
      emoji: '🐴',
      count: stats?.plowHorses ?? 0,
      label: 'Plow Horses',
      tagline: 'Popular but low margin',
      sublabel: 'Review food cost or raise price slightly.',
      borderColor: 'border-l-blue-500',
    },
    {
      emoji: '💎',
      count: stats?.puzzles ?? 0,
      label: 'Puzzles',
      tagline: 'Hidden gems',
      sublabel: 'Promote more — train waiters, better menu placement.',
      borderColor: 'border-l-amber-500',
    },
    {
      emoji: '🔍',
      count: stats?.dogs ?? 0,
      label: 'Dogs',
      tagline: 'Underperformers',
      sublabel: 'Rethink or remove. They cost you time & ingredients.',
      borderColor: 'border-l-red-500',
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.label} className={`border-l-4 ${card.borderColor}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xl">{card.emoji}</span>
                <span className="text-3xl font-bold text-foreground">{card.count}</span>
              </div>
              <p className="text-sm font-medium">{card.label}</p>
              <p className="text-xs text-muted-foreground font-medium">{card.tagline}</p>
              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{card.sublabel}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Context bar */}
      {stats && (
        <div className="flex flex-wrap items-center gap-4 px-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span>
              {stats.totalItems} products · {stats.totalUnits.toLocaleString()} plates sold ·
              Avg profit/plate: <strong>{formatCurrency(stats.marginThreshold)}</strong>
            </span>
          </div>
          {lowConfidencePct > 30 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>{lowConfidencePct}% of products have no recipe cost data — results may be approximate</span>
            </div>
          )}
          {!stats.isCanonical && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>Select a single category above for the most accurate analysis</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
