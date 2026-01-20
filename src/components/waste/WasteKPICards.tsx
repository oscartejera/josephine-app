import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface WasteKPICardsProps {
  totalSales: number;
  totalAccountedWaste: number;
  wastePercentOfSales: number;
  isLoading?: boolean;
  currency?: string;
}

export function WasteKPICards({
  totalSales,
  totalAccountedWaste,
  wastePercentOfSales,
  isLoading = false,
  currency = '€'
}: WasteKPICardsProps) {
  const formatCurrency = (value: number) => {
    return `${currency}${value.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="border-[hsl(var(--bi-border))]">
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-10 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Total Sales */}
      <Card className="border-[hsl(var(--bi-border))] shadow-sm">
        <CardContent className="pt-6">
          <p className="text-sm font-medium text-muted-foreground mb-1">Total Sales</p>
          <p className="text-3xl font-bold text-foreground">
            {formatCurrency(totalSales)}
          </p>
        </CardContent>
      </Card>

      {/* Total Accounted Waste */}
      <Card className="border-[hsl(var(--bi-border))] shadow-sm">
        <CardContent className="pt-6">
          <p className="text-sm font-medium text-muted-foreground mb-1">Total Accounted Waste</p>
          <p className="text-3xl font-bold text-destructive">
            {formatCurrency(totalAccountedWaste)}
          </p>
        </CardContent>
      </Card>

      {/* % of Sales */}
      <Card className="border-[hsl(var(--bi-border))] shadow-sm">
        <CardContent className="pt-6">
          <p className="text-sm font-medium text-muted-foreground mb-1">% Accounted Waste vs Sales</p>
          <p className="text-3xl font-bold text-foreground">
            {wastePercentOfSales.toFixed(2)}%
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
