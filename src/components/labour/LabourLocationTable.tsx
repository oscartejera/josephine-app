/**
 * Labour Location Table - Nory-style location performance table
 * Multi-level headers: Location, Sales (Actual/Projected), COL (Actual/Projected), SPLH (Actual/Projected)
 * Clickable rows navigate to /labour/:locationId
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

function formatSplh(value: number): string {
  return `€${value.toFixed(0)}`;
}

function DeltaBadge({ value, inverted = false }: { value: number; inverted?: boolean }) {
  const isPositive = inverted ? value <= 0 : value >= 0;
  const arrow = value >= 0 ? '▲' : '▼';
  
  if (Math.abs(value) < 0.01) {
    return <span className="text-[10px] text-muted-foreground">-</span>;
  }
  
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium",
      isPositive 
        ? "bg-[hsl(var(--bi-badge-positive))] text-[hsl(var(--bi-badge-positive-text))]" 
        : "bg-[hsl(var(--bi-badge-negative))] text-[hsl(var(--bi-badge-negative-text))]"
    )}>
      <span>{arrow}</span>
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function TableSkeleton() {
  return (
    <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm bg-card">
      <CardContent className="p-0">
        <div className="p-6 space-y-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 flex-1" />
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
    <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {/* First header row - group headers */}
            <TableRow className="bg-muted/30 border-b border-border/50">
              <TableHead className="w-[160px] font-semibold text-foreground">Locations</TableHead>
              <TableHead colSpan={2} className="text-center font-semibold text-foreground border-l border-border/40">
                Sales
              </TableHead>
              <TableHead colSpan={2} className="text-center font-semibold text-foreground border-l border-border/40">
                COL
              </TableHead>
              <TableHead colSpan={2} className="text-center font-semibold text-foreground border-l border-border/40">
                SPLH
              </TableHead>
            </TableRow>
            {/* Second header row - Actual/Projected */}
            <TableRow className="border-b border-border/50">
              <TableHead></TableHead>
              <TableHead className="text-center text-xs font-medium text-muted-foreground border-l border-border/40 py-2">Actual</TableHead>
              <TableHead className="text-center text-xs font-medium text-muted-foreground py-2">Projected</TableHead>
              <TableHead className="text-center text-xs font-medium text-muted-foreground border-l border-border/40 py-2">Actual</TableHead>
              <TableHead className="text-center text-xs font-medium text-muted-foreground py-2">Projected</TableHead>
              <TableHead className="text-center text-xs font-medium text-muted-foreground border-l border-border/40 py-2">Actual</TableHead>
              <TableHead className="text-center text-xs font-medium text-muted-foreground py-2">Projected</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locationData.map((loc) => (
              <TableRow 
                key={loc.locationId}
                className="cursor-pointer hover:bg-muted/40 transition-colors"
                onClick={() => handleRowClick(loc.locationId)}
              >
                <TableCell className="font-medium text-foreground">{loc.locationName}</TableCell>
                
                {/* Sales */}
                <TableCell className="text-center border-l border-border/20 py-3">
                  <div className="flex flex-col items-center gap-1">
                    <span className="font-semibold text-foreground">{formatCurrency(loc.salesActual)}</span>
                    <DeltaBadge value={loc.salesDelta} />
                  </div>
                </TableCell>
                <TableCell className="text-center text-muted-foreground py-3">
                  {formatCurrency(loc.salesProjected)}
                </TableCell>
                
                {/* COL */}
                <TableCell className="text-center border-l border-border/20 py-3">
                  <div className="flex flex-col items-center gap-1">
                    <span className="font-semibold text-foreground">{formatPercent(loc.colActual)}</span>
                    <DeltaBadge value={loc.colDelta} inverted />
                  </div>
                </TableCell>
                <TableCell className="text-center text-muted-foreground py-3">
                  {formatPercent(loc.colPlanned)}
                </TableCell>
                
                {/* SPLH */}
                <TableCell className="text-center border-l border-border/20 py-3">
                  <div className="flex flex-col items-center gap-1">
                    <span className="font-semibold text-foreground">{formatSplh(loc.splhActual)}</span>
                    <DeltaBadge value={loc.splhDelta} />
                  </div>
                </TableCell>
                <TableCell className="text-center text-muted-foreground py-3">
                  {formatSplh(loc.splhPlanned)}
                </TableCell>
              </TableRow>
            ))}
            
            {/* Summary row */}
            <TableRow className="bg-muted/50 border-t-2 border-border">
              <TableCell className="font-semibold text-foreground">All locations</TableCell>
              
              <TableCell className="text-center border-l border-border/20 py-3">
                <div className="flex flex-col items-center gap-1">
                  <span className="font-semibold text-foreground">{formatCurrency(totals.salesActual)}</span>
                  <DeltaBadge value={salesDelta} />
                </div>
              </TableCell>
              <TableCell className="text-center text-muted-foreground font-medium py-3">
                {formatCurrency(totals.salesProjected)}
              </TableCell>
              
              <TableCell className="text-center border-l border-border/20 py-3">
                <div className="flex flex-col items-center gap-1">
                  <span className="font-semibold text-foreground">{formatPercent(avgColActual)}</span>
                  <DeltaBadge value={colDelta} inverted />
                </div>
              </TableCell>
              <TableCell className="text-center text-muted-foreground font-medium py-3">
                {formatPercent(avgColPlanned)}
              </TableCell>
              
              <TableCell className="text-center border-l border-border/20 py-3">
                <div className="flex flex-col items-center gap-1">
                  <span className="font-semibold text-foreground">{formatSplh(avgSplhActual)}</span>
                  <DeltaBadge value={splhDelta} />
                </div>
              </TableCell>
              <TableCell className="text-center text-muted-foreground font-medium py-3">
                {formatSplh(avgSplhPlanned)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
