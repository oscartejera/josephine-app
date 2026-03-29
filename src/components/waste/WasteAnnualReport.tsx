import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { CalendarDays, TrendingUp, TrendingDown, Minus, FileText } from 'lucide-react';
import type { AnnualReportResult } from '@/hooks/useWasteAnnualReport';

interface WasteAnnualReportProps {
  result: AnnualReportResult;
  isLoading?: boolean;
}

const TREND_CONFIG = {
  improving: { icon: TrendingDown, text: 'Mejorando', color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
  worsening: { icon: TrendingUp, text: 'Empeorando', color: 'text-red-600', bg: 'bg-red-500/10' },
  stable:    { icon: Minus, text: 'Estable', color: 'text-amber-600', bg: 'bg-amber-500/10' },
};

export function WasteAnnualReport({ result, isLoading = false }: WasteAnnualReportProps) {
  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-2"><Skeleton className="h-5 w-56" /></CardHeader>
        <CardContent><Skeleton className="h-[280px] w-full" /></CardContent>
      </Card>
    );
  }

  if (!result.isAvailable) {
    return (
      <Card className="border-border bg-muted/30">
        <CardContent className="py-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Informe anual no disponible</p>
              <p className="text-xs text-muted-foreground">
                Se necesitan datos de al menos 1 mes para generar el informe anual.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const trend = TREND_CONFIG[result.trendDirection];
  const TrendIcon = trend.icon;

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Informe Anual de Mermas
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/30">
              Ejecutivo
            </Badge>
          </CardTitle>
          <div className={`flex items-center gap-1 text-xs ${trend.color}`}>
            <TrendIcon className="h-3 w-3" />
            {trend.text} ({result.trendPercent > 0 ? '+' : ''}{result.trendPercent.toFixed(0)}%)
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Resumen ejecutivo — proyección anual basada en datos reales
        </p>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Executive summary cards */}
        <div className="grid grid-cols-5 gap-3">
          <SummaryCard label="Merma YTD" value={`€${result.ytdTotalWaste.toFixed(0)}`} />
          <SummaryCard label="Media % ventas" value={`${result.ytdAveragePercent.toFixed(2)}%`} />
          <SummaryCard label="Proyección anual" value={`€${result.projectedAnnualWaste.toFixed(0)}`} color="text-red-600" />
          <SummaryCard label="Mejor mes" value={result.ytdBestMonth || '-'} color="text-emerald-600" />
          <SummaryCard label="Peor mes" value={result.ytdWorstMonth || '-'} color="text-amber-600" />
        </div>

        {result.projectedSaving > 0 && (
          <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-foreground">💡 Si reduces al objetivo (3%)</p>
                <p className="text-xs text-muted-foreground">Ahorro anual estimado basado en proyección actual</p>
              </div>
              <p className="text-lg font-bold text-emerald-600">€{result.projectedSaving.toFixed(0)}/año</p>
            </div>
          </div>
        )}

        <Separator />

        {/* Monthly breakdown mini-chart using bars */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Evolución mensual</p>
          <div className="space-y-1">
            {result.monthlyData.map(month => {
              const maxWaste = Math.max(...result.monthlyData.map(m => m.wasteAmount));
              const barWidth = maxWaste > 0 ? (month.wasteAmount / maxWaste) * 100 : 0;
              const isWorst = month.month === result.ytdWorstMonth;
              const isBest = month.month === result.ytdBestMonth;

              return (
                <div key={month.monthNum} className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-8 text-right font-mono">{month.month}</span>
                  <div className="flex-1 h-5 bg-muted/30 rounded overflow-hidden relative">
                    <div
                      className={`h-full rounded transition-all ${
                        isWorst ? 'bg-red-400/60' :
                        isBest ? 'bg-emerald-400/60' :
                        'bg-primary/30'
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                    <span className="absolute right-2 top-0.5 text-[10px] text-muted-foreground">
                      €{month.wasteAmount.toFixed(0)} ({month.wastePercent.toFixed(1)}%)
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground w-16">{month.topReasonLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryCard({ label, value, color = 'text-foreground' }: {
  label: string; value: string; color?: string;
}) {
  return (
    <div className="p-2 rounded-lg bg-muted/50 text-center">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
    </div>
  );
}
