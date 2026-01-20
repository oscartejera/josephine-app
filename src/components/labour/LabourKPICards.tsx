/**
 * Labour KPI Cards - 4 cards matching Nory design
 * Sales, Projected Sales, Actual COL, Projected COL
 */

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { LabourData, MetricMode } from '@/hooks/useLabourData';

interface LabourKPICardsProps {
  data: LabourData | undefined;
  isLoading: boolean;
  metricMode: MetricMode;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', { 
    style: 'currency', 
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function formatHours(value: number): string {
  return `${Math.round(value)}h`;
}

function DeltaBadge({ value, inverted = false }: { value: number; inverted?: boolean }) {
  // For COL, lower is better (inverted)
  const isPositive = inverted ? value <= 0 : value >= 0;
  
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
      isPositive 
        ? "bg-[hsl(var(--bi-badge-positive))] text-[hsl(var(--bi-badge-positive-text))]" 
        : "bg-[hsl(var(--bi-badge-negative))] text-[hsl(var(--bi-badge-negative-text))]"
    )}>
      {value >= 0 ? '+' : ''}{value.toFixed(1)}% vs forecast
    </span>
  );
}

function KpiCardSkeleton() {
  return (
    <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-10 w-32 mb-2" />
        <Skeleton className="h-4 w-20" />
      </CardContent>
    </Card>
  );
}

export function LabourKPICards({ data, isLoading, metricMode }: LabourKPICardsProps) {
  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
      </div>
    );
  }

  const { kpis } = data;

  // Determine display values based on metric mode for COL cards
  const getColValue = () => {
    if (metricMode === 'percentage') return formatPercent(kpis.colActual);
    if (metricMode === 'amount') return formatCurrency(kpis.labourCostActual);
    return formatHours(kpis.hoursActual);
  };

  const getColPlannedValue = () => {
    if (metricMode === 'percentage') return formatPercent(kpis.colPlanned);
    if (metricMode === 'amount') return formatCurrency(kpis.labourCostPlanned);
    return formatHours(kpis.hoursPlanned);
  };

  const getColLabel = () => {
    if (metricMode === 'percentage') return 'Actual COL';
    if (metricMode === 'amount') return 'Actual Labour Cost';
    return 'Actual Hours';
  };

  const getColPlannedLabel = () => {
    if (metricMode === 'percentage') return 'Projected COL';
    if (metricMode === 'amount') return 'Projected Labour Cost';
    return 'Projected Hours';
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Sales */}
      <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-2">
            <span className="text-sm text-muted-foreground">Sales</span>
            <DeltaBadge value={kpis.salesDelta} />
          </div>
          <div className="text-3xl font-bold tracking-tight mb-1">
            {formatCurrency(kpis.salesActual)}
          </div>
          <p className="text-xs text-muted-foreground">
            Actual sales in period
          </p>
        </CardContent>
      </Card>

      {/* Projected Sales */}
      <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-2">
            <span className="text-sm text-muted-foreground">Projected Sales</span>
          </div>
          <div className="text-3xl font-bold tracking-tight mb-1">
            {formatCurrency(kpis.salesProjected)}
          </div>
          <p className="text-xs text-muted-foreground">
            Forecast for period
          </p>
        </CardContent>
      </Card>

      {/* Actual COL / Labour Cost / Hours */}
      <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-2">
            <span className="text-sm text-muted-foreground">{getColLabel()}</span>
            <DeltaBadge value={kpis.colDelta} inverted />
          </div>
          <div className="text-3xl font-bold tracking-tight mb-1">
            {getColValue()}
          </div>
          <p className="text-xs text-muted-foreground">
            vs planned
          </p>
        </CardContent>
      </Card>

      {/* Projected COL / Labour Cost / Hours */}
      <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-2">
            <span className="text-sm text-muted-foreground">{getColPlannedLabel()}</span>
          </div>
          <div className="text-3xl font-bold tracking-tight mb-1">
            {getColPlannedValue()}
          </div>
          <p className="text-xs text-muted-foreground">
            Target for period
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
