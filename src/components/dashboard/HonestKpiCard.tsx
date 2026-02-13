import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { LucideIcon, AlertCircle } from 'lucide-react';
import type { KpiResult } from '@/hooks/useDashboardMetrics';

interface HonestKpiCardProps {
  title: string;
  kpi: KpiResult;
  previousKpi?: KpiResult;
  format: (value: number) => string;
  icon: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  /** true if lower delta is better (e.g. COGS, COL%) */
  invertDelta?: boolean;
  loading?: boolean;
}

function calculateDelta(current: number, previous: number): { value: number; positive: boolean } | null {
  if (previous === 0) return current > 0 ? { value: 100, positive: true } : null;
  const delta = ((current - previous) / previous) * 100;
  return { value: Math.round(delta * 10) / 10, positive: delta >= 0 };
}

export function HonestKpiCard({
  title,
  kpi,
  previousKpi,
  format: formatValue,
  icon: Icon,
  variant = 'default',
  invertDelta = false,
  loading = false,
}: HonestKpiCardProps) {
  const variantStyles = {
    default: 'border-l-primary',
    success: 'border-l-success',
    warning: 'border-l-warning',
    danger: 'border-l-destructive',
  };

  // Compute delta only when both periods have real data
  let trend: { value: number; positive: boolean } | null = null;
  if (kpi.available && previousKpi?.available) {
    trend = calculateDelta(kpi.value, previousKpi.value);
    if (trend && invertDelta) {
      trend.positive = !trend.positive;
    }
  }

  const isAvailable = kpi.available;

  return (
    <Card className={cn('border-l-4', variantStyles[variant])}>
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1 min-w-0">
            <p className="text-sm text-muted-foreground truncate">{title}</p>

            {loading ? (
              <div className="h-8 w-20 bg-muted animate-pulse rounded" />
            ) : isAvailable ? (
              <p className="text-2xl md:text-3xl font-display font-bold">
                {formatValue(kpi.value)}
              </p>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 text-2xl font-display font-bold text-muted-foreground/50 cursor-help">
                      —
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-xs">
                    {kpi.reason}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {trend && (
              <div className="flex items-center gap-1 mt-1">
                <span className={cn(
                  'text-xs font-medium',
                  trend.positive ? 'text-success' : 'text-destructive',
                )}>
                  {trend.positive ? '+' : ''}{invertDelta ? Math.abs(trend.value) : trend.value}%
                </span>
                <span className="text-xs text-muted-foreground">vs anterior</span>
              </div>
            )}
          </div>

          <div className={cn(
            'p-2 rounded-lg shrink-0',
            variant === 'success' && 'bg-success/10 text-success',
            variant === 'warning' && 'bg-warning/10 text-warning',
            variant === 'danger' && 'bg-destructive/10 text-destructive',
            variant === 'default' && 'bg-primary/10 text-primary',
          )}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
