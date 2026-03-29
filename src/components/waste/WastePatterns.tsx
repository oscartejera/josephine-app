import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Clock, RefreshCw, TrendingUp } from 'lucide-react';
import type { WastePattern } from '@/hooks/useWasteShiftAnalysis';

interface WastePatternsProps {
  patterns: WastePattern[];
  isLoading?: boolean;
}

const TYPE_ICONS: Record<string, typeof AlertTriangle> = {
  recurring_spike: Clock,
  shift_concentration: TrendingUp,
  reason_trend: AlertTriangle,
  item_repeat: RefreshCw,
};

const SEVERITY_STYLES: Record<string, { badge: string; border: string }> = {
  high:   { badge: 'bg-red-500/15 text-red-600 border-red-500/30', border: 'border-l-red-500' },
  medium: { badge: 'bg-amber-500/15 text-amber-600 border-amber-500/30', border: 'border-l-amber-500' },
  low:    { badge: 'bg-blue-500/15 text-blue-600 border-blue-500/30', border: 'border-l-blue-500' },
};

const SEVERITY_LABELS: Record<string, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

export function WastePatterns({ patterns, isLoading = false }: WastePatternsProps) {
  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-2"><Skeleton className="h-5 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-[160px] w-full" /></CardContent>
      </Card>
    );
  }

  if (patterns.length === 0) {
    return (
      <Card className="border-border bg-emerald-500/5">
        <CardContent className="py-5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <RefreshCw className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Sin patrones detectados</p>
              <p className="text-xs text-muted-foreground">
                No se detectan concentraciones anormales ni items recurrentes problemáticos.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <CardTitle className="text-sm font-medium text-foreground">
            Patrones Detectados
          </CardTitle>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {patterns.length}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Tendencias recurrentes y concentraciones anormales detectadas automáticamente
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {patterns.slice(0, 6).map(pattern => {
          const Icon = TYPE_ICONS[pattern.type] || AlertTriangle;
          const severity = SEVERITY_STYLES[pattern.severity];

          return (
            <div
              key={pattern.id}
              className={`rounded-lg border border-border border-l-[3px] ${severity.border} p-3 hover:bg-muted/20 transition-colors`}
            >
              <div className="flex items-start gap-2.5">
                <Icon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-foreground">{pattern.title}</span>
                    <Badge variant="outline" className={`text-[10px] font-normal ${severity.badge} border px-1.5 py-0`}>
                      {SEVERITY_LABELS[pattern.severity]}
                    </Badge>
                  </div>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">
                    {pattern.description}
                  </p>
                  <p className="text-[11px] font-medium text-foreground/70 mt-1 tabular-nums">
                    {pattern.metric}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
