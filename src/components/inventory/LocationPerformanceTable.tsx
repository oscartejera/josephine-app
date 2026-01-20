import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import type { ViewMode } from './InventoryHeader';
import type { DateRangeValue } from '@/components/bi/DateRangePickerNoryLike';

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
  hasStockCount?: boolean;
}

interface LocationPerformanceTableProps {
  viewMode: ViewMode;
  data: LocationPerformance[];
  isLoading?: boolean;
  currency?: string;
  dateRange?: DateRangeValue;
  onLocationClick?: (locationId: string) => void;
}

export function LocationPerformanceTable({
  viewMode,
  data,
  isLoading = false,
  currency = '€',
  dateRange,
  onLocationClick
}: LocationPerformanceTableProps) {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const isCOGS = viewMode === 'COGS';
  
  // For GP view, we show GP metrics instead of COGS
  const theoreticalLabel = isCOGS ? 'Theoretical COGS' : 'Theoretical GP';
  const actualLabel = isCOGS ? 'Actual COGS' : 'Actual GP';

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

  const handleRowClick = (locationId: string) => {
    if (onLocationClick) {
      onLocationClick(locationId);
      return;
    }
    
    // Build URL with date params
    const params = new URLSearchParams();
    if (dateRange?.from) {
      params.set('start_date', format(dateRange.from, 'yyyy-MM-dd'));
    }
    if (dateRange?.to) {
      params.set('end_date', format(dateRange.to, 'yyyy-MM-dd'));
    }
    
    const queryString = params.toString();
    navigate(`/inventory/${locationId}${queryString ? `?${queryString}` : ''}`);
  };

  if (isLoading) {
    return (
      <Card className="border-[#E8E5DD] rounded-2xl shadow-sm">
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
    <Card className="border-[#E8E5DD] rounded-2xl shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-foreground">Location performance</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by location"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 border-border/60 focus:border-primary"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 border-b border-border/50">
                <TableHead className="w-[180px] text-xs font-medium text-muted-foreground py-3">Locations</TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground py-3">Sales</TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground py-3">{theoreticalLabel}</TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground py-3">{actualLabel}</TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground py-3">Variance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((row) => {
                // For COGS: positive variance is bad (red), negative is good (green)
                // For GP: negative variance is bad (red), positive is good (green)
                const isVarianceNegative = isCOGS ? row.variancePercent > 0 : row.variancePercent < 0;
                const hasData = row.hasStockCount !== false;
                
                return (
                  <TableRow 
                    key={row.locationId} 
                    className="border-b border-border/30 hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => handleRowClick(row.locationId)}
                  >
                    <TableCell className="py-3 font-medium text-sm text-primary hover:underline">
                      {row.locationName}
                    </TableCell>
                    <TableCell className="py-3 text-right text-sm">
                      {currency}{row.sales.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-medium">{row.theoreticalPercent.toFixed(2)}%</span>
                        <span className="text-xs text-muted-foreground">
                          {currency}{row.theoreticalValue.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </TableCell>
                    {hasData ? (
                      <>
                        <TableCell className="py-3 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-sm font-medium">{row.actualPercent.toFixed(2)}%</span>
                            <span className="text-xs text-muted-foreground">
                              {currency}{row.actualValue.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <div className={cn(
                            "flex flex-col items-end",
                            isVarianceNegative ? "text-destructive" : "text-success"
                          )}>
                            <span className="text-sm font-medium">
                              {row.variancePercent >= 0 ? '+' : ''}{row.variancePercent.toFixed(2)}%
                            </span>
                            <span className="text-xs">
                              {row.varianceAmount >= 0 ? '+' : ''}{currency}{Math.abs(row.varianceAmount).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <TableCell colSpan={2} className="py-3 text-center text-sm text-muted-foreground italic">
                        No stock count done
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              
              {/* Totals row */}
              <TableRow className="border-t-2 border-border bg-muted/20">
                <TableCell className="py-3 font-semibold text-sm text-muted-foreground">All locations</TableCell>
                <TableCell className="py-3 text-right font-semibold text-sm text-muted-foreground">
                  {currency}{totals.sales.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </TableCell>
                <TableCell className="py-3 text-right">
                  <div className="flex flex-col items-end">
                    <span className="font-semibold text-sm text-muted-foreground">{avgTheoreticalPercent.toFixed(2)}%</span>
                    <span className="text-xs text-muted-foreground">
                      {currency}{totals.theoreticalValue.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="py-3 text-right">
                  <div className="flex flex-col items-end">
                    <span className="font-semibold text-sm text-muted-foreground">{avgActualPercent.toFixed(2)}%</span>
                    <span className="text-xs text-muted-foreground">
                      {currency}{totals.actualValue.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="py-3 text-right">
                  <div className={cn(
                    "flex flex-col items-end",
                    (isCOGS ? avgVariancePercent > 0 : avgVariancePercent < 0) ? "text-destructive" : "text-success"
                  )}>
                    <span className="font-semibold text-sm">
                      {avgVariancePercent >= 0 ? '+' : ''}{avgVariancePercent.toFixed(2)}%
                    </span>
                    <span className="text-xs">
                      {totals.varianceAmount >= 0 ? '+' : ''}{currency}{Math.abs(totals.varianceAmount).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
