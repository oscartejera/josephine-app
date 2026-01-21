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
    return `${currency}${value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="border-border">
            <CardContent className="py-4 px-5">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Total Sales */}
      <Card className="border-border">
        <CardContent className="py-4 px-5">
          <p className="text-sm text-muted-foreground mb-1">Total Sales</p>
          <p className="text-2xl font-semibold text-foreground">
            {formatCurrency(totalSales)}
          </p>
        </CardContent>
      </Card>

      {/* Total Accounted Waste */}
      <Card className="border-border">
        <CardContent className="py-4 px-5">
          <p className="text-sm text-muted-foreground mb-1">Total Accounted Waste</p>
          <p className="text-2xl font-semibold text-foreground">
            {formatCurrency(totalAccountedWaste)}
          </p>
        </CardContent>
      </Card>

      {/* % of Sales */}
      <Card className="border-border">
        <CardContent className="py-4 px-5">
          <p className="text-sm text-muted-foreground mb-1">% Accounted Waste vs Sales</p>
          <p className="text-2xl font-semibold text-foreground">
            {wastePercentOfSales.toFixed(2)}%
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
