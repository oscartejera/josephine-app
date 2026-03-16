import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface WasteKPICardsProps {
  totalSales: number;
  totalAccountedWaste: number;
  wastePercentOfSales: number;
  isLoading?: boolean;
  currency?: string;
}

const INDUSTRY_WASTE_BENCHMARK = 5.0; // Industry avg waste% without AI forecasting

export function WasteKPICards({
  const { t } = useTranslation();
  totalSales,
  totalAccountedWaste,
  wastePercentOfSales,
  isLoading = false,
  currency = '€'
}: WasteKPICardsProps) {
  const formatCurrency = (value: number) => {
    return `${currency}${value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Forecast-driven savings calculation
  const savingsPercent = INDUSTRY_WASTE_BENCHMARK - wastePercentOfSales;
  const savingsAmount = totalSales > 0 ? (savingsPercent / 100) * totalSales : 0;
  const isSaving = savingsPercent > 0;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Sales */}
      <Card className="border-border">
        <CardContent className="py-4 px-5">
          <p className="text-sm text-muted-foreground mb-1">Ventas Totales</p>
          <p className="text-2xl font-semibold text-foreground">
            {formatCurrency(totalSales)}
          </p>
        </CardContent>
      </Card>

      {/* Total Accounted Waste */}
      <Card className="border-border">
        <CardContent className="py-4 px-5">
          <p className="text-sm text-muted-foreground mb-1">Merma Registrada</p>
          <p className="text-2xl font-semibold text-foreground">
            {formatCurrency(totalAccountedWaste)}
          </p>
        </CardContent>
      </Card>

      {/* % of Sales */}
      <Card className="border-border">
        <CardContent className="py-4 px-5">
          <p className="text-sm text-muted-foreground mb-1">% Merma vs Ventas</p>
          <p className="text-2xl font-semibold text-foreground">
            {wastePercentOfSales.toFixed(2)}%
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Benchmark industria: {INDUSTRY_WASTE_BENCHMARK}%
          </p>
        </CardContent>
      </Card>

      {/* Forecast-Driven Savings */}
      <Card className={`border-border ${isSaving ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
        <CardContent className="py-4 px-5">
          <div className="flex items-center gap-1.5 mb-1">
            {isSaving ? (
              <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
            )}
            <p className="text-sm text-muted-foreground">Ahorro por Forecast</p>
          </div>
          <p className={`text-2xl font-semibold ${isSaving ? 'text-emerald-500' : 'text-amber-500'}`}>
            {isSaving ? '+' : ''}{formatCurrency(Math.abs(savingsAmount))}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isSaving
              ? `${savingsPercent.toFixed(1)}pp menos que sin AI`
              : `${Math.abs(savingsPercent).toFixed(1)}pp sobre benchmark`
            }
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
