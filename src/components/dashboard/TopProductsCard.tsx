import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, Package, AlertCircle } from 'lucide-react';
import { useTopProductsHonest, type ProductMetric } from '@/hooks/useTopProductsHonest';
import { cn } from '@/lib/utils';
import type { DateRange } from '@/hooks/useDashboardMetrics';

interface TopProductsCardProps {
  dateRange: DateRange;
  className?: string;
}

function formatCurrency(value: number): string {
  return `€${value.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function MissingCell({ reason }: { reason: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-0.5 text-muted-foreground/50 cursor-help">
            —
            <AlertCircle className="h-3 w-3 text-amber-500" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {reason}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const metricLabels: Record<ProductMetric, string> = {
  share: '% Ventas',
  gp_eur: 'GP €',
  gp_pct: 'GP %',
};

export function TopProductsCard({ dateRange, className }: TopProductsCardProps) {
  const [metric, setMetric] = useState<ProductMetric>('share');

  const { data: products, isLoading } = useTopProductsHonest({ dateRange, metric });

  const showEmptyState = !isLoading && (!products || products.length === 0);

  return (
    <Card className={cn('col-span-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Top 10 Productos
          </CardTitle>

          {/* Metric selector only — date range comes from Dashboard */}
          <Select
            value={metric}
            onValueChange={(v) => setMetric(v as ProductMetric)}
          >
            <SelectTrigger className="w-[120px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(metricLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : showEmptyState ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay datos de productos</h3>
            <p className="text-muted-foreground max-w-sm">
              No se encontraron ventas de productos para el periodo y ubicación seleccionados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Uds</TableHead>
                  <TableHead className="text-right">Ventas</TableHead>
                  <TableHead className="text-right">% Ventas</TableHead>
                  <TableHead className="text-right">COGS</TableHead>
                  <TableHead className="text-right">GP €</TableHead>
                  <TableHead className="text-right">GP %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products!.map((product, index) => (
                  <TableRow key={product.productId}>
                    <TableCell className="font-medium text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.category}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Math.round(product.units).toLocaleString('es-ES')}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCurrency(product.netSales)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPercent(product.pctSales)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {product.cogs !== null
                        ? formatCurrency(product.cogs)
                        : <MissingCell reason={product.reason!} />
                      }
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-primary">
                      {product.gpValue !== null
                        ? formatCurrency(product.gpValue)
                        : <MissingCell reason={product.reason!} />
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      {product.gpPct !== null ? (
                        <Badge
                          variant={product.gpPct >= 65 ? 'default' : product.gpPct >= 50 ? 'secondary' : 'destructive'}
                          className="tabular-nums"
                        >
                          {formatPercent(product.gpPct)}
                        </Badge>
                      ) : (
                        <MissingCell reason={product.reason!} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
