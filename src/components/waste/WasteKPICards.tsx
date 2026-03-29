import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface WasteKPICardsProps {
  totalSales: number;
  totalAccountedWaste: number;
  wastePercentOfSales: number;
  wasteTarget?: number; // Configurable target %, default 3
  // Period deltas (vs previous period)
  prevTotalWaste?: number;
  prevWastePercent?: number;
  isLoading?: boolean;
  currency?: string;
}

export function WasteKPICards({
  totalSales,
  totalAccountedWaste,
  wastePercentOfSales,
  wasteTarget = 3.0,
  prevTotalWaste,
  prevWastePercent,
  isLoading = false,
  currency = '€'
}: WasteKPICardsProps) {
  const formatCurrency = (value: number) => {
    return `${currency}${value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Target-driven savings calculation
  const savingsPercent = wasteTarget - wastePercentOfSales;
  const savingsAmount = totalSales > 0 ? (savingsPercent / 100) * totalSales : 0;
  const isSaving = savingsPercent > 0;

  // Period delta calculations
  const wasteDelta = prevTotalWaste !== undefined
    ? ((totalAccountedWaste - prevTotalWaste) / Math.max(prevTotalWaste, 1)) * 100
    : null;
  const percentDelta = prevWastePercent !== undefined
    ? wastePercentOfSales - prevWastePercent
    : null;

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

      {/* Total Accounted Waste + Delta */}
      <Card className="border-border">
        <CardContent className="py-4 px-5">
          <p className="text-sm text-muted-foreground mb-1">Merma Registrada</p>
          <p className="text-2xl font-semibold text-foreground">
            {formatCurrency(totalAccountedWaste)}
          </p>
          {wasteDelta !== null && (
            <DeltaIndicator value={wasteDelta} suffix="% vs anterior" inverted />
          )}
        </CardContent>
      </Card>

      {/* % of Sales + Target + Delta */}
      <Card className="border-border">
        <CardContent className="py-4 px-5">
          <p className="text-sm text-muted-foreground mb-1">% Merma vs Ventas</p>
          <p className="text-2xl font-semibold text-foreground">
            {wastePercentOfSales.toFixed(2)}%
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-muted-foreground">
              Objetivo: {wasteTarget}%
            </p>
            {wastePercentOfSales <= wasteTarget ? (
              <span className="text-[10px] font-medium text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">✓ OK</span>
            ) : (
              <span className="text-[10px] font-medium text-red-600 bg-red-500/10 px-1.5 py-0.5 rounded">
                +{(wastePercentOfSales - wasteTarget).toFixed(1)}pp
              </span>
            )}
          </div>
          {percentDelta !== null && (
            <DeltaIndicator value={percentDelta} suffix="pp vs anterior" inverted unit="pp" />
          )}
        </CardContent>
      </Card>

      {/* Target-Driven Savings */}
      <Card className={`border-border ${isSaving ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
        <CardContent className="py-4 px-5">
          <div className="flex items-center gap-1.5 mb-1">
            {isSaving ? (
              <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
            )}
            <p className="text-sm text-muted-foreground">vs Objetivo ({wasteTarget}%)</p>
          </div>
          <p className={`text-2xl font-semibold ${isSaving ? 'text-emerald-500' : 'text-amber-500'}`}>
            {isSaving ? '+' : '-'}{formatCurrency(Math.abs(savingsAmount))}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isSaving
              ? `${savingsPercent.toFixed(1)}pp por debajo del objetivo`
              : `${Math.abs(savingsPercent).toFixed(1)}pp por encima del objetivo`
            }
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Inline delta indicator for period-over-period changes.
 * `inverted` means lower = good (waste going down is green).
 */
function DeltaIndicator({
  value,
  suffix = '',
  inverted = false,
  unit = '%',
}: {
  value: number;
  suffix?: string;
  inverted?: boolean;
  unit?: string;
}) {
  const isGood = inverted ? value < 0 : value > 0;
  const isNeutral = Math.abs(value) < 0.1;

  if (isNeutral) {
    return (
      <div className="flex items-center gap-1 mt-1">
        <Minus className="h-3 w-3 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">
          Sin cambio {suffix}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 mt-1">
      {value > 0 ? (
        <TrendingUp className={`h-3 w-3 ${isGood ? 'text-emerald-500' : 'text-red-500'}`} />
      ) : (
        <TrendingDown className={`h-3 w-3 ${isGood ? 'text-emerald-500' : 'text-red-500'}`} />
      )}
      <span className={`text-[11px] font-medium ${isGood ? 'text-emerald-600' : 'text-red-600'}`}>
        {value > 0 ? '+' : ''}{unit === 'pp' ? value.toFixed(1) : value.toFixed(1)}{unit === 'pp' ? 'pp' : '%'} {suffix}
      </span>
    </div>
  );
}
