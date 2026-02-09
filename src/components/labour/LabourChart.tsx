/**
 * LabourChart - Labour over time chart matching Nory design
 * Bars: COL% Actual vs Planned (or Amount/Hours based on mode)
 * Lines: SPLH or OPLH (toggle)
 * Click on bar for hourly drill-down
 */

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { format, isSameDay } from 'date-fns';
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
import type { LabourTimeseriesRow, MetricMode } from '@/hooks/useLabourData';
import { LabourHourlyDrillDown } from './LabourHourlyDrillDown';

interface LabourChartProps {
  data: LabourTimeseriesRow[];
  isLoading: boolean;
  metricMode: MetricMode;
}

type ChartMode = 'splh' | 'oplh';

// Josephine colors - matching Sales module
const CHART_COLORS = {
  actual: '#6366f1', // Indigo for Actual
  planned: '#c7d2fe', // Light indigo for Planned
  splh: '#f97316', // Orange for SPLH
  splhPlanned: '#fed7aa', // Light orange for SPLH Planned
  oplh: '#10b981', // Green for OPLH
  oplhPlanned: '#86efac', // Light green for OPLH Planned
};

function ChartSkeleton() {
  return (
    <Card className="p-6 bg-white">
      <div className="flex justify-between items-center mb-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-32" />
      </div>
      <Skeleton className="h-[350px] w-full" />
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

  // Get actual data from payload
  const data = payload[0]?.payload;
  if (!data) return null;

  // Calculate variances
  const colVariance = data.planned_col_pct > 0 ? ((data.actual_col_pct - data.planned_col_pct) / data.planned_col_pct) * 100 : 0;
  const splhVariance = data.planned_splh > 0 ? ((data.actual_splh - data.planned_splh) / data.planned_splh) * 100 : 0;
  const oplhVariance = data.planned_oplh > 0 ? ((data.actual_oplh - data.planned_oplh) / data.planned_oplh) * 100 : 0;
  const relevantVariance = chartMode === 'splh' ? splhVariance : oplhVariance;

  const TrendIcon = relevantVariance >= 0 ? '↗' : '↘';
  const varianceColor = relevantVariance >= 0 ? '#10b981' : '#f43f5e';

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-xl p-4 min-w-[280px]">
      {/* COL / Hours / Cost Section */}
      <div className="mb-3 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-gray-900">
            {metricMode === 'percentage' ? 'COL %' : metricMode === 'amount' ? 'Labour Cost' : 'Hours'} ({label})
          </span>
          <span className="flex items-center gap-1 text-sm font-medium" style={{ color: colVariance <= 0 ? '#10b981' : '#f43f5e' }}>
            {colVariance <= 0 ? '↗' : '↘'} {Math.abs(colVariance).toFixed(2)}%
          </span>
        </div>
        <div className="space-y-1.5 text-sm">
          {payload.slice(0, 2).map((entry, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: entry.color }}></div>
              <span className="text-gray-600">{entry.name}:</span>
              <span className="ml-auto font-semibold text-gray-900">{formatValue(entry.dataKey, entry.value)}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* SPLH/OPLH Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-gray-900">{chartMode === 'splh' ? 'SPLH' : 'OPLH'}</span>
          <span className="flex items-center gap-1 text-sm font-medium" style={{ color: varianceColor }}>
            {TrendIcon} {Math.abs(relevantVariance).toFixed(2)}%
          </span>
        </div>
        <div className="space-y-1.5 text-sm">
          {payload.slice(2, 4).map((entry, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
              <span className="text-gray-600">{entry.name}:</span>
              <span className="ml-auto font-semibold text-gray-900">{formatValue(entry.dataKey, entry.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LabourChart({ data, isLoading, metricMode }: LabourChartProps) {
  const [chartMode, setChartMode] = useState<ChartMode>('splh');
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [selectedDayData, setSelectedDayData] = useState<any>(null);

  if (isLoading || !data || data.length === 0) {
    return <ChartSkeleton />;
  }

  // Generate hourly labour data for drill-down
  const generateHourlyData = (dayData: any) => {
    const operatingHours = [
      { hour: '10:00', weight: 0.03 },
      { hour: '11:00', weight: 0.05 },
      { hour: '12:00', weight: 0.09 },
      { hour: '13:00', weight: 0.12 },
      { hour: '14:00', weight: 0.13 },
      { hour: '15:00', weight: 0.07 },
      { hour: '16:00', weight: 0.04 },
      { hour: '17:00', weight: 0.05 },
      { hour: '18:00', weight: 0.08 },
      { hour: '19:00', weight: 0.11 },
      { hour: '20:00', weight: 0.12 },
      { hour: '21:00', weight: 0.09 },
      { hour: '22:00', weight: 0.02 },
    ];

    const totalSales = dayData.actual_sales || 0;
    const totalHours = dayData.actual_hours || 0;
    const totalPlannedHours = dayData.planned_hours || 0;

    const hourlyData = operatingHours.map((slot) => {
      const actualSales = Math.round(totalSales * slot.weight * (0.9 + Math.random() * 0.2));
      const actualHours = totalHours * slot.weight * (0.9 + Math.random() * 0.2);
      const plannedHours = totalPlannedHours * slot.weight;
      const actualSPLH = actualHours > 0 ? actualSales / actualHours : 0;
      const plannedSPLH = plannedHours > 0 ? (actualSales * 0.98) / plannedHours : 0;
      const actualLaborCost = actualHours * 15; // €15/hour avg
      const actualCOL = actualSales > 0 ? (actualLaborCost / actualSales) * 100 : 0;
      const plannedCOL = actualCOL * 0.95;
      const variance = plannedCOL > 0 ? ((actualCOL - plannedCOL) / plannedCOL) * 100 : 0;

      return {
        hour: slot.hour,
        actualCOL,
        plannedCOL,
        actualSPLH,
        plannedSPLH,
        actualHours,
        plannedHours,
        actualSales,
        variance,
      };
    });

    const totalActualHours = hourlyData.reduce((sum, h) => sum + h.actualHours, 0);
    const totalSalesSum = hourlyData.reduce((sum, h) => sum + h.actualSales, 0);
    const totalActualSPLH = totalActualHours > 0 ? totalSalesSum / totalActualHours : 0;
    const totalActualCOL = dayData.actual_col_pct || 0;
    const totalPlannedCOL = dayData.planned_col_pct || 0;

    return {
      day: dayData.date,
      date: dayData.date,
      hourlyData,
      totalActualCOL,
      totalPlannedCOL,
      totalActualSPLH,
      totalHours: totalActualHours,
    };
  };

  // Handle chart click for drill-down
  const handleChartClick = (data: any) => {
    if (!data || !data.activePayload || !data.activePayload[0]) return;
    
    const dayData = data.activePayload[0].payload;
    const drillDownData = generateHourlyData(dayData);
    setSelectedDayData(drillDownData);
    setDrillDownOpen(true);
  };

  // Detect single-day (Today mode) → show hourly breakdown
  const isSingleDayView = data.length === 1 || (data.length > 0 && isSameDay(new Date(data[0].date), new Date(data[data.length - 1].date)));

  // Transform data for chart - hourly for single day, daily for ranges
  const chartData = useMemo(() => {
    if (isSingleDayView && data.length > 0) {
      // Generate hourly data from the single day's totals
      const dayData = data[0];
      const HOURLY_WEIGHTS = [
        { hour: '10:00', weight: 0.03 },
        { hour: '11:00', weight: 0.05 },
        { hour: '12:00', weight: 0.09 },
        { hour: '13:00', weight: 0.12 },
        { hour: '14:00', weight: 0.13 },
        { hour: '15:00', weight: 0.07 },
        { hour: '16:00', weight: 0.04 },
        { hour: '17:00', weight: 0.05 },
        { hour: '18:00', weight: 0.08 },
        { hour: '19:00', weight: 0.11 },
        { hour: '20:00', weight: 0.12 },
        { hour: '21:00', weight: 0.09 },
        { hour: '22:00', weight: 0.02 },
      ];

      return HOURLY_WEIGHTS.map(slot => {
        const w = slot.weight;
        const actualSales = (dayData.actual_sales || 0) * w;
        const forecastSales = (dayData.forecast_sales || 0) * w;
        const actualCost = (dayData.actual_labor_cost || 0) * w;
        const plannedCost = (dayData.planned_labor_cost || 0) * w;
        const actualHrs = (dayData.actual_hours || 0) * w;
        const plannedHrs = (dayData.planned_hours || 0) * w;
        const actualOrders = (dayData.actual_orders || 0) * w;
        const forecastOrders = (dayData.forecast_orders || 0) * w;

        return {
          date: slot.hour,
          actual_sales: actualSales,
          forecast_sales: forecastSales,
          actual_labor_cost: actualCost,
          planned_labor_cost: plannedCost,
          actual_hours: actualHrs,
          planned_hours: plannedHrs,
          actual_orders: actualOrders,
          forecast_orders: forecastOrders,
          actual_col_pct: actualSales > 0 ? (actualCost / actualSales) * 100 : 0,
          planned_col_pct: forecastSales > 0 ? (plannedCost / forecastSales) * 100 : 0,
          actual_splh: actualHrs > 0 ? actualSales / actualHrs : 0,
          planned_splh: plannedHrs > 0 ? forecastSales / plannedHrs : 0,
          actual_oplh: actualHrs > 0 ? actualOrders / actualHrs : 0,
          planned_oplh: plannedHrs > 0 ? forecastOrders / plannedHrs : 0,
        };
      });
    }

    return data.map(row => ({
      ...row,
      date: format(new Date(row.date), 'dd MMM'),
    }));
  }, [data, isSingleDayView]);

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

  // Determine colors for lines based on chart mode
  const lineColor = chartMode === 'splh' ? CHART_COLORS.splh : CHART_COLORS.oplh;
  const lineColorPlanned = chartMode === 'splh' ? CHART_COLORS.splhPlanned : CHART_COLORS.oplhPlanned;

  return (
    <Card className="p-6 bg-white">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base font-semibold text-gray-900">Labour over time</h3>
        
        {/* SPLH / OPLH Toggle */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-3 rounded-md text-xs font-medium transition-all",
              chartMode === 'splh' 
                ? "bg-white shadow-sm text-gray-900" 
                : "text-gray-600 hover:text-gray-900"
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
                ? "bg-white shadow-sm text-gray-900" 
                : "text-gray-600 hover:text-gray-900"
            )}
            onClick={() => setChartMode('oplh')}
          >
            OPLH
          </Button>
        </div>
      </div>

      <div className="h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart 
            data={chartData} 
            margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
            barGap={2}
            barCategoryGap="15%"
            onClick={handleChartClick}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={false}
            />
            <YAxis 
              yAxisId="left"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `${value}${barConfig.unit === '€' ? '€' : barConfig.unit}`}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `€${value}`}
            />
            <Tooltip 
              content={<CustomTooltip metricMode={metricMode} chartMode={chartMode} />}
            />
            <Legend 
              verticalAlign="bottom"
              height={36}
              iconType="rect"
              iconSize={10}
              wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }}
            />
            
            {/* Bars for COL/Cost/Hours */}
            <Bar 
              yAxisId="left"
              dataKey={barConfig.actualKey} 
              name={barConfig.actualName}
              fill={CHART_COLORS.actual}
              radius={[3, 3, 0, 0]}
              maxBarSize={40}
              cursor="pointer"
            />
            <Bar 
              yAxisId="left"
              dataKey={barConfig.plannedKey} 
              name={barConfig.plannedName}
              fill={CHART_COLORS.planned}
              radius={[3, 3, 0, 0]}
              maxBarSize={40}
              cursor="pointer"
            />
            
            {/* Lines for SPLH/OPLH */}
            <Line 
              yAxisId="right"
              type="monotone"
              dataKey={lineConfig.actualKey}
              name={lineConfig.actualName}
              stroke={lineColor}
              strokeWidth={2.5}
              dot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
            />
            <Line 
              yAxisId="right"
              type="monotone"
              dataKey={lineConfig.plannedKey}
              name={lineConfig.plannedName}
              stroke={lineColorPlanned}
              strokeWidth={2.5}
              dot={{ r: 4, fill: lineColorPlanned, strokeWidth: 0 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Hourly Drill-Down Drawer */}
      {selectedDayData && (
        <LabourHourlyDrillDown
          open={drillDownOpen}
          onOpenChange={setDrillDownOpen}
          selectedDay={selectedDayData.day}
          selectedDate={selectedDayData.date}
          hourlyData={selectedDayData.hourlyData}
          totalActualCOL={selectedDayData.totalActualCOL}
          totalPlannedCOL={selectedDayData.totalPlannedCOL}
          totalActualSPLH={selectedDayData.totalActualSPLH}
          totalHours={selectedDayData.totalHours}
        />
      )}
    </Card>
  );
}
