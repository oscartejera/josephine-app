import { Flame, Shield, AlertTriangle, XCircle, HelpCircle, TrendingUp, Calendar, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { DataQualityResult } from '@/hooks/useWasteDataQuality';

interface WasteDataQualityProps {
  result: DataQualityResult;
  isLoading: boolean;
}

const RATING_CONFIG: Record<DataQualityResult['rating'], {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  progressColor: string;
  icon: React.ReactNode;
}> = {
  excellent: {
    label: 'Excelente',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    progressColor: '[&>div]:bg-emerald-500',
    icon: <Shield className="h-4 w-4 text-emerald-500" />,
  },
  good: {
    label: 'Buena',
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    progressColor: '[&>div]:bg-blue-500',
    icon: <TrendingUp className="h-4 w-4 text-blue-500" />,
  },
  needs_improvement: {
    label: 'Mejorable',
    color: 'text-amber-600',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    progressColor: '[&>div]:bg-amber-500',
    icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  },
  poor: {
    label: 'Baja',
    color: 'text-red-600',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    progressColor: '[&>div]:bg-red-500',
    icon: <XCircle className="h-4 w-4 text-red-500" />,
  },
  no_data: {
    label: 'Sin datos',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50',
    borderColor: 'border-muted',
    progressColor: '',
    icon: <HelpCircle className="h-4 w-4 text-muted-foreground" />,
  },
};

export function WasteDataQuality({ result, isLoading }: WasteDataQualityProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="h-24 animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const config = RATING_CONFIG[result.rating];

  return (
    <Card className={`${config.borderColor} border`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Calidad de Datos
          </span>
          <Badge variant="outline" className={`${config.bgColor} ${config.color} border-0 text-xs`}>
            {config.icon}
            <span className="ml-1">{config.label}</span>
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score bar */}
        <div>
          <div className="flex items-end justify-between mb-1.5">
            <span className="text-2xl font-bold">{result.completenessScore}%</span>
            <span className="text-xs text-muted-foreground">
              {result.daysWithLogs}/{result.totalDays} días con registros
            </span>
          </div>
          <Progress
            value={result.completenessScore}
            className={`h-2 ${config.progressColor}`}
          />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {/* Streak */}
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Flame className={`h-3.5 w-3.5 ${result.currentStreak >= 7 ? 'text-orange-500' : result.currentStreak >= 3 ? 'text-amber-500' : 'text-muted-foreground'}`} />
              <span className="text-lg font-bold">{result.currentStreak}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Racha actual</p>
          </div>
          {/* Best streak */}
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Flame className="h-3.5 w-3.5 text-orange-500" />
              <span className="text-lg font-bold">{result.bestStreak}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Mejor racha</p>
          </div>
          {/* Avg logs/day */}
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <span className="text-lg font-bold">{result.avgLogsPerDay}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Logs/día</p>
          </div>
        </div>

        {/* Estimated capture rate */}
        <div className="flex items-center justify-between text-xs px-1">
          <span className="text-muted-foreground">Captura estimada de merma real</span>
          <span className={`font-medium ${config.color}`}>{result.estimatedCaptureRate}</span>
        </div>

        {/* Missing days */}
        {result.missingDays.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Días sin registros (últimos {Math.min(7, result.daysWithoutLogs)})
            </p>
            <div className="flex flex-wrap gap-1">
              {result.missingDays.map(day => (
                <Badge
                  key={day}
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 bg-red-500/5 text-red-600 border-red-500/20"
                >
                  {day}
                </Badge>
              ))}
              {result.daysWithoutLogs > 7 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  +{result.daysWithoutLogs - 7} más
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Recommendation */}
        <div className={`p-2.5 rounded-lg text-xs ${config.bgColor}`}>
          <p className={config.color}>{result.recommendation}</p>
        </div>
      </CardContent>
    </Card>
  );
}
