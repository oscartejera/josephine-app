import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ComposedChart, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import type { BISalesData, BIDateRange } from '@/hooks/useBISalesData';
import { cn } from '@/lib/utils';

interface BISalesChartProps {
  data: BISalesData | undefined;
  isLoading: boolean;
  granularity: string;
  dateRange: BIDateRange;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', { 
    style: 'currency', 
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  const actual = payload.find((p: any) => p.dataKey === 'actual')?.value || 0;
  const forecast = payload.find((p: any) => p.dataKey === 'forecast')?.value || 0;
  const forecastLive = payload.find((p: any) => p.dataKey === 'forecastLive')?.value || 0;
  const avgCheckSize = payload.find((p: any) => p.dataKey === 'avgCheckSize')?.value || 0;
  const avgCheckForecast = payload.find((p: any) => p.dataKey === 'avgCheckForecast')?.value || 0;

  const salesDelta = forecast > 0 ? ((actual - forecast) / forecast) * 100 : 0;
  const acsDelta = avgCheckForecast > 0 ? ((avgCheckSize - avgCheckForecast) / avgCheckForecast) * 100 : 0;

  return (
    <div className="bg-card border border-[hsl(var(--bi-border))] rounded-xl shadow-lg p-4 min-w-[220px]">
      <div className="flex items-center justify-between gap-4 mb-3 pb-2 border-b">
        <span className="font-semibold">Sales ({label})</span>
        <span className={cn(
          "text-xs px-2 py-0.5 rounded-full font-medium",
          salesDelta >= 0 
            ? "bg-[hsl(var(--bi-badge-positive))] text-[hsl(var(--bi-badge-positive-text))]"
            : "bg-[hsl(var(--bi-badge-negative))] text-[hsl(var(--bi-badge-negative-text))]"
        )}>
          {salesDelta >= 0 ? '+' : ''}{salesDelta.toFixed(1)}%
        </span>
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-[hsl(var(--bi-actual))]" />
            <span>Actual</span>
          </div>
          <span className="font-medium">{formatCurrency(actual)}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-[hsl(var(--bi-forecast-live))]" />
            <span>Forecast (Live)</span>
          </div>
          <span className="font-medium">{formatCurrency(forecastLive)}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-[hsl(var(--bi-forecast))]" />
            <span>Forecast</span>
          </div>
          <span className="font-medium">{formatCurrency(forecast)}</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t">
        <div className="flex items-center justify-between gap-4 mb-2">
          <span className="text-sm font-medium">Avg Check Size</span>
          <span className={cn(
            "text-xs px-2 py-0.5 rounded-full font-medium",
            acsDelta >= 0 
              ? "bg-[hsl(var(--bi-badge-positive))] text-[hsl(var(--bi-badge-positive-text))]"
              : "bg-[hsl(var(--bi-badge-negative))] text-[hsl(var(--bi-badge-negative-text))]"
          )}>
            {acsDelta >= 0 ? '+' : ''}{acsDelta.toFixed(1)}%
          </span>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[hsl(var(--bi-acs))]" />
              <span>Avg Check Size</span>
            </div>
            <span className="font-medium">€{avgCheckSize.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[hsl(var(--bi-acs-forecast))]" />
              <span>Avg Check Forecast</span>
            </div>
            <span className="font-medium">€{avgCheckForecast.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomLegend() {
  const items = [
    { label: 'Actual', color: 'hsl(var(--bi-actual))', type: 'bar' },
    { label: 'Forecast (Live)', color: 'hsl(var(--bi-forecast-live))', type: 'bar' },
    { label: 'Forecast', color: 'hsl(var(--bi-forecast))', type: 'bar' },
    { label: 'Avg Check Size', color: 'hsl(var(--bi-acs))', type: 'line' },
    { label: 'Avg Check Forecast', color: 'hsl(var(--bi-acs-forecast))', type: 'line' }
  ];

  return (
    <div className="flex flex-wrap justify-center gap-4 mt-4 text-sm">
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-2">
          {item.type === 'bar' ? (
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
          ) : (
            <div className="w-4 h-0.5 rounded" style={{ backgroundColor: item.color }} />
          )}
          <span className="text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function BISalesChart({ data, isLoading, granularity, dateRange }: BISalesChartProps) {
  if (isLoading || !data) {
    return (
      <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Sales v Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[350px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Sales v Forecast</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={data.chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis 
              dataKey="label" 
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              yAxisId="sales"
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
            />
            <YAxis 
              yAxisId="acs"
              orientation="right"
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `€${value.toFixed(0)}`}
            />
            <RechartsTooltip content={<CustomTooltip />} />
            
            {/* Bars */}
            <Bar 
              yAxisId="sales"
              dataKey="actual" 
              fill="hsl(var(--bi-actual))" 
              radius={[4, 4, 0, 0]}
              barSize={16}
            />
            <Bar 
              yAxisId="sales"
              dataKey="forecastLive" 
              fill="hsl(var(--bi-forecast-live))" 
              radius={[4, 4, 0, 0]}
              barSize={16}
            />
            <Bar 
              yAxisId="sales"
              dataKey="forecast" 
              fill="hsl(var(--bi-forecast))" 
              radius={[4, 4, 0, 0]}
              barSize={16}
            />
            
            {/* Lines */}
            <Line 
              yAxisId="acs"
              type="monotone" 
              dataKey="avgCheckSize" 
              stroke="hsl(var(--bi-acs))" 
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--bi-acs))', r: 4 }}
            />
            <Line 
              yAxisId="acs"
              type="monotone" 
              dataKey="avgCheckForecast" 
              stroke="hsl(var(--bi-acs-forecast))" 
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
        <CustomLegend />
      </CardContent>
    </Card>
  );
}
