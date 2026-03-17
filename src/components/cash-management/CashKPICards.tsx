import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { DollarSign, CreditCard, RotateCcw, TrendingDown } from 'lucide-react';
import type { CashManagementMetrics } from '@/hooks/useCashManagementData';

interface CashKPICardsProps {
  metrics: CashManagementMetrics;
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

export function CashKPICards({ metrics, isLoading = false, currency = '€' }: CashKPICardsProps) {
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
      {/* Net Sales */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">Net Sales</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(metrics.netSales, currency)}</div>
          <div className="flex items-center gap-2 mt-1">
            <DeltaBadge value={metrics.netSalesDelta} suffix="% vs prev" />
          </div>
          <div className="flex gap-3 mt-3 text-xs text-muted-foreground">
            <span>Cash: {formatCurrency(metrics.paymentsCash, currency)}</span>
            <span>Card: {formatCurrency(metrics.paymentsCard, currency)}</span>
            {metrics.paymentsOther > 0 && <span>Other: {formatCurrency(metrics.paymentsOther, currency)}</span>}
          </div>
        </CardContent>
      </Card>

      {/* Cash Collected */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">Cash Collected</CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(metrics.cashExpected, currency)}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-muted-foreground">{metrics.cashPct.toFixed(1)}% of total</span>
            <DeltaBadge value={metrics.cashPctDelta} suffix="pp" />
          </div>
          {metrics.cashCounted !== null && (
            <div className="mt-3 text-xs">
              <span className="text-muted-foreground">Counted: {formatCurrency(metrics.cashCounted, currency)}</span>
              <span className={cn(
                "ml-2 font-medium",
                metrics.cashVariance! >= 0 ? "text-success" : "text-destructive"
              )}>
                Var: {metrics.cashVariance! >= 0 ? '+' : ''}{formatCurrency(metrics.cashVariance!, currency)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Refunds */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">Refunds</CardTitle>
          <RotateCcw className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-warning">{formatCurrency(metrics.refundsAmount, currency)}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-muted-foreground">{Math.round(metrics.refundsCount)} refunds</span>
            <DeltaBadge value={metrics.refundsDelta} suffix="% vs prev" inverse />
          </div>
        </CardContent>
      </Card>

      {/* Leakage */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">Leakage</CardTitle>
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-destructive">{formatCurrency(metrics.leakage, currency)}</span>
            <span className="text-sm text-muted-foreground">{metrics.leakagePct.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <DeltaBadge value={metrics.leakageDelta} suffix="% vs prev" inverse />
          </div>
          <div className="flex flex-wrap gap-2 mt-3 text-xs text-muted-foreground">
            <span>Disc: {formatCurrency(metrics.discountsAmount, currency)}</span>
            <span>Comps: {formatCurrency(metrics.compsAmount, currency)}</span>
            <span>Voids: {formatCurrency(metrics.voidsAmount, currency)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
