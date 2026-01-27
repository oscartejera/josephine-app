import { Wifi, WifiOff, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useBackendHealth, HealthStatus } from '@/hooks/useBackendHealth';

interface Props {
  className?: string;
}

export function BackendHealthIndicator({ className }: Props) {
  const { health, isRefreshing, checkHealth } = useBackendHealth();

  const statusConfig: Record<HealthStatus, { icon: React.ReactNode; color: string; bgColor: string }> = {
    checking: {
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
    },
    healthy: {
      icon: <Wifi className="h-3 w-3" />,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    },
    degraded: {
      icon: <Wifi className="h-3 w-3" />,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    },
    offline: {
      icon: <WifiOff className="h-3 w-3" />,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
  };

  const config = statusConfig[health.status];

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors',
        config.bgColor,
        config.color,
        className
      )}
    >
      {config.icon}
      <span className="flex-1">{health.message}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 p-0 hover:bg-transparent"
        onClick={checkHealth}
        disabled={isRefreshing}
        title="Verificar de nuevo"
      >
        <RefreshCw className={cn('h-3 w-3', isRefreshing && 'animate-spin')} />
      </Button>
    </div>
  );
}
