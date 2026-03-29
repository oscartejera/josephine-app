import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingDown, DollarSign, Target, AlertTriangle } from 'lucide-react';
import type { WasteMetrics } from '@/hooks/useWasteData';

interface WastePnLImpactProps {
  metrics: WasteMetrics;
  wasteTarget: number;
  isLoading?: boolean;
}

function fmt(value: number): string {
  return `€${value.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function WastePnLImpact({ metrics, wasteTarget, isLoading = false }: WastePnLImpactProps) {
  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-2"><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent><Skeleton className="h-[160px] w-full" /></CardContent>
      </Card>
    );
  }

  const { totalSales, totalAccountedWaste, wastePercentOfSales } = metrics;
  const isOnTarget = wastePercentOfSales <= wasteTarget;
  const annualizedWaste = totalAccountedWaste * 12;
  const wastePerThousand = totalSales > 0 ? (totalAccountedWaste / totalSales) * 1000 : 0;
  const potentialSavings = !isOnTarget
    ? ((wastePercentOfSales - wasteTarget) / 100) * totalSales
    : 0;
  const currentSavings = isOnTarget
    ? ((wasteTarget - wastePercentOfSales) / 100) * totalSales
    : 0;

  const indicators = [
    {
      icon: DollarSign,
      label: 'Merma por €1.000 ventas',
      value: fmt(wastePerThousand),
      sublabel: 'Coste marginal de merma',
      color: 'text-foreground',
    },
    {
      icon: TrendingDown,
      label: 'Impacto anualizado',
      value: fmt(annualizedWaste),
      sublabel: 'Si se mantiene el ritmo actual',
      color: annualizedWaste > 0 ? 'text-red-500' : 'text-foreground',
    },
    {
      icon: Target,
      label: isOnTarget ? 'Ahorro vs objetivo' : 'Ahorro potencial',
      value: isOnTarget ? `+${fmt(currentSavings)}` : fmt(potentialSavings),
      sublabel: isOnTarget
        ? `Estás ${(wasteTarget - wastePercentOfSales).toFixed(1)}pp por debajo`
        : `Si reduces a ${wasteTarget}%`,
      color: isOnTarget ? 'text-emerald-500' : 'text-amber-500',
    },
    {
      icon: AlertTriangle,
      label: 'Inflación de food cost',
      value: `+${wastePercentOfSales.toFixed(2)}pp`,
      sublabel: 'La merma incrementa tu food cost real',
      color: wastePercentOfSales > 5 ? 'text-red-500' : wastePercentOfSales > 3 ? 'text-amber-500' : 'text-foreground',
    },
  ];

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-red-400" />
          <CardTitle className="text-sm font-medium text-foreground">Impacto en P&L</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">Cómo la merma afecta directamente a tu cuenta de resultados</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {indicators.map((ind, i) => {
            const Icon = ind.icon;
            return (
              <div key={i} className="rounded-lg bg-muted/20 p-3 border border-border/50">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">{ind.label}</span>
                </div>
                <p className={`text-lg font-bold tabular-nums ${ind.color}`}>{ind.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{ind.sublabel}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
