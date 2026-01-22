/**
 * LabourLocationsTable - Table with 2-level headers like Nory
 */

import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { LabourLocationRow, MetricMode } from '@/hooks/useLabourData';

interface LabourLocationsTableProps {
  data: LabourLocationRow[];
  isLoading: boolean;
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

function formatHours(value: number): string {
  return `${value.toFixed(1)}h`;
}

interface DeltaChipProps {
  value: number;
  inverted?: boolean;
}

function DeltaChip({ value, inverted = false }: DeltaChipProps) {
  const isPositive = inverted ? value <= 0 : value >= 0;
  const arrow = value >= 0 ? '↑' : '↓';
  
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium",
      isPositive 
        ? "bg-[hsl(var(--bi-badge-positive))] text-[hsl(var(--bi-badge-positive-text))]" 
        : "bg-[hsl(var(--bi-badge-negative))] text-[hsl(var(--bi-badge-negative-text))]"
    )}>
      {arrow} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function TableSkeleton() {
  return (
    <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm">
      <CardHeader className="pb-2">
        <Skeleton className="h-6 w-40" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function LabourLocationsTable({ data, isLoading, metricMode }: LabourLocationsTableProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return <TableSkeleton />;
  }

  if (!data || data.length === 0) {
    return (
      <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm">
        <CardContent className="p-8 text-center text-muted-foreground">
          No location data available for the selected period.
        </CardContent>
      </Card>
    );
  }

  const locations = data.filter(row => !row.is_summary);
  const summary = data.find(row => row.is_summary);

  const handleRowClick = (locationId: string | null) => {
    if (locationId) {
      navigate(`/insights/labour/${locationId}`);
    }
  };

  // Determine which value to show based on metric mode for COL column
  const getColActual = (row: LabourLocationRow) => {
    if (metricMode === 'percentage') return formatPercent(row.col_actual_pct);
    if (metricMode === 'amount') return formatCurrency(row.labor_cost_actual);
    return formatHours(row.hours_actual);
  };

  const getColProjected = (row: LabourLocationRow) => {
    if (metricMode === 'percentage') return formatPercent(row.col_projected_pct);
    if (metricMode === 'amount') return formatCurrency(row.labor_cost_projected);
    return formatHours(row.hours_projected);
  };

  const colLabel = metricMode === 'percentage' ? 'COL' : metricMode === 'amount' ? 'Labour Cost' : 'Hours';

  return (
    <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Performance by Location</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            {/* Two-level header */}
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th rowSpan={2} className="text-left font-medium text-muted-foreground px-4 py-3 sticky left-0 bg-muted/30">
                  Location
                </th>
                <th colSpan={2} className="text-center font-medium text-muted-foreground px-2 py-2 border-l border-border">
                  Sales
                </th>
                <th colSpan={2} className="text-center font-medium text-muted-foreground px-2 py-2 border-l border-border">
                  {colLabel}
                </th>
                <th colSpan={2} className="text-center font-medium text-muted-foreground px-2 py-2 border-l border-border">
                  SPLH
                </th>
              </tr>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-center font-normal text-muted-foreground px-2 py-2 text-xs border-l border-border">Actual</th>
                <th className="text-center font-normal text-muted-foreground px-2 py-2 text-xs">Projected</th>
                <th className="text-center font-normal text-muted-foreground px-2 py-2 text-xs border-l border-border">Actual</th>
                <th className="text-center font-normal text-muted-foreground px-2 py-2 text-xs">Projected</th>
                <th className="text-center font-normal text-muted-foreground px-2 py-2 text-xs border-l border-border">Actual</th>
                <th className="text-center font-normal text-muted-foreground px-2 py-2 text-xs">Projected</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((row) => (
                <tr 
                  key={row.location_id} 
                  className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => handleRowClick(row.location_id)}
                >
                  <td className="px-4 py-3 font-medium sticky left-0 bg-card">
                    {row.location_name}
                  </td>
                  {/* Sales */}
                  <td className="px-2 py-3 text-center border-l border-border">
                    <div className="flex items-center justify-center gap-2">
                      <DeltaChip value={row.sales_delta_pct} />
                      <span className="font-medium">{formatCurrency(row.sales_actual)}</span>
                    </div>
                  </td>
                  <td className="px-2 py-3 text-center text-muted-foreground">
                    {formatCurrency(row.sales_projected)}
                  </td>
                  {/* COL / Cost / Hours */}
                  <td className="px-2 py-3 text-center border-l border-border">
                    <div className="flex items-center justify-center gap-2">
                      <DeltaChip value={row.col_delta_pct} inverted={metricMode !== 'hours'} />
                      <span className="font-medium">{getColActual(row)}</span>
                    </div>
                  </td>
                  <td className="px-2 py-3 text-center text-muted-foreground">
                    {getColProjected(row)}
                  </td>
                  {/* SPLH */}
                  <td className="px-2 py-3 text-center border-l border-border">
                    <div className="flex items-center justify-center gap-2">
                      <DeltaChip value={row.splh_delta_pct} />
                      <span className="font-medium">{formatSplh(row.splh_actual)}</span>
                    </div>
                  </td>
                  <td className="px-2 py-3 text-center text-muted-foreground">
                    {formatSplh(row.splh_projected)}
                  </td>
                </tr>
              ))}
              
              {/* Summary row */}
              {summary && (
                <tr className="bg-muted/50 font-semibold">
                  <td className="px-4 py-3 sticky left-0 bg-muted/50">
                    {summary.location_name}
                  </td>
                  <td className="px-2 py-3 text-center border-l border-border">
                    <div className="flex items-center justify-center gap-2">
                      <DeltaChip value={summary.sales_delta_pct} />
                      <span>{formatCurrency(summary.sales_actual)}</span>
                    </div>
                  </td>
                  <td className="px-2 py-3 text-center text-muted-foreground">
                    {formatCurrency(summary.sales_projected)}
                  </td>
                  <td className="px-2 py-3 text-center border-l border-border">
                    <div className="flex items-center justify-center gap-2">
                      <DeltaChip value={summary.col_delta_pct} inverted={metricMode !== 'hours'} />
                      <span>{getColActual(summary)}</span>
                    </div>
                  </td>
                  <td className="px-2 py-3 text-center text-muted-foreground">
                    {getColProjected(summary)}
                  </td>
                  <td className="px-2 py-3 text-center border-l border-border">
                    <div className="flex items-center justify-center gap-2">
                      <DeltaChip value={summary.splh_delta_pct} />
                      <span>{formatSplh(summary.splh_actual)}</span>
                    </div>
                  </td>
                  <td className="px-2 py-3 text-center text-muted-foreground">
                    {formatSplh(summary.splh_projected)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
