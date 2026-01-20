/**
 * Labour Location Table - Nory-style location performance table
 * Columns: Location, Sales (Actual/Projected), COL (Actual/Projected), SPLH (Actual/Projected)
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { LabourData, LabourDateRange, MetricMode } from '@/hooks/useLabourData';

interface LabourLocationTableProps {
  data: LabourData | undefined;
  isLoading: boolean;
  dateRange: LabourDateRange;
  metricMode: MetricMode;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', { 
    style: 'currency', 
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function formatHours(value: number): string {
  return `${Math.round(value)}h`;
}

function DeltaBadge({ value, inverted = false, size = 'sm' }: { value: number; inverted?: boolean; size?: 'sm' | 'xs' }) {
  const isPositive = inverted ? value <= 0 : value >= 0;
  
  return (
    <span className={cn(
      "inline-flex items-center rounded-full font-medium",
      size === 'sm' ? "px-2 py-0.5 text-xs" : "px-1.5 py-0.5 text-[10px]",
      isPositive 
        ? "bg-[hsl(var(--bi-badge-positive))] text-[hsl(var(--bi-badge-positive-text))]" 
        : "bg-[hsl(var(--bi-badge-negative))] text-[hsl(var(--bi-badge-negative-text))]"
    )}>
      {value >= 0 ? '+' : ''}{value.toFixed(1)}%
    </span>
  );
}

function TableSkeleton() {
  return (
    <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm">
      <CardContent className="p-6">
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-8 flex-1" />
              <Skeleton className="h-8 flex-1" />
              <Skeleton className="h-8 flex-1" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function LabourLocationTable({ data, isLoading, dateRange, metricMode }: LabourLocationTableProps) {
  const navigate = useNavigate();

  const handleRowClick = useCallback((locationId: string) => {
    const startParam = format(dateRange.from, 'yyyy-MM-dd');
    const endParam = format(dateRange.to, 'yyyy-MM-dd');
    navigate(`/labour/${locationId}?start=${startParam}&end=${endParam}&mode=${metricMode}`);
  }, [navigate, dateRange, metricMode]);

  if (isLoading || !data) {
    return <TableSkeleton />;
  }

  const { locationData } = data;

  // Calculate totals/averages
  const totals = locationData.reduce((acc, loc) => ({
    salesActual: acc.salesActual + loc.salesActual,
    salesProjected: acc.salesProjected + loc.salesProjected,
    hoursActual: acc.hoursActual + loc.hoursActual,
    hoursPlanned: acc.hoursPlanned + loc.hoursPlanned,
    labourCostActual: acc.labourCostActual + loc.labourCostActual,
    labourCostPlanned: acc.labourCostPlanned + loc.labourCostPlanned
  }), {
    salesActual: 0,
    salesProjected: 0,
    hoursActual: 0,
    hoursPlanned: 0,
    labourCostActual: 0,
    labourCostPlanned: 0
  });

  const avgColActual = totals.salesActual > 0 ? (totals.labourCostActual / totals.salesActual) * 100 : 0;
  const avgColPlanned = totals.salesProjected > 0 ? (totals.labourCostPlanned / totals.salesProjected) * 100 : 0;
  const avgSplhActual = totals.hoursActual > 0 ? totals.salesActual / totals.hoursActual : 0;
  const avgSplhPlanned = totals.hoursPlanned > 0 ? totals.salesProjected / totals.hoursPlanned : 0;

  const salesDelta = totals.salesProjected > 0 
    ? ((totals.salesActual - totals.salesProjected) / totals.salesProjected) * 100 
    : 0;
  const colDelta = avgColPlanned > 0 
    ? ((avgColActual - avgColPlanned) / avgColPlanned) * 100 
    : 0;
  const splhDelta = avgSplhPlanned > 0 
    ? ((avgSplhActual - avgSplhPlanned) / avgSplhPlanned) * 100 
    : 0;

  return (
    <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[180px] font-semibold">Locations</TableHead>
              <TableHead colSpan={2} className="text-center font-semibold border-l border-border/50">
                Sales
              </TableHead>
              <TableHead colSpan={2} className="text-center font-semibold border-l border-border/50">
                COL
              </TableHead>
              <TableHead colSpan={2} className="text-center font-semibold border-l border-border/50">
                SPLH
              </TableHead>
            </TableRow>
            <TableRow>
              <TableHead></TableHead>
              <TableHead className="text-center text-xs text-muted-foreground border-l border-border/50">Actual</TableHead>
              <TableHead className="text-center text-xs text-muted-foreground">Projected</TableHead>
              <TableHead className="text-center text-xs text-muted-foreground border-l border-border/50">Actual</TableHead>
              <TableHead className="text-center text-xs text-muted-foreground">Projected</TableHead>
              <TableHead className="text-center text-xs text-muted-foreground border-l border-border/50">Actual</TableHead>
              <TableHead className="text-center text-xs text-muted-foreground">Projected</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locationData.map((loc) => (
              <TableRow 
                key={loc.locationId}
                className="cursor-pointer hover:bg-muted/40 transition-colors"
                onClick={() => handleRowClick(loc.locationId)}
              >
                <TableCell className="font-medium">{loc.locationName}</TableCell>
                
                {/* Sales */}
                <TableCell className="text-center border-l border-border/30">
                  <div className="flex flex-col items-center gap-1">
                    <span className="font-medium">{formatCurrency(loc.salesActual)}</span>
                    <DeltaBadge value={loc.salesDelta} size="xs" />
                  </div>
                </TableCell>
                <TableCell className="text-center text-muted-foreground">
                  {formatCurrency(loc.salesProjected)}
                </TableCell>
                
                {/* COL */}
                <TableCell className="text-center border-l border-border/30">
                  <div className="flex flex-col items-center gap-1">
                    <span className="font-medium">{formatPercent(loc.colActual)}</span>
                    <DeltaBadge value={loc.colDelta} inverted size="xs" />
                  </div>
                </TableCell>
                <TableCell className="text-center text-muted-foreground">
                  {formatPercent(loc.colPlanned)}
                </TableCell>
                
                {/* SPLH */}
                <TableCell className="text-center border-l border-border/30">
                  <div className="flex flex-col items-center gap-1">
                    <span className="font-medium">€{loc.splhActual.toFixed(0)}</span>
                    <DeltaBadge value={loc.splhDelta} size="xs" />
                  </div>
                </TableCell>
                <TableCell className="text-center text-muted-foreground">
                  €{loc.splhPlanned.toFixed(0)}
                </TableCell>
              </TableRow>
            ))}
            
            {/* Summary row */}
            <TableRow className="bg-muted/50 font-semibold">
              <TableCell>All locations</TableCell>
              
              <TableCell className="text-center border-l border-border/30">
                <div className="flex flex-col items-center gap-1">
                  <span>{formatCurrency(totals.salesActual)}</span>
                  <DeltaBadge value={salesDelta} size="xs" />
                </div>
              </TableCell>
              <TableCell className="text-center text-muted-foreground">
                {formatCurrency(totals.salesProjected)}
              </TableCell>
              
              <TableCell className="text-center border-l border-border/30">
                <div className="flex flex-col items-center gap-1">
                  <span>{formatPercent(avgColActual)}</span>
                  <DeltaBadge value={colDelta} inverted size="xs" />
                </div>
              </TableCell>
              <TableCell className="text-center text-muted-foreground">
                {formatPercent(avgColPlanned)}
              </TableCell>
              
              <TableCell className="text-center border-l border-border/30">
                <div className="flex flex-col items-center gap-1">
                  <span>€{avgSplhActual.toFixed(0)}</span>
                  <DeltaBadge value={splhDelta} size="xs" />
                </div>
              </TableCell>
              <TableCell className="text-center text-muted-foreground">
                €{avgSplhPlanned.toFixed(0)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
