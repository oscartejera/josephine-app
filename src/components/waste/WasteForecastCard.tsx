import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BrainCircuit, TrendingDown, TrendingUp, Minus, AlertTriangle, CheckCircle, Eye } from 'lucide-react';
import type { DayForecast, ForecastSummary } from '@/hooks/useWasteForecast';

interface WasteForecastCardProps {
  dailyForecasts: DayForecast[];
  summary: ForecastSummary;
  isReliable: boolean;
  isLoading?: boolean;
}

function fmt(value: number): string {
  return `€${value.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const RISK_STYLES: Record<string, { bg: string; text: string; icon: typeof CheckCircle }> = {
  ok:    { bg: 'bg-emerald-500/10', text: 'text-emerald-600', icon: CheckCircle },
  watch: { bg: 'bg-amber-500/10',   text: 'text-amber-600',   icon: Eye },
  alert: { bg: 'bg-red-500/10',     text: 'text-red-600',     icon: AlertTriangle },
};

const CONFIDENCE_BADGE: Record<string, string> = {
  high:   'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  medium: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  low:    'bg-gray-500/15 text-gray-500 border-gray-500/30',
};

const TREND_ICON: Record<string, typeof TrendingUp> = {
  improving: TrendingDown,
  stable: Minus,
  worsening: TrendingUp,
};

const TREND_LABEL: Record<string, { text: string; color: string }> = {
  improving: { text: 'Mejorando', color: 'text-emerald-500' },
  stable:    { text: 'Estable',   color: 'text-muted-foreground' },
  worsening: { text: 'Empeorando', color: 'text-red-500' },
};

export function WasteForecastCard({ dailyForecasts, summary, isReliable, isLoading = false }: WasteForecastCardProps) {
  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-2"><Skeleton className="h-5 w-52" /></CardHeader>
        <CardContent><Skeleton className="h-[200px] w-full" /></CardContent>
      </Card>
    );
  }

  if (!isReliable || dailyForecasts.length === 0) {
    return (
      <Card className="border-border bg-muted/20">
        <CardContent className="py-5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
              <BrainCircuit className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Predicciones no disponibles</p>
              <p className="text-xs text-muted-foreground">
                Se necesitan al menos 20 eventos y 2 semanas de datos para generar predicciones.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const TrendIcon = TREND_ICON[summary.trend];
  const trendInfo = TREND_LABEL[summary.trend];
  const maxPredicted = Math.max(...dailyForecasts.map(d => d.predictedValue), 1);

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-violet-500" />
            <CardTitle className="text-sm font-medium text-foreground">
              Predicción de Merma — Próxima Semana
            </CardTitle>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-violet-500/10 text-violet-600 border-violet-500/30">
              IA
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendIcon className={`h-3.5 w-3.5 ${trendInfo.color}`} />
            <span className={`text-xs font-medium ${trendInfo.color}`}>
              {trendInfo.text}
              {Math.abs(summary.trendPercent) > 1 && ` (${summary.trendPercent > 0 ? '+' : ''}${summary.trendPercent.toFixed(0)}%)`}
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Basado en patrones históricos por día de la semana (media móvil ponderada)
        </p>
      </CardHeader>
      <CardContent>
        {/* Summary row */}
        <div className="flex items-center gap-4 mb-4 p-2.5 rounded-lg bg-muted/20 border border-border/50">
          <div className="flex-1">
            <p className="text-[11px] text-muted-foreground">Merma prevista</p>
            <p className="text-lg font-bold tabular-nums text-foreground">{fmt(summary.totalPredictedWaste)}</p>
          </div>
          <div className="flex-1">
            <p className="text-[11px] text-muted-foreground">vs Objetivo semanal</p>
            <p className={`text-lg font-bold tabular-nums ${summary.projectedVsTarget > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
              {summary.projectedVsTarget > 0 ? '+' : ''}{fmt(summary.projectedVsTarget)}
            </p>
          </div>
          <div className="flex-1">
            <p className="text-[11px] text-muted-foreground">Día de mayor riesgo</p>
            <p className="text-lg font-bold tabular-nums text-foreground">{summary.highestRiskDay}</p>
          </div>
        </div>

        {/* Daily forecast bars */}
        <div className="space-y-2">
          {dailyForecasts.map(day => {
            const risk = RISK_STYLES[day.riskLevel];
            const RiskIcon = risk.icon;
            const barWidth = maxPredicted > 0 ? (day.predictedValue / maxPredicted) * 100 : 0;

            return (
              <div key={day.dateLabel} className="group">
                <div className="flex items-center gap-2.5">
                  {/* Day label */}
                  <div className="w-14 flex-shrink-0">
                    <span className="text-xs font-medium text-foreground">{day.dayLabel}</span>
                    <span className="text-[10px] text-muted-foreground ml-1">{day.dateLabel}</span>
                  </div>

                  {/* Risk icon */}
                  <div className={`h-5 w-5 rounded-full ${risk.bg} flex items-center justify-center flex-shrink-0`}>
                    <RiskIcon className={`h-3 w-3 ${risk.text}`} />
                  </div>

                  {/* Bar */}
                  <div className="flex-1 h-5 bg-muted/30 rounded-full overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        day.riskLevel === 'alert' ? 'bg-red-500/60' :
                        day.riskLevel === 'watch' ? 'bg-amber-500/50' :
                        'bg-violet-500/40'
                      }`}
                      style={{ width: `${Math.max(barWidth, 3)}%` }}
                    />
                  </div>

                  {/* Value */}
                  <div className="w-14 text-right flex-shrink-0">
                    <span className="text-xs font-medium tabular-nums text-foreground">
                      {fmt(day.predictedValue)}
                    </span>
                  </div>

                  {/* Confidence */}
                  <Badge variant="outline" className={`text-[9px] px-1 py-0 ${CONFIDENCE_BADGE[day.confidence]} flex-shrink-0`}>
                    {day.confidence === 'high' ? '●●●' : day.confidence === 'medium' ? '●●○' : '●○○'}
                  </Badge>
                </div>

                {/* Hover detail */}
                <div className="hidden group-hover:flex items-center gap-2 ml-[70px] mt-0.5 mb-1">
                  <span className="text-[10px] text-muted-foreground">
                    ~{day.predictedCount} eventos · motivo probable: {day.topExpectedReason} · media histórica: {fmt(day.historicalAvg)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
