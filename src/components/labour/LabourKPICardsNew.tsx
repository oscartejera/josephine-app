/**
 * LabourKPICardsNew - 4 KPI cards matching Nory design
 * Sales, Projected Sales, Actual COL, Projected COL
 */

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { LabourKpis, LabourDateRange, MetricMode } from '@/hooks/useLabourDataNew';

interface LabourKPICardsNewProps {
  kpis: LabourKpis | undefined;
  isLoading: boolean;
  metricMode: MetricMode;
  dateRange: LabourDateRange;
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
  return `${value.toFixed(1)}h`;
}

interface DeltaBadgeProps {
  value: number;
  inverted?: boolean;
  label?: string;
}

function DeltaBadge({ value, inverted = false, label = 'vs forecast' }: DeltaBadgeProps) {
  // For COL, lower is better (inverted)
  const isPositive = inverted ? value <= 0 : value >= 0;
  const arrow = value >= 0 ? '▲' : '▼';
  
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
      isPositive 
        ? "bg-[hsl(var(--bi-badge-positive))] text-[hsl(var(--bi-badge-positive-text))]" 
        : "bg-[hsl(var(--bi-badge-negative))] text-[hsl(var(--bi-badge-negative-text))]"
    )}>
      <span className="text-[10px]">{arrow}</span>
      {Math.abs(value).toFixed(1)}% {label}
    </span>
  );
}

function KpiCardSkeleton() {
  return (
    <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm bg-card">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <Skeleton className="h-10 w-36 mb-2" />
        <Skeleton className="h-3 w-28" />
      </CardContent>
    </Card>
  );
}

export function LabourKPICardsNew({ kpis, isLoading, metricMode, dateRange }: LabourKPICardsNewProps) {
  if (isLoading || !kpis) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
      </div>
    );
  }

  const dateLabel = `${format(dateRange.from, 'd MMM')} - ${format(dateRange.to, 'd MMM')}`;

  // Determine display values based on metric mode
  const getActualColValue = () => {
    if (metricMode === 'percentage') return formatPercent(kpis.actual_col_pct);
    if (metricMode === 'amount') return formatCurrency(kpis.actual_labor_cost);
    return formatHours(kpis.actual_labor_hours);
  };

  const getPlannedColValue = () => {
    if (metricMode === 'percentage') return formatPercent(kpis.planned_col_pct);
    if (metricMode === 'amount') return formatCurrency(kpis.planned_labor_cost);
    return formatHours(kpis.planned_labor_hours);
  };

  const getActualLabel = () => {
    if (metricMode === 'percentage') return 'Actual COL';
    if (metricMode === 'amount') return 'Actual Labour Cost';
    return 'Actual Hours';
  };

  const getPlannedLabel = () => {
    if (metricMode === 'percentage') return 'Projected COL';
    if (metricMode === 'amount') return 'Projected Labour Cost';
    return 'Projected Hours';
  };

  const getColDelta = () => {
    if (metricMode === 'hours') return kpis.hours_delta_pct;
    return kpis.col_delta_pct;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Sales */}
      <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm bg-card">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-2">
            <span className="text-sm font-medium text-muted-foreground">Sales</span>
            <DeltaBadge value={kpis.sales_delta_pct} />
          </div>
          <div className="text-3xl font-bold tracking-tight mb-1">
            {formatCurrency(kpis.actual_sales)}
          </div>
          <p className="text-xs text-muted-foreground">{dateLabel}</p>
        </CardContent>
      </Card>

      {/* Projected Sales */}
      <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm bg-card">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-2">
            <span className="text-sm font-medium text-muted-foreground">Projected Sales</span>
          </div>
          <div className="text-3xl font-bold tracking-tight mb-1">
            {formatCurrency(kpis.forecast_sales)}
          </div>
          <p className="text-xs text-muted-foreground">{dateLabel}</p>
        </CardContent>
      </Card>

      {/* Actual COL / Labour Cost / Hours */}
      <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm bg-card">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-2">
            <span className="text-sm font-medium text-muted-foreground">{getActualLabel()}</span>
            <DeltaBadge value={getColDelta()} inverted={metricMode !== 'hours'} label="vs planned" />
          </div>
          <div className="text-3xl font-bold tracking-tight mb-1">
            {getActualColValue()}
          </div>
          <p className="text-xs text-muted-foreground">{dateLabel}</p>
        </CardContent>
      </Card>

      {/* Projected COL / Labour Cost / Hours */}
      <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm bg-card">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-2">
            <span className="text-sm font-medium text-muted-foreground">{getPlannedLabel()}</span>
          </div>
          <div className="text-3xl font-bold tracking-tight mb-1">
            {getPlannedColValue()}
          </div>
          <p className="text-xs text-muted-foreground">{dateLabel}</p>
        </CardContent>
      </Card>
    </div>
  );
}
