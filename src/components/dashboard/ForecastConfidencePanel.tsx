import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Brain, TrendingUp, TrendingDown, Calendar, BarChart3 } from 'lucide-react';
import { HourlyForecastWithActual, useAverageConfidence, useForecastAccuracy } from '@/hooks/useHourlyForecast';
import { cn } from '@/lib/utils';

interface ForecastConfidencePanelProps {
  forecasts: HourlyForecastWithActual[];
  className?: string;
}

interface Factor {
  name: string;
  value: number;
  icon: React.ReactNode;
  description: string;
}

export function ForecastConfidencePanel({ forecasts, className }: ForecastConfidencePanelProps) {
  const avgConfidence = useAverageConfidence(forecasts);
  const accuracy = useForecastAccuracy(forecasts);

  // Aggregate factors from all forecasts
  const aggregatedFactors = (() => {
    if (!forecasts || forecasts.length === 0) return [];

    const factorSums: Record<string, number[]> = {};
    
    for (const f of forecasts) {
      if (f.factors) {
        for (const [key, value] of Object.entries(f.factors)) {
          if (!factorSums[key]) factorSums[key] = [];
          factorSums[key].push(value as number);
        }
      }
    }

    const factors: Factor[] = [];

    if (factorSums.day_pattern) {
      const avg = factorSums.day_pattern.reduce((a, b) => a + b, 0) / factorSums.day_pattern.length;
      factors.push({
        name: 'Patrón del día',
        value: avg * 100,
        icon: <Calendar className="h-4 w-4" />,
        description: avg >= 0 ? 'Día típicamente fuerte' : 'Día típicamente débil',
      });
    }

    if (factorSums.trend) {
      const avg = factorSums.trend.reduce((a, b) => a + b, 0) / factorSums.trend.length;
      factors.push({
        name: 'Tendencia',
        value: avg * 100,
        icon: avg >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />,
        description: `${avg >= 0 ? '+' : ''}${(avg * 100).toFixed(1)}% vs periodo anterior`,
      });
    }

    if (factorSums.weight_distribution) {
      factors.push({
        name: 'Distribución horaria',
        value: 100,
        icon: <BarChart3 className="h-4 w-4" />,
        description: 'Basado en patrones de servicio',
      });
    }

    return factors;
  })();

  const modelVersion = forecasts[0]?.model_version || 'N/A';
  const isAI = modelVersion.startsWith('AI');

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 70) return 'text-primary';
    if (confidence >= 50) return 'text-amber-500';
    return 'text-destructive';
  };

  const getProgressColor = (confidence: number) => {
    if (confidence >= 70) return 'bg-primary';
    if (confidence >= 50) return 'bg-amber-500';
    return 'bg-destructive';
  };

  const getAccuracyVariant = (acc: number) => {
    if (acc >= 80) return 'default';
    if (acc >= 60) return 'secondary';
    return 'destructive';
  };

  if (!forecasts || forecasts.length === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          Confianza del Forecast
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main confidence score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Confianza del modelo</span>
            <span className={cn('text-2xl font-bold', getConfidenceColor(avgConfidence))}>
              {avgConfidence}%
            </span>
          </div>
          <Progress 
            value={avgConfidence} 
            className="h-2"
            // @ts-ignore - custom styling
            indicatorClassName={getProgressColor(avgConfidence)}
          />
        </div>

        {/* Accuracy (if available) */}
        {accuracy !== null && (
          <div className="flex items-center justify-between py-2 border-t">
            <span className="text-sm text-muted-foreground">Precisión ayer</span>
            <Badge variant={getAccuracyVariant(accuracy)}>
              {accuracy}%
            </Badge>
          </div>
        )}

        {/* Factors */}
        {aggregatedFactors.length > 0 && (
          <div className="space-y-3 pt-2 border-t">
            <span className="text-sm font-medium">Factores detectados</span>
            {aggregatedFactors.map((factor, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="mt-0.5 text-muted-foreground">{factor.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{factor.name}</span>
                    <span className={cn(
                      'text-sm font-mono',
                      factor.value >= 0 ? 'text-primary' : 'text-destructive'
                    )}>
                      {factor.value >= 0 ? '+' : ''}{factor.value.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{factor.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Model badge */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Modelo</span>
            <Badge variant={isAI ? 'default' : 'outline'} className="text-xs">
              {isAI ? '🤖 AI' : '📊 Stats'} {modelVersion}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
