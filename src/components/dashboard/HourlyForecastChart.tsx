import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Bar,
  ComposedChart,
  ReferenceLine,
} from 'recharts';
import { Brain, RefreshCw, TrendingUp, AlertCircle } from 'lucide-react';
import { HourlyForecastWithActual, useAverageConfidence, useForecastAccuracy } from '@/hooks/useHourlyForecast';
import { cn } from '@/lib/utils';

interface HourlyForecastChartProps {
  data: HourlyForecastWithActual[];
  isLoading?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  className?: string;
  showActuals?: boolean;
}

export function HourlyForecastChart({
  data,
  isLoading,
  onRefresh,
  isRefreshing,
  className,
  showActuals = true,
}: HourlyForecastChartProps) {
  const avgConfidence = useAverageConfidence(data);
  const accuracy = useForecastAccuracy(data);

  const chartData = useMemo(() => {
    // Generate full hourly range (10:00 - 23:00)
    const hours = Array.from({ length: 14 }, (_, i) => 10 + i);
    
    if (!data || data.length === 0) {
      // Generate placeholder data for empty state
      return hours.map(h => ({
        hour: `${h}:00`,
        forecast: 0,
        actual: undefined,
        confidence: 0,
      }));
    }

    // Map data to full hour range
    const dataMap = new Map(data.map(d => [d.hour, d]));
    
    return hours.map(h => {
      const d = dataMap.get(h);
      return {
        hour: `${h}:00`,
        forecast: d?.forecast_sales || 0,
        actual: d?.actual_sales,
        confidence: d?.confidence || 0,
        covers: d?.forecast_covers || 0,
        actualCovers: d?.actual_covers,
      };
    });
  }, [data]);

  const hasActuals = chartData.some((d) => d.actual !== undefined && d.actual > 0);
  const hasForecast = chartData.some((d) => d.forecast > 0);
  const modelVersion = data[0]?.model_version || (hasActuals ? 'POS Data' : 'N/A');
  const isAI = modelVersion.startsWith('AI');
  const isGenerating = isRefreshing;

  const getConfidenceBadgeVariant = (confidence: number) => {
    if (confidence >= 70) return 'default';
    if (confidence >= 50) return 'secondary';
    return 'outline';
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-6 w-24" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              {isAI && <Brain className="h-5 w-5 text-primary" />}
              Ventas por Hora
            </CardTitle>
            {avgConfidence > 0 && (
              <Badge variant={getConfidenceBadgeVariant(avgConfidence)} className="text-xs">
                {avgConfidence}% confianza
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {accuracy !== null && (
              <Badge variant="outline" className="text-xs">
                <TrendingUp className="h-3 w-3 mr-1" />
                {accuracy}% precisión
              </Badge>
            )}
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="h-8"
              >
                <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
              </Button>
            )}
          </div>
        </div>
        {!hasForecast && !hasActuals && !isGenerating && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
            <AlertCircle className="h-4 w-4" />
            <span>Sin datos. Pulsa refrescar para generar forecast.</span>
          </div>
        )}
        {isGenerating && (
          <div className="flex items-center gap-2 text-sm text-primary mt-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Generando forecast con IA...</span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorForecastArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="hour"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value) => `€${value}`}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    forecast: 'Forecast',
                    actual: 'Real',
                  };
                  return [`€${value.toFixed(2)}`, labels[name] || name];
                }}
                labelFormatter={(label) => `Hora: ${label}`}
              />
              <Legend
                formatter={(value) => {
                  const labels: Record<string, string> = {
                    forecast: 'Forecast AI',
                    actual: 'Ventas Reales',
                  };
                  return labels[value] || value;
                }}
              />
              
              {/* Forecast area + line */}
              <Area
                type="monotone"
                dataKey="forecast"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                strokeDasharray="5 5"
                fill="url(#colorForecastArea)"
                name="forecast"
              />
              
              {/* Actual bars (if available) */}
              {showActuals && hasActuals && (
                <Bar
                  dataKey="actual"
                  fill="hsl(var(--primary))"
                  name="actual"
                  radius={[4, 4, 0, 0]}
                  opacity={0.8}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Model info footer */}
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>Modelo: {modelVersion}</span>
          {data[0]?.generated_at && (
            <span>
              Generado: {new Date(data[0].generated_at).toLocaleString('es-ES', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
