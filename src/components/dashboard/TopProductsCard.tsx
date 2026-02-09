import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, CalendarIcon, AlertTriangle, Package } from 'lucide-react';
import { useTopProducts, OrderByOption } from '@/hooks/useTopProducts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Location } from '@/contexts/AppContext';

interface TopProductsCardProps {
  className?: string;
}

function formatCurrency(value: number): string {
  return `€${value.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function TopProductsCard({ className }: TopProductsCardProps) {
  const {
    products,
    loading,
    locations,
    selectedLocationId,
    setSelectedLocationId,
    datePreset,
    setDatePreset,
    customDateFrom,
    setCustomDateFrom,
    customDateTo,
    setCustomDateTo,
    orderBy,
    setOrderBy,
  } = useTopProducts();

  const showEmptyState = !loading && products.length === 0;

  return (
    <Card className={cn("col-span-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Top 10 Productos
          </CardTitle>
          
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Location Filter */}
            <Select
              value={selectedLocationId || 'all'}
              onValueChange={(value) => setSelectedLocationId(value === 'all' ? null : value)}
            >
              <SelectTrigger className="w-[160px] h-9 text-sm">
                <SelectValue placeholder="Ubicación" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {locations.map((loc: Location) => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date Preset Filter */}
            <Select
              value={datePreset}
              onValueChange={(value) => setDatePreset(value as 'last7' | 'last30' | 'custom')}
            >
              <SelectTrigger className="w-[140px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last7">Últimos 7 días</SelectItem>
                <SelectItem value="last30">Últimos 30 días</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>

            {/* Custom Date Range */}
            {datePreset === 'custom' && (
              <div className="flex items-center gap-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 text-sm">
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {format(customDateFrom, 'dd/MM', { locale: es })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customDateFrom}
                      onSelect={(date) => date && setCustomDateFrom(date)}
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground">–</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 text-sm">
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {format(customDateTo, 'dd/MM', { locale: es })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customDateTo}
                      onSelect={(date) => date && setCustomDateTo(date)}
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Order By */}
            <Select
              value={orderBy}
              onValueChange={(value) => setOrderBy(value as OrderByOption)}
            >
              <SelectTrigger className="w-[110px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="share">% Ventas</SelectItem>
                <SelectItem value="gp_eur">GP €</SelectItem>
                <SelectItem value="gp_pct">GP %</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {loading ? (
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
              No se encontraron ventas de productos para el periodo y ubicacion seleccionados.
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
                  <TableHead className="text-right">% Sales</TableHead>
                  <TableHead className="text-right">COGS</TableHead>
                  <TableHead className="text-right">GP</TableHead>
                  <TableHead className="text-right">GP%</TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product, index) => (
                  <TableRow key={product.product_id}>
                    <TableCell className="font-medium text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{product.product_name}</p>
                        <p className="text-xs text-muted-foreground">{product.category}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Math.round(product.units).toLocaleString('es-ES')}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCurrency(product.sales)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPercent(product.sales_share_pct)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatCurrency(product.cogs)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-primary">
                      {formatCurrency(product.gp)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge 
                        variant={product.gp_pct >= 65 ? "default" : product.gp_pct >= 50 ? "secondary" : "destructive"}
                        className="tabular-nums"
                      >
                        {formatPercent(product.gp_pct)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {product.badge_label && (
                        <Badge variant="outline" className="text-xs whitespace-nowrap border-destructive text-destructive">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {product.badge_label}
                        </Badge>
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
