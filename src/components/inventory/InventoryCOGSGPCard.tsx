import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ViewMode } from './InventoryHeader';

interface InventoryCOGSGPCardProps {
  viewMode: ViewMode;
  actualPercent: number;
  actualAmount: number;
  theoreticalPercent: number;
  theoreticalAmount: number;
  gapPercent: number;
  gapAmount: number;
  totalSales: number;
  isLoading?: boolean;
  currency?: string;
}

export function InventoryCOGSGPCard({
  viewMode,
  actualPercent,
  actualAmount,
  theoreticalPercent,
  theoreticalAmount,
  gapPercent,
  gapAmount,
  totalSales,
  isLoading = false,
  currency = '€'
}: InventoryCOGSGPCardProps) {
  const isCOGS = viewMode === 'COGS';
  const title = isCOGS ? 'Cost of Goods Sold' : 'Gross Profit';
  const colorClass = isCOGS ? 'text-warning' : 'text-success';
  const bgColorClass = isCOGS ? 'bg-warning' : 'bg-success';
  const bgMutedClass = isCOGS ? 'bg-warning/20' : 'bg-success/20';

  // For COGS: gap is actual - theoretical (positive = bad)
  // For GP: gap is theoretical - actual (positive = bad)
  const isGapNegative = isCOGS ? gapAmount > 0 : gapAmount < 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-5 w-32" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const actualBarWidth = totalSales > 0 ? Math.min((actualAmount / totalSales) * 100 * (isCOGS ? 3 : 1.5), 100) : 0;
  const theoreticalBarWidth = totalSales > 0 ? Math.min((theoreticalAmount / totalSales) * 100 * (isCOGS ? 3 : 1.5), 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Actual */}
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <div className="flex items-baseline gap-2">
              <span className={cn("text-2xl font-bold", colorClass)}>{actualPercent.toFixed(1)}%</span>
              <span className="text-sm text-muted-foreground">Actual</span>
            </div>
            <span className="text-sm font-medium">{currency}{actualAmount.toLocaleString('es-ES', { minimumFractionDigits: 0 })}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div 
              className={cn("h-full rounded-full transition-all", bgColorClass)}
              style={{ width: `${actualBarWidth}%` }}
            />
          </div>
        </div>

        {/* Theoretical */}
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-semibold text-muted-foreground">{theoreticalPercent.toFixed(1)}%</span>
              <span className="text-sm text-muted-foreground">Theoretical</span>
            </div>
            <span className="text-sm font-medium text-muted-foreground">{currency}{theoreticalAmount.toLocaleString('es-ES', { minimumFractionDigits: 0 })}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div 
              className={cn("h-full rounded-full transition-all", bgMutedClass)}
              style={{ width: `${theoreticalBarWidth}%` }}
            />
          </div>
        </div>

        {/* Gap */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Gap</span>
            <div className="flex items-center gap-3">
              <span className={cn(
                "text-sm font-medium",
                isGapNegative ? "text-destructive" : "text-success"
              )}>
                {gapPercent >= 0 ? '+' : ''}{gapPercent.toFixed(1)}%
              </span>
              <span className={cn(
                "text-sm font-medium",
                isGapNegative ? "text-destructive" : "text-success"
              )}>
                {gapAmount >= 0 ? '+' : ''}{currency}{Math.abs(gapAmount).toLocaleString('es-ES', { minimumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
