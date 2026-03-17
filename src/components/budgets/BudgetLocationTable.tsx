import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search } from 'lucide-react';
import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { BudgetLocationData } from '@/hooks/useBudgetsData';

interface BudgetLocationTableProps {
  data: BudgetLocationData[];
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

function StatusBadge({ status }: { status: BudgetLocationData['status'] }) {
  const styles = {
    on_track: 'bg-success/10 text-success border-success/20',
    at_risk: 'bg-warning/10 text-warning border-warning/20',
    over_budget: 'bg-destructive/10 text-destructive border-destructive/20',
    high_sales_over_labour: 'bg-info/10 text-info border-info/20',
  };

  const labels = {
    on_track: 'On Track',
    at_risk: 'At Risk',
    over_budget: 'Over Budget',
    high_sales_over_labour: 'High Sales / Over Labour',
  };

  return (
    <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', styles[status])}>
      {labels[status]}
    </Badge>
  );
}

export function BudgetLocationTable({ data, isLoading = false, currency = '€' }: BudgetLocationTableProps) {
  const [search, setSearch] = useState('');

  const filteredData = useMemo(() => {
    if (!search) return data;
    return data.filter(d => d.locationName.toLowerCase().includes(search.toLowerCase()));
  }, [data, search]);

  const totals = useMemo(() => {
    const total = data.reduce((acc, d) => ({
      salesActual: acc.salesActual + d.salesActual,
      salesBudget: acc.salesBudget + d.salesBudget,
      labourActual: acc.labourActual + d.labourActual,
      labourBudget: acc.labourBudget + d.labourBudget,
      cogsActual: acc.cogsActual + d.cogsActual,
      cogsBudget: acc.cogsBudget + d.cogsBudget,
    }), { salesActual: 0, salesBudget: 0, labourActual: 0, labourBudget: 0, cogsActual: 0, cogsBudget: 0 });

    const primeActual = total.labourActual + total.cogsActual;
    const primeBudget = total.labourBudget + total.cogsBudget;

    return {
      ...total,
      salesVarPct: total.salesBudget > 0 ? ((total.salesActual - total.salesBudget) / total.salesBudget) * 100 : 0,
      labourVarPct: total.labourBudget > 0 ? ((total.labourActual - total.labourBudget) / total.labourBudget) * 100 : 0,
      cogsVarPct: total.cogsBudget > 0 ? ((total.cogsActual - total.cogsBudget) / total.cogsBudget) * 100 : 0,
      primePctActual: total.salesActual > 0 ? (primeActual / total.salesActual) * 100 : 0,
      primePctBudget: total.salesBudget > 0 ? (primeBudget / total.salesBudget) * 100 : 0,
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
        <CardTitle className="text-base font-medium">Budget by Location</CardTitle>
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
                <TableHead className="min-w-[140px]">Location</TableHead>
                <TableHead colSpan={3} className="text-center border-l">Sales</TableHead>
                <TableHead colSpan={2} className="text-center border-l">Labour</TableHead>
                <TableHead colSpan={2} className="text-center border-l">COGS</TableHead>
                <TableHead colSpan={3} className="text-center border-l">Prime Cost</TableHead>
                <TableHead className="text-center border-l">Status</TableHead>
              </TableRow>
              <TableRow>
                <TableHead></TableHead>
                <TableHead className="text-right text-xs border-l">Actual</TableHead>
                <TableHead className="text-right text-xs">Budget</TableHead>
                <TableHead className="text-right text-xs">Var</TableHead>
                <TableHead className="text-right text-xs border-l">Actual</TableHead>
                <TableHead className="text-right text-xs">Var</TableHead>
                <TableHead className="text-right text-xs border-l">Actual</TableHead>
                <TableHead className="text-right text-xs">Var</TableHead>
                <TableHead className="text-right text-xs border-l">Actual %</TableHead>
                <TableHead className="text-right text-xs">Budget %</TableHead>
                <TableHead className="text-right text-xs">Var pp</TableHead>
                <TableHead className="text-center border-l"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((loc) => (
                <TableRow key={loc.locationId} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{loc.locationName}</TableCell>
                  <TableCell className="text-right border-l">{formatCurrency(loc.salesActual, currency)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatCurrency(loc.salesBudget, currency)}</TableCell>
                  <TableCell className="text-right"><DeltaCell value={loc.salesVarPct} /></TableCell>
                  <TableCell className="text-right border-l">{formatCurrency(loc.labourActual, currency)}</TableCell>
                  <TableCell className="text-right"><DeltaCell value={loc.labourVarPct} inverse /></TableCell>
                  <TableCell className="text-right border-l">{formatCurrency(loc.cogsActual, currency)}</TableCell>
                  <TableCell className="text-right"><DeltaCell value={loc.cogsVarPct} inverse /></TableCell>
                  <TableCell className="text-right border-l font-medium">{loc.primePctActual.toFixed(1)}%</TableCell>
                  <TableCell className="text-right text-muted-foreground">{loc.primePctBudget.toFixed(1)}%</TableCell>
                  <TableCell className="text-right"><DeltaCell value={loc.primeVarPp} suffix="pp" inverse /></TableCell>
                  <TableCell className="text-center border-l"><StatusBadge status={loc.status} /></TableCell>
                </TableRow>
              ))}
              {/* Totals row */}
              <TableRow className="bg-muted/30 font-medium border-t-2">
                <TableCell>Total / Average</TableCell>
                <TableCell className="text-right border-l">{formatCurrency(totals.salesActual, currency)}</TableCell>
                <TableCell className="text-right text-muted-foreground">{formatCurrency(totals.salesBudget, currency)}</TableCell>
                <TableCell className="text-right"><DeltaCell value={totals.salesVarPct} /></TableCell>
                <TableCell className="text-right border-l">{formatCurrency(totals.labourActual, currency)}</TableCell>
                <TableCell className="text-right"><DeltaCell value={totals.labourVarPct} inverse /></TableCell>
                <TableCell className="text-right border-l">{formatCurrency(totals.cogsActual, currency)}</TableCell>
                <TableCell className="text-right"><DeltaCell value={totals.cogsVarPct} inverse /></TableCell>
                <TableCell className="text-right border-l font-medium">{totals.primePctActual.toFixed(1)}%</TableCell>
                <TableCell className="text-right text-muted-foreground">{totals.primePctBudget.toFixed(1)}%</TableCell>
                <TableCell className="text-right"><DeltaCell value={totals.primePctActual - totals.primePctBudget} suffix="pp" inverse /></TableCell>
                <TableCell className="text-center border-l">—</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
