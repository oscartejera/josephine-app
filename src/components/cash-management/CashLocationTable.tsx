import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { CashLocationData } from '@/hooks/useCashManagementData';

interface CashLocationTableProps {
  data: CashLocationData[];
  isLoading?: boolean;
  currency?: string;
}

function formatCurrency(value: number, currency = '€'): string {
  return `${currency}${value.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function DeltaCell({ value, suffix = '%', inverse = false }: { value: number; suffix?: string; inverse?: boolean }) {
  const isPositive = inverse ? value < 0 : value > 0;
  const isNegative = inverse ? value > 0 : value < 0;
  
  return (
    <span className={cn(
      "text-xs font-medium",
      isPositive && "text-success",
      isNegative && "text-destructive",
      !isPositive && !isNegative && "text-muted-foreground"
    )}>
      {value >= 0 ? '+' : ''}{value.toFixed(1)}{suffix}
    </span>
  );
}

export function CashLocationTable({ data, isLoading = false, currency = '€' }: CashLocationTableProps) {
  const [search, setSearch] = useState('');

  const filteredData = useMemo(() => {
    if (!search) return data;
    return data.filter(d => d.locationName.toLowerCase().includes(search.toLowerCase()));
  }, [data, search]);

  const totals = useMemo(() => {
    const total = data.reduce((acc, d) => ({
      sales: acc.sales + d.sales,
      salesPrevious: acc.salesPrevious + d.salesPrevious,
      leakage: acc.leakage + d.leakage,
      leakagePrevious: acc.leakagePrevious + d.leakagePrevious,
      refunds: acc.refunds + d.refunds,
      discounts: acc.discounts + d.discounts,
      voids: acc.voids + d.voids,
    }), { sales: 0, salesPrevious: 0, leakage: 0, leakagePrevious: 0, refunds: 0, discounts: 0, voids: 0 });

    return {
      ...total,
      salesDelta: total.salesPrevious > 0 ? ((total.sales - total.salesPrevious) / total.salesPrevious) * 100 : 0,
      leakageDelta: total.leakagePrevious > 0 ? ((total.leakage - total.leakagePrevious) / total.leakagePrevious) * 100 : 0,
      leakagePct: total.sales > 0 ? (total.leakage / total.sales) * 100 : 0,
      avgCashPct: data.length > 0 ? data.reduce((sum, d) => sum + d.cashPct, 0) / data.length : 0,
    };
  }, [data]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-64 mb-4" />
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-medium">Cash by Location</CardTitle>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search locations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[150px]">Location</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">vs Prev</TableHead>
                <TableHead className="text-right">Cash %</TableHead>
                <TableHead className="text-right">Leakage</TableHead>
                <TableHead className="text-right">Leakage %</TableHead>
                <TableHead className="text-right">vs Prev</TableHead>
                <TableHead className="text-right">Refunds</TableHead>
                <TableHead className="text-right">Discounts</TableHead>
                <TableHead className="text-right">Voids</TableHead>
                <TableHead className="text-right">Cash Var</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((loc) => (
                <TableRow key={loc.locationId} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{loc.locationName}</TableCell>
                  <TableCell className="text-right">{formatCurrency(loc.sales, currency)}</TableCell>
                  <TableCell className="text-right"><DeltaCell value={loc.salesDelta} /></TableCell>
                  <TableCell className="text-right">{loc.cashPct.toFixed(1)}%</TableCell>
                  <TableCell className="text-right text-destructive">{formatCurrency(loc.leakage, currency)}</TableCell>
                  <TableCell className="text-right">{loc.leakagePct.toFixed(1)}%</TableCell>
                  <TableCell className="text-right"><DeltaCell value={loc.leakagePctDeltaPp} suffix="pp" inverse /></TableCell>
                  <TableCell className="text-right">{formatCurrency(loc.refunds, currency)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(loc.discounts, currency)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(loc.voids, currency)}</TableCell>
                  <TableCell className="text-right">
                    {loc.cashVariance !== null ? (
                      <span className={cn(loc.cashVariance >= 0 ? 'text-success' : 'text-destructive')}>
                        {loc.cashVariance >= 0 ? '+' : ''}{formatCurrency(loc.cashVariance, currency)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals row */}
              <TableRow className="bg-muted/30 font-medium border-t-2">
                <TableCell>Total / Average</TableCell>
                <TableCell className="text-right">{formatCurrency(totals.sales, currency)}</TableCell>
                <TableCell className="text-right"><DeltaCell value={totals.salesDelta} /></TableCell>
                <TableCell className="text-right">{totals.avgCashPct.toFixed(1)}%</TableCell>
                <TableCell className="text-right text-destructive">{formatCurrency(totals.leakage, currency)}</TableCell>
                <TableCell className="text-right">{totals.leakagePct.toFixed(1)}%</TableCell>
                <TableCell className="text-right"><DeltaCell value={totals.leakageDelta} suffix="%" inverse /></TableCell>
                <TableCell className="text-right">{formatCurrency(totals.refunds, currency)}</TableCell>
                <TableCell className="text-right">{formatCurrency(totals.discounts, currency)}</TableCell>
                <TableCell className="text-right">{formatCurrency(totals.voids, currency)}</TableCell>
                <TableCell className="text-right">—</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
