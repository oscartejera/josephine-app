/**
 * LabourKPICards - 4 KPI cards matching Nory design
 * Sales, Projected Sales, Actual COL, Projected COL
 */

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { LabourKpis, LabourDateRange, MetricMode } from '@/hooks/useLabourData';

interface LabourKPICardsProps {
  kpis: LabourKpis | undefined;
  isLoading: boolean;
  metricMode: MetricMode;
  dateRange: LabourDateRange;
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
  return `${value.toFixed(1)}h`;
}

interface DeltaBadgeProps {
  value: number;
  inverted?: boolean;
  label?: string;
}

function DeltaBadge({ value, inverted = false, label = 'vs forecast' }: DeltaBadgeProps) {
  // For COL, lower is better (inverted)
  const isPositive = inverted ? value <= 0 : value >= 0;
  const arrow = value >= 0 ? '▲' : '▼';
  
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
      isPositive 
        ? "bg-[hsl(var(--bi-badge-positive))] text-[hsl(var(--bi-badge-positive-text))]" 
        : "bg-[hsl(var(--bi-badge-negative))] text-[hsl(var(--bi-badge-negative-text))]"
    )}>
      <span className="text-[10px]">{arrow}</span>
      {Math.abs(value).toFixed(1)}% {label}
    </span>
  );
}

function KpiCardSkeleton() {
  return (
    <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm bg-card">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <Skeleton className="h-10 w-36 mb-2" />
        <Skeleton className="h-3 w-28" />
      </CardContent>
    </Card>
  );
}

export function LabourKPICards({ kpis, isLoading, metricMode, dateRange }: LabourKPICardsProps) {
  if (isLoading || !kpis) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
      </div>
    );
  }

  const dateLabel = `${format(dateRange.from, 'd MMM')} - ${format(dateRange.to, 'd MMM')}`;

  // Determine display values based on metric mode
  const getActualColValue = () => {
    if (metricMode === 'percentage') return formatPercent(kpis.actual_col_pct);
    if (metricMode === 'amount') return formatCurrency(kpis.actual_labor_cost);
    return formatHours(kpis.actual_labor_hours);
  };

  const getPlannedColValue = () => {
    if (metricMode === 'percentage') return formatPercent(kpis.planned_col_pct);
    if (metricMode === 'amount') return formatCurrency(kpis.planned_labor_cost);
    return formatHours(kpis.planned_labor_hours);
  };

  const getActualLabel = () => {
    if (metricMode === 'percentage') return 'Actual COL';
    if (metricMode === 'amount') return 'Actual labour cost';
    return 'Actual hours';
  };

  const getPlannedLabel = () => {
    if (metricMode === 'percentage') return 'Projected COL';
    if (metricMode === 'amount') return 'Projected labour cost';
    return 'Projected hours';
  };

  const getColDelta = () => {
    if (metricMode === 'hours') return kpis.hours_delta_pct;
    return kpis.col_delta_pct;
  };

  // Colors for bars (Josephine style)
  const COLORS = {
    actual: '#6366f1',
    forecast: '#c7d2fe',
    splh: '#10b981',
    oplh: '#f59e0b',
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Sales - with visual bar */}
      <Card className="p-5 bg-white">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <h3 className="text-sm font-normal text-gray-700">Sales</h3>
            <span className="text-xs text-gray-500">{dateLabel}</span>
          </div>
          
          <div className="space-y-1">
            <div className="text-3xl font-bold text-gray-900">{formatCurrency(kpis.actual_sales)}</div>
            <div className="flex items-center gap-2">
              <DeltaBadge value={kpis.sales_delta_pct} />
              <span className="text-xs text-gray-500">vs forecast</span>
            </div>
          </div>

          {/* Visual comparison bar */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">Actual vs Forecast</span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-sm overflow-hidden relative">
              <div 
                className="h-full absolute left-0 top-0 bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all"
                style={{ width: `${Math.min((kpis.actual_sales / kpis.forecast_sales) * 100, 100)}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-600">
              <span>Actual: {formatCurrency(kpis.actual_sales)}</span>
              <span>Forecast: {formatCurrency(kpis.forecast_sales)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Actual COL / Labour Cost / Hours - with target bar */}
      <Card className="p-5 bg-white">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <h3 className="text-sm font-normal text-gray-700">{getActualLabel()}</h3>
            <span className="text-xs text-gray-500">{dateLabel}</span>
          </div>
          
          <div className="space-y-1">
            <div className="text-3xl font-bold text-gray-900">{getActualColValue()}</div>
            <div className="flex items-center gap-2">
              <DeltaBadge value={getColDelta()} inverted={metricMode !== 'hours'} label="vs planned" />
              <span className="text-xs text-gray-500">vs planned</span>
            </div>
          </div>

          {/* Visual comparison bar for COL% */}
          {metricMode === 'percentage' && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">COL% Target: 28%</span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-sm overflow-hidden relative">
                <div 
                  className="h-full absolute left-0 top-0 transition-all"
                  style={{ 
                    width: `${Math.min((kpis.actual_col_pct / 35) * 100, 100)}%`,
                    background: kpis.actual_col_pct <= 28 ? 'linear-gradient(to right, #10b981, #059669)' : 'linear-gradient(to right, #f59e0b, #d97706)'
                  }}
                ></div>
                <div 
                  className="h-full absolute border-l-2 border-gray-400"
                  style={{ left: '80%' }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Actual: {formatPercent(kpis.actual_col_pct)}</span>
                <span>Planned: {formatPercent(kpis.planned_col_pct)}</span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* SPLH - with performance bar */}
      <Card className="p-5 bg-white">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <h3 className="text-sm font-normal text-gray-700">SPLH</h3>
            <span className="text-xs text-gray-500">{dateLabel}</span>
          </div>
          
          <div className="space-y-1">
            <div className="text-3xl font-bold text-gray-900">€{kpis.actual_splh.toFixed(0)}</div>
            <div className="flex items-center gap-2">
              <DeltaBadge value={kpis.splh_delta_pct} />
              <span className="text-xs text-gray-500">vs planned</span>
            </div>
          </div>

          {/* Visual comparison bar */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">Productivity</span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-sm overflow-hidden relative">
              <div 
                className="h-full absolute left-0 top-0 bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all"
                style={{ width: `${Math.min((kpis.actual_splh / (kpis.planned_splh * 1.2)) * 100, 100)}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-600">
              <span>Actual: €{kpis.actual_splh.toFixed(0)}</span>
              <span>Planned: €{kpis.planned_splh.toFixed(0)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* OPLH */}
      <Card className="p-5 bg-white">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <h3 className="text-sm font-normal text-gray-700">OPLH</h3>
            <span className="text-xs text-gray-500">{dateLabel}</span>
          </div>
          
          <div className="space-y-1">
            <div className="text-3xl font-bold text-gray-900">{kpis.actual_oplh.toFixed(1)}</div>
            <div className="flex items-center gap-2">
              <DeltaBadge value={kpis.oplh_delta_pct} />
              <span className="text-xs text-gray-500">vs planned</span>
            </div>
          </div>

          {/* Visual comparison bar */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">Orders efficiency</span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-sm overflow-hidden relative">
              <div 
                className="h-full absolute left-0 top-0 bg-gradient-to-r from-amber-500 to-amber-600 transition-all"
                style={{ width: `${Math.min((kpis.actual_oplh / (kpis.planned_oplh * 1.2)) * 100, 100)}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-600">
              <span>Actual: {kpis.actual_oplh.toFixed(1)}</span>
              <span>Planned: {kpis.planned_oplh.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
