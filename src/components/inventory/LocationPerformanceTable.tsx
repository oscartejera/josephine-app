import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ViewMode } from './InventoryHeader';

interface LocationPerformance {
  locationId: string;
  locationName: string;
  sales: number;
  theoreticalValue: number;
  theoreticalPercent: number;
  actualValue: number;
  actualPercent: number;
  variancePercent: number;
  varianceAmount: number;
}

interface LocationPerformanceTableProps {
  viewMode: ViewMode;
  data: LocationPerformance[];
  isLoading?: boolean;
  currency?: string;
}

export function LocationPerformanceTable({
  viewMode,
  data,
  isLoading = false,
  currency = '€'
}: LocationPerformanceTableProps) {
  const [search, setSearch] = useState('');
  const isCOGS = viewMode === 'COGS';
  const metricLabel = isCOGS ? 'COGS' : 'GP';

  const filteredData = data.filter(d => 
    d.locationName.toLowerCase().includes(search.toLowerCase())
  );

  // Calculate totals
  const totals = filteredData.reduce((acc, d) => ({
    sales: acc.sales + d.sales,
    theoreticalValue: acc.theoreticalValue + d.theoreticalValue,
    actualValue: acc.actualValue + d.actualValue,
    varianceAmount: acc.varianceAmount + d.varianceAmount
  }), { sales: 0, theoreticalValue: 0, actualValue: 0, varianceAmount: 0 });

  const avgTheoreticalPercent = totals.sales > 0 
    ? (totals.theoreticalValue / totals.sales) * 100 
    : 0;
  const avgActualPercent = totals.sales > 0 
    ? (totals.actualValue / totals.sales) * 100 
    : 0;
  const avgVariancePercent = avgActualPercent - avgTheoreticalPercent;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-9 w-64" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Location performance</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by location"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[180px]">Locations</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Theoretical {metricLabel}</TableHead>
                <TableHead className="text-right">Actual {metricLabel}</TableHead>
                <TableHead className="text-right">Variance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((row) => {
                const isVarianceNegative = isCOGS ? row.variancePercent > 0 : row.variancePercent < 0;
                
                return (
                  <TableRow key={row.locationId}>
                    <TableCell className="font-medium">{row.locationName}</TableCell>
                    <TableCell className="text-right">
                      {currency}{row.sales.toLocaleString('es-ES', { minimumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-muted-foreground">{row.theoreticalPercent.toFixed(1)}%</span>
                        <span className="text-xs text-muted-foreground/70">
                          {currency}{row.theoreticalValue.toLocaleString('es-ES', { minimumFractionDigits: 0 })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span>{row.actualPercent.toFixed(1)}%</span>
                        <span className="text-xs text-muted-foreground">
                          {currency}{row.actualValue.toLocaleString('es-ES', { minimumFractionDigits: 0 })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className={cn(
                        "flex flex-col items-end",
                        isVarianceNegative ? "text-destructive" : "text-success"
                      )}>
                        <span>{row.variancePercent >= 0 ? '+' : ''}{row.variancePercent.toFixed(1)}%</span>
                        <span className="text-xs">
                          {row.varianceAmount >= 0 ? '+' : ''}{currency}{Math.abs(row.varianceAmount).toLocaleString('es-ES', { minimumFractionDigits: 0 })}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              
              {/* Totals row */}
              <TableRow className="font-semibold border-t-2 bg-muted/30">
                <TableCell>Total / Average</TableCell>
                <TableCell className="text-right">
                  {currency}{totals.sales.toLocaleString('es-ES', { minimumFractionDigits: 0 })}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end">
                    <span>{avgTheoreticalPercent.toFixed(1)}%</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {currency}{totals.theoreticalValue.toLocaleString('es-ES', { minimumFractionDigits: 0 })}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end">
                    <span>{avgActualPercent.toFixed(1)}%</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {currency}{totals.actualValue.toLocaleString('es-ES', { minimumFractionDigits: 0 })}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className={cn(
                    "flex flex-col items-end",
                    (isCOGS ? avgVariancePercent > 0 : avgVariancePercent < 0) ? "text-destructive" : "text-success"
                  )}>
                    <span>{avgVariancePercent >= 0 ? '+' : ''}{avgVariancePercent.toFixed(1)}%</span>
                    <span className="text-xs font-normal">
                      {totals.varianceAmount >= 0 ? '+' : ''}{currency}{Math.abs(totals.varianceAmount).toLocaleString('es-ES', { minimumFractionDigits: 0 })}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
