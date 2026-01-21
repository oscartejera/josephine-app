import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DollarSign, Users, Package, TrendingUp } from 'lucide-react';
import type { BudgetMetrics, BudgetTab } from '@/hooks/useBudgetsData';

interface BudgetKPICardsProps {
  metrics: BudgetMetrics;
  activeTab: BudgetTab;
  isLoading?: boolean;
  currency?: string;
}

function DeltaBadge({ value, suffix = '%', inverse = false }: { value: number; suffix?: string; inverse?: boolean }) {
  const isPositive = inverse ? value < 0 : value > 0;
  const isNegative = inverse ? value > 0 : value < 0;
  
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
      isPositive && "bg-success/10 text-success",
      isNegative && "bg-destructive/10 text-destructive",
      !isPositive && !isNegative && "bg-muted text-muted-foreground"
    )}>
      {value >= 0 ? '+' : ''}{value.toFixed(1)}{suffix}
    </span>
  );
}

function formatCurrency(value: number, currency = '€'): string {
  return `${currency}${value.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function KPICardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-4 w-20" />
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: BudgetMetrics['primeStatus'] }) {
  const styles = {
    on_track: 'bg-success/10 text-success',
    at_risk: 'bg-warning/10 text-warning',
    over_budget: 'bg-destructive/10 text-destructive',
  };

  const labels = {
    on_track: 'On Track',
    at_risk: 'At Risk',
    over_budget: 'Over Budget',
  };

  return (
    <Badge variant="outline" className={cn('text-xs', styles[status])}>
      {labels[status]}
    </Badge>
  );
}

export function BudgetKPICards({ metrics, activeTab, isLoading = false, currency = '€' }: BudgetKPICardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICardSkeleton />
        <KPICardSkeleton />
        <KPICardSkeleton />
        <KPICardSkeleton />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Sales vs Budget */}
      <Card className={cn(activeTab === 'sales' && 'ring-2 ring-primary')}>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">Sales vs Budget</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(metrics.salesActual, currency)}</div>
          <div className="text-sm text-muted-foreground">
            Budget: {formatCurrency(metrics.salesBudget, currency)}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <DeltaBadge value={metrics.salesVarPct} suffix="%" />
            <span className="text-xs text-muted-foreground">
              {metrics.salesVarEur >= 0 ? '+' : ''}{formatCurrency(metrics.salesVarEur, currency)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Labour vs Budget */}
      <Card className={cn(activeTab === 'labour' && 'ring-2 ring-primary')}>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">Labour vs Budget</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(metrics.labourActual, currency)}</div>
          <div className="text-sm text-muted-foreground">
            Budget: {formatCurrency(metrics.labourBudget, currency)}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <DeltaBadge value={metrics.labourVarPct} suffix="%" inverse />
            {metrics.labourHoursActual > 0 && (
              <span className="text-xs text-muted-foreground">
                {metrics.labourHoursActual.toFixed(0)}h
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* COGS vs Budget */}
      <Card className={cn(activeTab === 'cogs' && 'ring-2 ring-primary')}>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">COGS vs Budget</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">{formatCurrency(metrics.cogsActual, currency)}</span>
            <span className="text-sm text-muted-foreground">{metrics.cogsPctActual.toFixed(1)}%</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Budget: {formatCurrency(metrics.cogsBudget, currency)} ({metrics.cogsPctBudget.toFixed(1)}%)
          </div>
          <div className="flex items-center gap-2 mt-2">
            <DeltaBadge value={metrics.cogsVarPct} suffix="%" inverse />
          </div>
        </CardContent>
      </Card>

      {/* Prime Cost */}
      <Card className={cn(activeTab === 'prime' && 'ring-2 ring-primary')}>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">Prime Cost</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">{metrics.primePctActual.toFixed(1)}%</span>
            <StatusBadge status={metrics.primeStatus} />
          </div>
          <div className="text-sm text-muted-foreground">
            Budget: {metrics.primePctBudget.toFixed(1)}%
          </div>
          <div className="flex items-center gap-2 mt-2">
            <DeltaBadge value={metrics.primeVarPp} suffix="pp" inverse />
            <span className="text-xs text-muted-foreground">
              {formatCurrency(metrics.primeActual, currency)} vs {formatCurrency(metrics.primeBudget, currency)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
