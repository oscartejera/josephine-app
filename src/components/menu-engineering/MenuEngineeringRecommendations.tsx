import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, TrendingUp, HelpCircle, TrendingDown, Lightbulb } from 'lucide-react';
import type { Classification } from '@/hooks/useMenuEngineeringData';

interface Recommendation {
  type: Classification;
  title: string;
  description: string;
  items: string[];
}

interface MenuEngineeringRecommendationsProps {
  recommendations: Recommendation[];
  loading: boolean;
}

const ICONS: Record<Classification, React.ElementType> = {
  star: Star,
  plow_horse: TrendingUp,
  puzzle: HelpCircle,
  dog: TrendingDown,
};

const COLORS: Record<Classification, { bg: string; border: string; text: string }> = {
  star: {
    bg: 'bg-success/5',
    border: 'border-l-success',
    text: 'text-success',
  },
  plow_horse: {
    bg: 'bg-info/5',
    border: 'border-l-info',
    text: 'text-info',
  },
  puzzle: {
    bg: 'bg-warning/5',
    border: 'border-l-warning',
    text: 'text-warning',
  },
  dog: {
    bg: 'bg-destructive/5',
    border: 'border-l-destructive',
    text: 'text-destructive',
  },
};

export function MenuEngineeringRecommendations({ recommendations, loading }: MenuEngineeringRecommendationsProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Acciones Recomendadas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Acciones Recomendadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            No hay recomendaciones disponibles
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          Acciones Recomendadas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {recommendations.map((rec, i) => {
          const Icon = ICONS[rec.type];
          const colors = COLORS[rec.type];

          return (
            <div
              key={i}
              className={`p-4 rounded-lg border-l-4 ${colors.border} ${colors.bg}`}
            >
              <div className="flex items-start gap-3">
                <Icon className={`h-5 w-5 mt-0.5 ${colors.text}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{rec.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {rec.description}
                  </p>
                  {rec.items.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      <span className="font-medium">Productos: </span>
                      {rec.items.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
