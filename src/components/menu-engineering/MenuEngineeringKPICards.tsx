import { Card, CardContent } from '@/components/ui/card';
import { Star, TrendingUp, HelpCircle, TrendingDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { MenuEngineeringStats } from '@/hooks/useMenuEngineeringData';

interface MenuEngineeringKPICardsProps {
  stats: MenuEngineeringStats | null;
  loading: boolean;
}

export function MenuEngineeringKPICards({ stats, loading }: MenuEngineeringKPICardsProps) {
  const cards = [
    {
      label: 'Stars',
      value: stats?.stars ?? 0,
      icon: Star,
      color: 'success',
      emoji: '⭐',
      description: 'Alta popularidad + alto margen',
    },
    {
      label: 'Plow Horses',
      value: stats?.plowHorses ?? 0,
      icon: TrendingUp,
      color: 'info',
      emoji: '🐴',
      description: 'Alta popularidad + bajo margen',
    },
    {
      label: 'Puzzles',
      value: stats?.puzzles ?? 0,
      icon: HelpCircle,
      color: 'warning',
      emoji: '🧩',
      description: 'Baja popularidad + alto margen',
    },
    {
      label: 'Dogs',
      value: stats?.dogs ?? 0,
      icon: TrendingDown,
      color: 'destructive',
      emoji: '🐕',
      description: 'Baja popularidad + bajo margen',
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card 
          key={card.label} 
          className={`border-l-4 ${
            card.color === 'success' ? 'border-l-success' :
            card.color === 'info' ? 'border-l-info' :
            card.color === 'warning' ? 'border-l-warning' :
            'border-l-destructive'
          }`}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <span>{card.emoji}</span>
                  <span>{card.label}</span>
                </p>
                <p className="text-2xl font-bold mt-1">{card.value}</p>
                <p className="text-xs text-muted-foreground mt-1 hidden md:block">
                  {card.description}
                </p>
              </div>
              <card.icon className={`h-8 w-8 ${
                card.color === 'success' ? 'text-success' :
                card.color === 'info' ? 'text-info' :
                card.color === 'warning' ? 'text-warning' :
                'text-destructive'
              }`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
