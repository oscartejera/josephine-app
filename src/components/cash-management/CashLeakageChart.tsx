import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, Legend } from 'recharts';
import { format, parseISO } from 'date-fns';
import type { CashDailyData } from '@/hooks/useCashManagementData';

interface CashLeakageChartProps {
  data: CashDailyData[];
  isLoading?: boolean;
  currency?: string;
}

export function CashLeakageChart({ data, isLoading = false, currency = '€' }: CashLeakageChartProps) {
  const [viewMode, setViewMode] = useState<'eur' | 'pct'>('eur');

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map(d => ({
    ...d,
    date: format(parseISO(d.date), 'dd MMM'),
    discountsPct: d.netSales > 0 ? (d.discounts / d.netSales) * 100 : 0,
    compsPct: d.netSales > 0 ? (d.comps / d.netSales) * 100 : 0,
    voidsPct: d.netSales > 0 ? (d.voids / d.netSales) * 100 : 0,
    refundsPct: d.netSales > 0 ? (d.refunds / d.netSales) * 100 : 0,
  }));

  const formatValue = (value: number) => {
    if (viewMode === 'pct') {
      return `${value.toFixed(1)}%`;
    }
    return `${currency}${value.toLocaleString('es-ES', { maximumFractionDigits: 0 })}`;
  };

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-medium">Cash Leakage Over Time</CardTitle>
        <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'eur' | 'pct')}>
          <ToggleGroupItem value="eur" className="text-xs px-3">€</ToggleGroupItem>
          <ToggleGroupItem value="pct" className="text-xs px-3">%</ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 11 }} 
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                yAxisId="left"
                tick={{ fontSize: 11 }} 
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => viewMode === 'pct' ? `${value}%` : `${currency}${value >= 1000 ? `${(value/1000).toFixed(0)}k` : value}`}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11 }} 
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value.toFixed(1)}%`}
                hide={viewMode === 'pct'}
              />
              <Tooltip 
                formatter={(value: number, name: string) => [formatValue(value), name]}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Bar 
                dataKey={viewMode === 'pct' ? 'discountsPct' : 'discounts'} 
                stackId="a" 
                fill="hsl(var(--warning))" 
                name="Discounts"
                yAxisId="left"
              />
              <Bar 
                dataKey={viewMode === 'pct' ? 'compsPct' : 'comps'} 
                stackId="a" 
                fill="hsl(var(--info))" 
                name="Comps"
                yAxisId="left"
              />
              <Bar 
                dataKey={viewMode === 'pct' ? 'voidsPct' : 'voids'} 
                stackId="a" 
                fill="hsl(var(--muted-foreground))" 
                name="Voids"
                yAxisId="left"
              />
              <Bar 
                dataKey={viewMode === 'pct' ? 'refundsPct' : 'refunds'} 
                stackId="a" 
                fill="hsl(var(--destructive))" 
                name="Refunds"
                yAxisId="left"
              />
              <Line 
                type="monotone" 
                dataKey="leakagePct" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={false}
                name="Leakage %"
                yAxisId={viewMode === 'pct' ? 'left' : 'right'}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
