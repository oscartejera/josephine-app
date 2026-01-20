import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BISalesData, CompareMode } from '@/hooks/useBISalesData';
import { Skeleton } from '@/components/ui/skeleton';

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

function DeltaBadge({ value, suffix = '' }: { value: number; suffix?: string }) {
  const isPositive = value >= 0;
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
      isPositive 
        ? "bg-[hsl(var(--bi-badge-positive))] text-[hsl(var(--bi-badge-positive-text))]" 
        : "bg-[hsl(var(--bi-badge-negative))] text-[hsl(var(--bi-badge-negative-text))]"
    )}>
      {isPositive ? '+' : ''}{value.toFixed(2)}%{suffix}
    </span>
  );
}

function ChannelBar({ data }: { data: { channel: string; value: number; percentage: number }[] }) {
  const colors: Record<string, string> = {
    'Dine-in': 'bg-[hsl(var(--bi-actual))]',
    'Pick-up': 'bg-[hsl(var(--bi-forecast-live))]',
    'Delivery': 'bg-[hsl(var(--bi-forecast))]'
  };

  return (
    <div className="mt-4 space-y-2">
      <div className="flex h-3 rounded-full overflow-hidden bg-muted">
        {data.map((item, i) => (
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
    <div className="mt-4 space-y-2">
      {data.map(item => (
        <div key={item.channel} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-16">{item.channel}</span>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className={cn("h-full rounded-full", colors[item.channel] || 'bg-warning')}
              style={{ width: `${(item.value / maxValue) * 100}%` }}
            />
          </div>
          <span className="text-xs font-medium w-12 text-right">€{item.value.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

function KpiCardSkeleton() {
  return (
    <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-10 w-32 mb-4" />
        <Skeleton className="h-3 w-full mb-2" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

export function BIKpiCards({ data, isLoading, compareMode }: BIKpiCardsProps) {
  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
      </div>
    );
  }

  const compareLabel = compareMode === 'forecast' ? 'vs forecast' : compareMode === 'previous_period' ? 'vs prev. period' : 'vs last year';

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Sales to date */}
      <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-2">
            <span className="text-sm text-muted-foreground">Sales to date</span>
            <DeltaBadge value={data.kpis.salesToDateDelta} suffix={` ${compareLabel}`} />
          </div>
          <div className="text-4xl font-bold tracking-tight mb-1">
            {formatCurrency(data.kpis.salesToDate)}
          </div>
          <ChannelBar data={data.kpis.channelBreakdown} />
        </CardContent>
      </Card>

      {/* Average check size */}
      <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-2">
            <span className="text-sm text-muted-foreground">Average check size</span>
            <DeltaBadge value={data.kpis.avgCheckSizeDelta} suffix={` ${compareLabel}`} />
          </div>
          <div className="text-4xl font-bold tracking-tight mb-1">
            €{data.kpis.avgCheckSize.toFixed(2)}
          </div>
          <AcsBar data={data.kpis.acsBreakdown} />
        </CardContent>
      </Card>

      {/* Dwell time */}
      <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">Dwell time</span>
              {data.kpis.dwellTime === null && (
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Requires opened_at data from POS</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            {data.kpis.dwellTimeDelta !== null && (
              <DeltaBadge value={data.kpis.dwellTimeDelta} suffix={` ${compareLabel}`} />
            )}
          </div>
          <div className="text-4xl font-bold tracking-tight mb-1">
            {data.kpis.dwellTime !== null ? `${data.kpis.dwellTime} min` : '—'}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Average time dine-in customers spend
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
