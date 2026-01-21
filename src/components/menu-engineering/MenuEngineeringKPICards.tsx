import { Card, CardContent } from '@/components/ui/card';
import { Star, TrendingUp, Gem, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { MenuEngineeringStats } from '@/hooks/useMenuEngineeringData';

interface MenuEngineeringKPICardsProps {
  stats: MenuEngineeringStats | null;
  loading: boolean;
}

const CARDS = [
  { key: 'stars' as const, label: 'Estrellas', emoji: '⭐', icon: Star, color: 'success', description: 'Populares y rentables' },
  { key: 'plowHorses' as const, label: 'Caballos de batalla', emoji: '🐴', icon: TrendingUp, color: 'info', description: 'Venden mucho pero dejan poco' },
  { key: 'puzzles' as const, label: 'Joyas ocultas', emoji: '💎', icon: Gem, color: 'warning', description: 'Muy rentables pero venden poco' },
  { key: 'dogs' as const, label: 'A revisar', emoji: '🔍', icon: Search, color: 'destructive', description: 'Ni venden ni dejan margen' },
];

export function MenuEngineeringKPICards({ stats, loading }: MenuEngineeringKPICardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-6 w-20 mb-2" /><Skeleton className="h-10 w-16" /></CardContent></Card>)}
      </div>
    );
  }

  const borderColors = { success: 'border-l-success', info: 'border-l-info', warning: 'border-l-warning', destructive: 'border-l-destructive' };

  return (
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
  );
}
