import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, Legend } from 'recharts';
import { format, parseISO } from 'date-fns';
import type { BudgetDailyData, BudgetTab } from '@/hooks/useBudgetsData';

interface BudgetChartProps {
  data: BudgetDailyData[];
  activeTab: BudgetTab;
  isLoading?: boolean;
  currency?: string;
}

export function BudgetChart({ data, activeTab, isLoading = false, currency = '€' }: BudgetChartProps) {
  const [viewMode, setViewMode] = useState<'eur' | 'pct'>('eur');
  const [granularity, setGranularity] = useState<'daily' | 'weekly'>('daily');

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

  const getDataKeys = () => {
    switch (activeTab) {
      case 'sales':
        return { actualKey: 'salesActual', budgetKey: 'salesBudget' };
      case 'labour':
        return { actualKey: 'labourActual', budgetKey: 'labourBudget' };
      case 'cogs':
        return { actualKey: 'cogsActual', budgetKey: 'cogsBudget' };
      case 'prime':
        return { actualKey: viewMode === 'pct' ? 'primePctActual' : 'primeActual', budgetKey: viewMode === 'pct' ? 'primePctBudget' : 'primeBudget' };
      default:
        return { actualKey: 'salesActual', budgetKey: 'salesBudget' };
    }
  };

  const { actualKey, budgetKey } = getDataKeys();

  const chartData = data.map(d => ({
    ...d,
    date: format(parseISO(d.date), 'dd MMM'),
  }));

  const formatValue = (value: number) => {
    if (viewMode === 'pct' || activeTab === 'prime') {
      return `${value.toFixed(1)}%`;
    }
    return `${currency}${value.toLocaleString('es-ES', { maximumFractionDigits: 0 })}`;
  };

  const tabLabels = {
    sales: 'Sales',
    labour: 'Labour',
    cogs: 'COGS',
    prime: 'Prime Cost',
  };

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-medium">{tabLabels[activeTab]} - Actual vs Budget</CardTitle>
        <div className="flex gap-2">
          <ToggleGroup type="single" value={granularity} onValueChange={(v) => v && setGranularity(v as 'daily' | 'weekly')}>
            <ToggleGroupItem value="daily" className="text-xs px-3">Daily</ToggleGroupItem>
            <ToggleGroupItem value="weekly" className="text-xs px-3">Weekly</ToggleGroupItem>
          </ToggleGroup>
          {activeTab !== 'prime' && (
            <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'eur' | 'pct')}>
              <ToggleGroupItem value="eur" className="text-xs px-3">€</ToggleGroupItem>
              <ToggleGroupItem value="pct" className="text-xs px-3">%</ToggleGroupItem>
            </ToggleGroup>
          )}
        </div>
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
                tick={{ fontSize: 11 }} 
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => {
                  if (viewMode === 'pct' || activeTab === 'prime') return `${value}%`;
                  return `${currency}${value >= 1000 ? `${(value/1000).toFixed(0)}k` : value}`;
                }}
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
                dataKey={actualKey} 
                fill="hsl(var(--primary))" 
                name="Actual" 
                radius={[4, 4, 0, 0]}
              />
              <Line 
                type="monotone" 
                dataKey={budgetKey} 
                stroke="hsl(var(--muted-foreground))" 
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name="Budget"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
