import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BISalesData } from '@/hooks/useBISalesData';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

interface BILocationTableProps {
  data: BISalesData | undefined;
  isLoading: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', { 
    style: 'currency', 
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

function DeltaValue({ value, delta }: { value: number; delta: number }) {
  const isPositive = delta >= 0;
  return (
    <div className="text-right">
      <div className="font-medium">{formatCurrency(value)}</div>
      {delta !== 0 && (
        <div className={cn(
          "text-xs",
          isPositive ? "text-[hsl(var(--bi-badge-positive-text))]" : "text-[hsl(var(--bi-badge-negative-text))]"
        )}>
          {isPositive ? '+' : ''}{delta.toFixed(1)}%
        </div>
      )}
    </div>
  );
}

export function BILocationTable({ data, isLoading }: BILocationTableProps) {
  const [search, setSearch] = useState('');

  const filteredLocations = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data.locations;
    return data.locations.filter(loc => 
      loc.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [data, search]);

  // Calculate totals/averages
  const totals = useMemo(() => {
    if (!filteredLocations.length) return null;
    const sumSalesActual = filteredLocations.reduce((s, l) => s + l.salesActual, 0);
    const sumSalesForecast = filteredLocations.reduce((s, l) => s + l.salesForecast, 0);
    const sumDineIn = filteredLocations.reduce((s, l) => s + l.dineIn, 0);
    const sumDelivery = filteredLocations.reduce((s, l) => s + l.delivery, 0);
    const sumPickUp = filteredLocations.reduce((s, l) => s + l.pickUp, 0);
    const sumOrders = filteredLocations.reduce((s, l) => s + l.orders, 0);
    const avgAcs = filteredLocations.reduce((s, l) => s + l.acs, 0) / filteredLocations.length;
    const dwellTimes = filteredLocations.filter(l => l.dwellTime !== null);
    const avgDwell = dwellTimes.length > 0 
      ? dwellTimes.reduce((s, l) => s + (l.dwellTime || 0), 0) / dwellTimes.length 
      : null;

    return {
      salesActual: sumSalesActual,
      salesForecast: sumSalesForecast,
      dineIn: sumDineIn,
      delivery: sumDelivery,
      pickUp: sumPickUp,
      orders: sumOrders,
      acs: avgAcs,
      dwellTime: avgDwell
    };
  }, [filteredLocations]);

  if (isLoading || !data) {
    return (
      <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Sales by location</CardTitle>
          <Skeleton className="h-9 w-[200px]" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-lg font-semibold">Sales by location</CardTitle>
        <div className="relative w-[220px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by location"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="min-w-[160px]">Locations</TableHead>
                <TableHead colSpan={2} className="text-center border-l">Sales</TableHead>
                <TableHead colSpan={3} className="text-center border-l">Channels</TableHead>
                <TableHead colSpan={3} className="text-center border-l">Other</TableHead>
              </TableRow>
              <TableRow>
                <TableHead></TableHead>
                <TableHead className="text-right border-l">Actual</TableHead>
                <TableHead className="text-right">Forecasted</TableHead>
                <TableHead className="text-right border-l">Dine-in</TableHead>
                <TableHead className="text-right">Delivery</TableHead>
                <TableHead className="text-right">Pick-up</TableHead>
                <TableHead className="text-right border-l">Orders</TableHead>
                <TableHead className="text-right">ACS</TableHead>
                <TableHead className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    Dwell
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Average dwell time for dine-in</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLocations.map((loc) => (
                <TableRow key={loc.id}>
                  <TableCell className="font-medium">{loc.name}</TableCell>
                  <TableCell className="text-right border-l">{formatCurrency(loc.salesActual)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(loc.salesForecast)}</TableCell>
                  <TableCell className="border-l">
                    <DeltaValue value={loc.dineIn} delta={loc.dineInDelta} />
                  </TableCell>
                  <TableCell>
                    <DeltaValue value={loc.delivery} delta={loc.deliveryDelta} />
                  </TableCell>
                  <TableCell>
                    <DeltaValue value={loc.pickUp} delta={loc.pickUpDelta} />
                  </TableCell>
                  <TableCell className="text-right border-l font-medium">{loc.orders}</TableCell>
                  <TableCell className="text-right font-medium">€{loc.acs.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {loc.dwellTime !== null ? `${loc.dwellTime} min` : '—'}
                  </TableCell>
                </TableRow>
              ))}
              {/* Summary row */}
              {totals && (
                <TableRow className="bg-muted/30 font-semibold">
                  <TableCell>SUM / AVG</TableCell>
                  <TableCell className="text-right border-l">{formatCurrency(totals.salesActual)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totals.salesForecast)}</TableCell>
                  <TableCell className="text-right border-l">{formatCurrency(totals.dineIn)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totals.delivery)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totals.pickUp)}</TableCell>
                  <TableCell className="text-right border-l">{totals.orders}</TableCell>
                  <TableCell className="text-right">€{totals.acs.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    {totals.dwellTime !== null ? `${Math.round(totals.dwellTime)} min` : '—'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
