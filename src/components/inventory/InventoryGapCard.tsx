import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ViewMode } from './InventoryHeader';
import { format } from 'date-fns';

interface InventoryGapCardProps {
  viewMode: ViewMode;
  gapPercent: number;
  gapAmount: number;
  accountedWaste: number;
  unaccountedWaste: number;
  surplus: number;
  isLoading?: boolean;
  currency?: string;
  dateRange?: { from: Date; to: Date };
  selectedLocations?: string[];
}

export function InventoryGapCard({
  viewMode,
  gapPercent,
  gapAmount,
  accountedWaste,
  unaccountedWaste,
  surplus,
  isLoading = false,
  currency = '€',
  dateRange,
  selectedLocations = []
}: InventoryGapCardProps) {
  const navigate = useNavigate();
  const isCOGS = viewMode === 'COGS';
  const isNegative = isCOGS ? gapAmount > 0 : gapAmount < 0;

  // Ensure gap = accounted + unaccounted + surplus
  // Recalculate to ensure consistency
  let adjustedUnaccounted = unaccountedWaste;
  let adjustedSurplus = surplus;
  
  // If values don't add up, adjust
  const currentSum = accountedWaste + unaccountedWaste + surplus;
  if (Math.abs(currentSum - gapAmount) > 0.01 && gapAmount !== 0) {
    // Recalculate: unaccounted = gap - accounted - surplus
    adjustedUnaccounted = gapAmount - accountedWaste - surplus;
    if (adjustedUnaccounted < 0) {
      adjustedUnaccounted = 0;
      adjustedSurplus = gapAmount - accountedWaste;
    }
  }
  
  const total = Math.abs(accountedWaste) + Math.abs(adjustedUnaccounted) + Math.abs(adjustedSurplus);
  const accountedPercent = total > 0 ? (Math.abs(accountedWaste) / total) * 100 : 33;
  const unaccountedPercent = total > 0 ? (Math.abs(adjustedUnaccounted) / total) * 100 : 33;
  const surplusPercent = total > 0 ? (Math.abs(adjustedSurplus) / total) * 100 : 34;

  const handleNavigateToWaste = () => {
    const params = new URLSearchParams();
    if (dateRange) {
      params.set('start_date', format(dateRange.from, 'yyyy-MM-dd'));
      params.set('end_date', format(dateRange.to, 'yyyy-MM-dd'));
    }
    if (selectedLocations.length === 1) {
      params.set('location_id', selectedLocations[0]);
    } else {
      params.set('location_id', 'all');
    }
    navigate(`/waste?${params.toString()}`);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-12" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-9 w-24 mb-2" />
          <Skeleton className="h-7 w-32 mb-4" />
          <Skeleton className="h-4 w-full mb-3" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-32" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Gap</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Main gap values */}
        <div className={cn(
          "text-3xl font-bold",
          isNegative ? "text-destructive" : "text-success"
        )}>
          {gapPercent >= 0 ? '+' : ''}{gapPercent.toFixed(1)}%
        </div>
        <div className={cn(
          "text-xl font-semibold mb-4",
          isNegative ? "text-destructive" : "text-success"
        )}>
          {gapAmount >= 0 ? '+' : ''}{currency}{Math.abs(gapAmount).toLocaleString('es-ES', { minimumFractionDigits: 0 })}
        </div>

        {/* Stacked bar */}
        <div className="h-3 rounded-full overflow-hidden bg-muted mb-4 flex">
          <div 
            className="bg-info h-full transition-all"
            style={{ width: `${accountedPercent}%` }}
          />
          <div 
            className="bg-info/40 h-full transition-all"
            style={{ width: `${unaccountedPercent}%` }}
          />
          <div 
            className="bg-muted-foreground/30 h-full transition-all"
            style={{ width: `${surplusPercent}%` }}
          />
        </div>

        {/* Legend */}
        <div className="space-y-1.5 text-sm">
          <button
            onClick={handleNavigateToWaste}
            className="flex items-center justify-between w-full hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-info" />
              <span className="text-muted-foreground hover:text-foreground">Accounted waste</span>
            </div>
            <span className="font-medium">{currency}{accountedWaste.toLocaleString('es-ES', { minimumFractionDigits: 0 })}</span>
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-info/40" />
              <span className="text-muted-foreground">Unaccounted waste</span>
            </div>
            <span className="font-medium">{currency}{adjustedUnaccounted.toLocaleString('es-ES', { minimumFractionDigits: 0 })}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-muted-foreground/30" />
              <span className="text-muted-foreground">Surplus</span>
            </div>
            <span className={cn(
              "font-medium",
              adjustedSurplus < 0 ? "text-destructive" : ""
            )}>
              {adjustedSurplus >= 0 ? '' : '-'}{currency}{Math.abs(adjustedSurplus).toLocaleString('es-ES', { minimumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
