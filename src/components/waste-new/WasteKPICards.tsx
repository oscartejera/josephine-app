import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { WasteMetrics } from '@/hooks/useWasteDataNew';

interface WasteKPICardsProps {
  metrics: WasteMetrics;
  isLoading?: boolean;
  currency?: string;
}

export function WasteKPICards({
  metrics,
  isLoading = false,
  currency = '€'
}: WasteKPICardsProps) {
  const formatCurrency = (value: number) => {
    return `${currency}${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="border-border">
            <CardContent className="py-5 px-6">
              <Skeleton className="h-4 w-28 mb-2" />
              <Skeleton className="h-8 w-36" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Total Sales */}
      <Card className="border-border bg-card">
        <CardContent className="py-5 px-6">
          <p className="text-sm text-muted-foreground mb-1">Total Sales</p>
          <p className="text-2xl font-semibold text-foreground tracking-tight">
            {formatCurrency(metrics.totalSales)}
          </p>
        </CardContent>
      </Card>

      {/* Total Accounted Waste */}
      <Card className="border-border bg-card">
        <CardContent className="py-5 px-6">
          <p className="text-sm text-muted-foreground mb-1">Total Accounted Waste</p>
          <p className="text-2xl font-semibold text-foreground tracking-tight">
            {formatCurrency(metrics.totalAccountedWaste)}
          </p>
        </CardContent>
      </Card>

      {/* % Waste vs Sales */}
      <Card className="border-border bg-card">
        <CardContent className="py-5 px-6">
          <p className="text-sm text-muted-foreground mb-1">% Accounted Waste vs Sales</p>
          <p className="text-2xl font-semibold text-foreground tracking-tight">
            {metrics.wastePercentOfSales.toFixed(2)}%
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
