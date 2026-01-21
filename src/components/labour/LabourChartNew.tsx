/**
 * LabourChartNew - Labour over time chart matching Nory design
 * Bars: COL% Actual vs Planned (or Amount/Hours based on mode)
 * Lines: SPLH or OPLH (toggle)
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { LabourTimeseriesRow, MetricMode } from '@/hooks/useLabourDataNew';

interface LabourChartNewProps {
  data: LabourTimeseriesRow[];
  isLoading: boolean;
  metricMode: MetricMode;
}

type ChartMode = 'splh' | 'oplh';

function ChartSkeleton() {
  return (
    <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-32" />
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[350px] w-full" />
      </CardContent>
    </Card>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: string;
  metricMode: MetricMode;
  chartMode: ChartMode;
}

function CustomTooltip({ active, payload, label, metricMode, chartMode }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  const formatValue = (dataKey: string, value: number) => {
    if (dataKey.includes('col_pct')) return `${value.toFixed(2)}%`;
    if (dataKey.includes('splh') || dataKey.includes('oplh')) return `€${value.toFixed(2)}`;
    if (dataKey.includes('cost')) return `€${value.toLocaleString()}`;
    if (dataKey.includes('hours')) return `${value.toFixed(1)}h`;
    return value.toFixed(2);
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium mb-2">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 py-0.5">
          <span 
            className="w-3 h-3 rounded-sm" 
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">{formatValue(entry.dataKey, entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function LabourChartNew({ data, isLoading, metricMode }: LabourChartNewProps) {
  const [chartMode, setChartMode] = useState<ChartMode>('splh');

  if (isLoading) {
    return <ChartSkeleton />;
  }

  // Transform data for chart
  const chartData = data.map(row => ({
    ...row,
    date: format(new Date(row.date), 'dd MMM'),
  }));

  // Determine bar and line data keys based on metric mode
  const getBarConfig = () => {
    if (metricMode === 'percentage') {
      return {
        actualKey: 'actual_col_pct',
        plannedKey: 'planned_col_pct',
        actualName: 'COL % Actual',
        plannedName: 'COL % Planned',
        unit: '%',
      };
    }
    if (metricMode === 'amount') {
      return {
        actualKey: 'actual_labor_cost',
        plannedKey: 'planned_labor_cost',
        actualName: 'Labour Cost Actual',
        plannedName: 'Labour Cost Planned',
        unit: '€',
      };
    }
    return {
      actualKey: 'actual_hours',
      plannedKey: 'planned_hours',
      actualName: 'Hours Actual',
      plannedName: 'Hours Planned',
      unit: 'h',
    };
  };

  const getLineConfig = () => {
    if (chartMode === 'splh') {
      return {
        actualKey: 'actual_splh',
        plannedKey: 'planned_splh',
        actualName: 'SPLH Actual',
        plannedName: 'SPLH Planned',
      };
    }
    return {
      actualKey: 'actual_oplh',
      plannedKey: 'planned_oplh',
      actualName: 'OPLH Actual',
      plannedName: 'OPLH Planned',
    };
  };

  const barConfig = getBarConfig();
  const lineConfig = getLineConfig();

  return (
    <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-semibold">Labour over time</CardTitle>
          
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
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
              />
              <YAxis 
                yAxisId="left"
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `${value}${barConfig.unit === '€' ? '€' : barConfig.unit}`}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `€${value}`}
              />
              <Tooltip 
                content={<CustomTooltip metricMode={metricMode} chartMode={chartMode} />}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                formatter={(value) => <span className="text-sm text-muted-foreground">{value}</span>}
              />
              
              {/* Bars for COL/Cost/Hours */}
              <Bar 
                yAxisId="left"
                dataKey={barConfig.actualKey} 
                name={barConfig.actualName}
                fill="hsl(var(--bi-actual))"
                radius={[4, 4, 0, 0]}
                barSize={20}
              />
              <Bar 
                yAxisId="left"
                dataKey={barConfig.plannedKey} 
                name={barConfig.plannedName}
                fill="hsl(var(--bi-forecast))"
                radius={[4, 4, 0, 0]}
                barSize={20}
              />
              
              {/* Lines for SPLH/OPLH */}
              <Line 
                yAxisId="right"
                type="monotone"
                dataKey={lineConfig.actualKey}
                name={lineConfig.actualName}
                stroke="hsl(var(--bi-acs))"
                strokeWidth={2}
                dot={{ r: 4, fill: 'hsl(var(--bi-acs))' }}
              />
              <Line 
                yAxisId="right"
                type="monotone"
                dataKey={lineConfig.plannedKey}
                name={lineConfig.plannedName}
                stroke="hsl(var(--bi-acs-forecast))"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 4, fill: 'hsl(var(--bi-acs-forecast))' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
