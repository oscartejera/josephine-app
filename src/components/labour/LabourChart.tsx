/**
 * Labour Chart - "Labour over time" with SPLH/OPLH toggle
 * Mixed bar + line chart like Nory - purple bars, orange lines
 */

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import type { LabourData, MetricMode, ChartMode } from '@/hooks/useLabourData';

interface LabourChartProps {
  data: LabourData | undefined;
  isLoading: boolean;
  metricMode: MetricMode;
}

function ChartSkeleton() {
  return (
    <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm bg-card">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-6 w-40" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
        <Skeleton className="h-[350px] w-full" />
      </CardContent>
    </Card>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  metricMode: MetricMode;
}

function CustomTooltip({ active, payload, label, metricMode }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  // Label is the dateLabel (e.g., "Mon 13")
  const displayLabel = label || '';

  const formatValue = (name: string, value: number) => {
    if (name.includes('COL') || name.includes('%')) {
      return `${value.toFixed(1)}%`;
    }
    if (name.includes('SPLH') || name.includes('OPLH')) {
      return `€${value.toFixed(0)}`;
    }
    if (name.includes('Cost') || name.includes('Labour')) {
      return `€${value.toFixed(0)}`;
    }
    if (name.includes('Hours')) {
      return `${value.toFixed(1)}h`;
    }
    return value.toFixed(1);
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-lg p-4 min-w-[220px]">
      <p className="text-sm font-semibold mb-3 capitalize">{displayLabel}</p>
      <div className="space-y-2">
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-muted-foreground">{entry.name}</span>
            </div>
            <span className="text-xs font-medium">
              {formatValue(entry.name, entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LabourChart({ data, isLoading, metricMode }: LabourChartProps) {
  const [chartMode, setChartMode] = useState<ChartMode>('splh');

  if (isLoading || !data) {
    return <ChartSkeleton />;
  }

  const chartData = data.dailyData.map(d => ({
    date: d.date,
    dateLabel: d.dateLabel,
    colActual: d.colActual,
    colPlanned: d.colPlanned,
    splhActual: d.splhActual,
    splhPlanned: d.splhPlanned,
    oplhActual: d.oplhActual,
    oplhPlanned: d.oplhPlanned,
    labourCostActual: d.labourCostActual,
    labourCostPlanned: d.labourCostPlanned,
    hoursActual: d.hoursActual,
    hoursPlanned: d.hoursPlanned
  }));

  // Determine which metrics to show based on mode
  const getBarMetrics = () => {
    if (metricMode === 'percentage') {
      return { actual: 'colActual', planned: 'colPlanned', label: 'COL %' };
    }
    if (metricMode === 'amount') {
      return { actual: 'labourCostActual', planned: 'labourCostPlanned', label: 'Labour Cost' };
    }
    return { actual: 'hoursActual', planned: 'hoursPlanned', label: 'Hours' };
  };

  const barMetrics = getBarMetrics();
  const lineMetric = chartMode === 'splh' 
    ? { actual: 'splhActual', planned: 'splhPlanned', label: 'SPLH' }
    : { actual: 'oplhActual', planned: 'oplhPlanned', label: 'OPLH' };

  return (
    <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm bg-card">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold">Labour over time</h3>
          
          <div className="flex items-center gap-2">
            {/* SPLH / OPLH Toggle */}
            <div className="flex items-center bg-muted rounded-lg p-0.5">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-3 rounded-md text-xs font-medium transition-all",
                  chartMode === 'splh' 
                    ? "bg-background shadow-sm text-foreground" 
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setChartMode('splh')}
              >
                SPLH
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-3 rounded-md text-xs font-medium transition-all",
                  chartMode === 'oplh' 
                    ? "bg-background shadow-sm text-foreground" 
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setChartMode('oplh')}
              >
                OPLH
              </Button>
            </div>
            
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                vertical={false}
              />
              <XAxis 
                dataKey="dateLabel" 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
              />
              <YAxis 
                yAxisId="left"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => 
                  metricMode === 'percentage' 
                    ? `${v}%` 
                    : metricMode === 'amount' 
                      ? `€${(v/1000).toFixed(0)}k`
                      : `${v}h`
                }
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `€${v.toFixed(0)}`}
              />
              <Tooltip content={<CustomTooltip metricMode={metricMode} />} />
              <Legend 
                verticalAlign="bottom"
                height={36}
                iconType="rect"
                iconSize={12}
                formatter={(value) => (
                  <span className="text-xs text-muted-foreground">{value}</span>
                )}
              />
              
              {/* Bars for COL / Labour Cost / Hours */}
              <Bar 
                yAxisId="left"
                dataKey={barMetrics.actual}
                name={`${barMetrics.label} Actual`}
                fill="hsl(var(--bi-actual))"
                radius={[4, 4, 0, 0]}
                barSize={16}
              />
              <Bar 
                yAxisId="left"
                dataKey={barMetrics.planned}
                name={`${barMetrics.label} Planned`}
                fill="hsl(var(--bi-forecast))"
                radius={[4, 4, 0, 0]}
                barSize={16}
              />
              
              {/* Lines for SPLH / OPLH */}
              <Line 
                yAxisId="right"
                type="monotone"
                dataKey={lineMetric.actual}
                name={`${lineMetric.label} Actual`}
                stroke="hsl(var(--bi-acs))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--bi-acs))', r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line 
                yAxisId="right"
                type="monotone"
                dataKey={lineMetric.planned}
                name={`${lineMetric.label} Planned`}
                stroke="hsl(var(--bi-acs-forecast))"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: 'hsl(var(--bi-acs-forecast))', r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
