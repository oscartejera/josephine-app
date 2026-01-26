import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ComposedChart, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer 
} from 'recharts';
import type { BISalesData, BIDateRange } from '@/hooks/useBISalesData';
import { cn } from '@/lib/utils';

interface BISalesChartProps {
  data: BISalesData | undefined;
  isLoading: boolean;
  granularity: string;
  dateRange: BIDateRange;
  view?: 'sales' | 'orders';
  onViewChange?: (view: 'sales' | 'orders') => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', { 
    style: 'currency', 
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

function LegendItem({ color, label, type }: { color: string; label: string; type: 'bar' | 'line' }) {
  return (
    <div className="flex items-center gap-1.5">
      {type === 'bar' ? (
        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: `hsl(var(--${color}))` }} />
      ) : (
        <div className="w-4 h-0.5 rounded" style={{ backgroundColor: `hsl(var(--${color}))` }} />
      )}
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}

function CustomTooltip({ active, payload, label, view }: any) {
  if (!active || !payload || !payload.length) return null;

  const actual = payload.find((p: any) => p.dataKey === 'actual')?.value || 0;
  const forecast = payload.find((p: any) => p.dataKey === 'forecast')?.value || 0;
  const avgCheckSize = payload.find((p: any) => p.dataKey === 'avgCheckSize')?.value || 0;
  const orders = payload.find((p: any) => p.dataKey === 'orders')?.value || 0;
  const forecastOrders = payload.find((p: any) => p.dataKey === 'forecastOrders')?.value || 0;

  const delta = forecast > 0 ? ((actual - forecast) / forecast) * 100 : 0;
  const ordersDelta = forecastOrders > 0 ? ((orders - forecastOrders) / forecastOrders) * 100 : 0;

  const isShowingOrders = view === 'orders';

  return (
    <div className="bg-card border border-[hsl(var(--bi-border))] rounded-xl shadow-lg p-3 min-w-[180px]">
      <div className="flex items-center justify-between gap-3 mb-2 pb-2 border-b">
        <span className="font-medium text-sm">{label}</span>
        <span className={cn(
          "text-xs px-1.5 py-0.5 rounded-full font-medium",
          (isShowingOrders ? ordersDelta : delta) >= 0 
            ? "bg-[hsl(var(--bi-badge-positive))] text-[hsl(var(--bi-badge-positive-text))]"
            : "bg-[hsl(var(--bi-badge-negative))] text-[hsl(var(--bi-badge-negative-text))]"
        )}>
          {(isShowingOrders ? ordersDelta : delta) >= 0 ? '+' : ''}{(isShowingOrders ? ordersDelta : delta).toFixed(1)}%
        </span>
      </div>
      
      <div className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-[hsl(var(--bi-actual))]" />
            <span className="text-muted-foreground">Actual</span>
          </div>
          <span className="font-medium">
            {isShowingOrders ? orders : formatCurrency(actual)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-[hsl(var(--bi-forecast))]" />
            <span className="text-muted-foreground">Forecast</span>
          </div>
          <span className="font-medium">
            {isShowingOrders ? forecastOrders : formatCurrency(forecast)}
          </span>
        </div>
        {!isShowingOrders && (
          <div className="flex items-center justify-between pt-1.5 border-t mt-1.5">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 rounded bg-[hsl(var(--bi-acs))]" />
              <span className="text-muted-foreground">Avg Check</span>
            </div>
            <span className="font-medium">€{avgCheckSize.toFixed(2)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function BISalesChart({ 
  data, 
  isLoading, 
  granularity, 
  dateRange,
  view = 'sales',
  onViewChange 
}: BISalesChartProps) {
  const [internalView, setInternalView] = useState<'sales' | 'orders'>('sales');
  const activeView = view ?? internalView;
  const handleViewChange = onViewChange ?? setInternalView;

  if (isLoading || !data) {
    return (
      <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-semibold">Sales v Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const showOrders = activeView === 'orders';

  return (
    <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-4">
          <CardTitle className="text-lg font-semibold">Sales v Forecast</CardTitle>
          <Tabs value={activeView} onValueChange={(v) => handleViewChange(v as 'sales' | 'orders')}>
            <TabsList className="h-7 bg-muted/50">
              <TabsTrigger value="sales" className="text-xs px-3 h-6 data-[state=active]:bg-background">
                Sales
              </TabsTrigger>
              <TabsTrigger value="orders" className="text-xs px-3 h-6 data-[state=active]:bg-background">
                Orders
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex items-center gap-4">
          <LegendItem color="bi-actual" label="Actual" type="bar" />
          <LegendItem color="bi-forecast" label="Forecast" type="bar" />
          {!showOrders && <LegendItem color="bi-acs" label="Avg Check" type="line" />}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis 
              dataKey="label" 
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              yAxisId="primary"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => showOrders ? value : `€${(value / 1000).toFixed(0)}k`}
              width={45}
            />
            {!showOrders && (
              <YAxis 
                yAxisId="acs"
                orientation="right"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `€${value.toFixed(0)}`}
                width={40}
              />
            )}
            <RechartsTooltip content={<CustomTooltip view={activeView} />} />
            
            {/* Bars - simplified to just Actual and Forecast */}
            <Bar 
              yAxisId="primary"
              dataKey={showOrders ? 'orders' : 'actual'} 
              fill="hsl(var(--bi-actual))" 
              radius={[3, 3, 0, 0]}
              barSize={showOrders ? 20 : 18}
            />
            <Bar 
              yAxisId="primary"
              dataKey={showOrders ? 'forecastOrders' : 'forecast'} 
              fill="hsl(var(--bi-forecast))" 
              radius={[3, 3, 0, 0]}
              barSize={showOrders ? 20 : 18}
            />
            
            {/* ACS Line - only for sales view, no dots per Nory style */}
            {!showOrders && (
              <Line 
                yAxisId="acs"
                type="monotone" 
                dataKey="avgCheckSize" 
                stroke="hsl(var(--bi-acs))" 
                strokeWidth={2}
                dot={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
