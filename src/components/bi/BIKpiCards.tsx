import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BISalesData, CompareMode } from '@/hooks/useBISalesData';
import { Skeleton } from '@/components/ui/skeleton';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface BIKpiCardsProps {
  data: BISalesData | undefined;
  isLoading: boolean;
  compareMode: CompareMode;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', { 
    style: 'currency', 
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-ES').format(value);
}

function DeltaBadge({ value, suffix = '' }: { value: number; suffix?: string }) {
  const isPositive = value >= 0;
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
      isPositive 
        ? "bg-[hsl(var(--bi-badge-positive))] text-[hsl(var(--bi-badge-positive-text))]" 
        : "bg-[hsl(var(--bi-badge-negative))] text-[hsl(var(--bi-badge-negative-text))]"
    )}>
      {isPositive ? '+' : ''}{value.toFixed(1)}%{suffix}
    </span>
  );
}

function KpiSparkline({ data, color = 'bi-actual' }: { data: number[]; color?: string }) {
  const chartData = data.map((v, i) => ({ v }));
  
  return (
    <div className="h-6 w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={`hsl(var(--${color}))`} stopOpacity={0.3} />
              <stop offset="100%" stopColor={`hsl(var(--${color}))`} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <Area 
            type="monotone" 
            dataKey="v" 
            fill={`url(#gradient-${color})`}
            stroke={`hsl(var(--${color}))`}
            strokeWidth={1.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChannelBar({ data }: { data: { channel: string; value: number; percentage: number }[] }) {
  const colors: Record<string, string> = {
    'Dine-in': 'bg-[hsl(var(--bi-actual))]',
    'Pick-up': 'bg-[hsl(var(--bi-actual))]/60',
    'Delivery': 'bg-[hsl(var(--bi-actual))]/30'
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex h-2.5 rounded-full overflow-hidden bg-muted">
        {data.map((item) => (
          <div 
            key={item.channel}
            className={cn("h-full", colors[item.channel] || 'bg-primary')}
            style={{ width: `${item.percentage}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        {data.map(item => (
          <span key={item.channel}>
            {item.channel} {item.percentage}%
          </span>
        ))}
      </div>
    </div>
  );
}

function AcsBar({ data }: { data: { channel: string; value: number }[] }) {
  const maxValue = Math.max(...data.map(d => d.value));
  const colors: Record<string, string> = {
    'Dine-in': 'bg-[hsl(var(--bi-acs))]',
    'Pick-up': 'bg-[hsl(var(--bi-acs))]/70',
    'Delivery': 'bg-[hsl(var(--bi-acs))]/50'
  };

  return (
    <div className="mt-3 space-y-1.5">
      {data.map(item => (
        <div key={item.channel} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-14 truncate">{item.channel}</span>
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className={cn("h-full rounded-full", colors[item.channel] || 'bg-warning')}
              style={{ width: `${(item.value / maxValue) * 100}%` }}
            />
          </div>
          <span className="text-xs font-medium w-10 text-right">€{item.value.toFixed(0)}</span>
        </div>
      ))}
    </div>
  );
}

function KpiCardSkeleton() {
  return (
    <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm">
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <Skeleton className="h-9 w-28 mb-3" />
        <Skeleton className="h-6 w-full" />
      </CardContent>
    </Card>
  );
}

export function BIKpiCards({ data, isLoading, compareMode }: BIKpiCardsProps) {
  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
      </div>
    );
  }

  const compareLabel = compareMode === 'forecast' ? 'vs forecast' : compareMode === 'previous_period' ? 'vs prev.' : 'vs LY';

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Sales to date */}
      <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm">
        <CardContent className="p-5">
          <div className="flex justify-between items-start mb-1">
            <span className="text-sm text-muted-foreground">Sales to date</span>
            <DeltaBadge value={data.kpis.salesToDateDelta} />
          </div>
          <div className="text-3xl font-bold tracking-tight">
            {formatCurrency(data.kpis.salesToDate)}
          </div>
          {data.kpis.salesSparkline && data.kpis.salesSparkline.length > 0 && (
            <KpiSparkline data={data.kpis.salesSparkline} color="bi-actual" />
          )}
          <ChannelBar data={data.kpis.channelBreakdown} />
        </CardContent>
      </Card>

      {/* Average check size */}
      <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm">
        <CardContent className="p-5">
          <div className="flex justify-between items-start mb-1">
            <span className="text-sm text-muted-foreground">Avg check size</span>
            <DeltaBadge value={data.kpis.avgCheckSizeDelta} />
          </div>
          <div className="text-3xl font-bold tracking-tight">
            €{data.kpis.avgCheckSize.toFixed(2)}
          </div>
          {data.kpis.acsSparkline && data.kpis.acsSparkline.length > 0 && (
            <KpiSparkline data={data.kpis.acsSparkline} color="bi-acs" />
          )}
          <AcsBar data={data.kpis.acsBreakdown} />
        </CardContent>
      </Card>

      {/* Orders */}
      <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm">
        <CardContent className="p-5">
          <div className="flex justify-between items-start mb-1">
            <span className="text-sm text-muted-foreground">Orders</span>
            <DeltaBadge value={data.kpis.totalOrdersDelta} />
          </div>
          <div className="text-3xl font-bold tracking-tight">
            {formatNumber(data.kpis.totalOrders)}
          </div>
          {data.kpis.ordersSparkline && data.kpis.ordersSparkline.length > 0 && (
            <KpiSparkline data={data.kpis.ordersSparkline} color="bi-actual" />
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Total orders in selected period
          </p>
        </CardContent>
      </Card>

      {/* Forecast Accuracy */}
      <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm">
        <CardContent className="p-5">
          <div className="flex justify-between items-start mb-1">
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">Forecast accuracy</span>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Based on MAPE of actual vs forecast</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          <div className="text-3xl font-bold tracking-tight">
            {data.kpis.forecastAccuracy > 0 ? `${data.kpis.forecastAccuracy}%` : '—'}
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Model confidence</span>
              <span>{data.kpis.forecastAccuracy}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all",
                  data.kpis.forecastAccuracy >= 90 ? "bg-[hsl(var(--success))]" :
                  data.kpis.forecastAccuracy >= 75 ? "bg-[hsl(var(--bi-acs))]" :
                  "bg-[hsl(var(--destructive))]"
                )}
                style={{ width: `${data.kpis.forecastAccuracy}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
