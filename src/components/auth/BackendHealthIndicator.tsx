import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Wifi, WifiOff, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type HealthStatus = 'checking' | 'healthy' | 'degraded' | 'offline';

interface HealthState {
  status: HealthStatus;
  latencyMs: number | null;
  lastChecked: Date | null;
  message: string;
}

export function BackendHealthIndicator() {
  const [health, setHealth] = useState<HealthState>({
    status: 'checking',
    latencyMs: null,
    lastChecked: null,
    message: 'Verificando conexión...',
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkHealth = useCallback(async () => {
    setIsRefreshing(true);
    const start = performance.now();

    try {
      // Simple ping: count from a small table or use auth health
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const { error } = await supabase
        .from('groups')
        .select('id', { count: 'exact', head: true })
        .limit(1)
        .abortSignal(controller.signal);

      clearTimeout(timeoutId);
      const latency = Math.round(performance.now() - start);

      if (error) {
        const msg = String(error.message || '').toLowerCase();
        if (msg.includes('schema cache') || msg.includes('pgrst002')) {
          setHealth({
            status: 'degraded',
            latencyMs: latency,
            lastChecked: new Date(),
            message: 'Backend calentando. Reinténtalo en unos segundos.',
          });
        } else {
          setHealth({
            status: 'offline',
            latencyMs: null,
            lastChecked: new Date(),
            message: 'No se pudo conectar al servidor.',
          });
        }
      } else {
        // Check latency thresholds
        if (latency > 3000) {
          setHealth({
            status: 'degraded',
            latencyMs: latency,
            lastChecked: new Date(),
            message: `Conexión lenta (${latency}ms). Puede haber retrasos.`,
          });
        } else {
          setHealth({
            status: 'healthy',
            latencyMs: latency,
            lastChecked: new Date(),
            message: `Conectado (${latency}ms)`,
          });
        }
      }
    } catch (err: unknown) {
      const errMsg = String((err as Error)?.message || err || '').toLowerCase();
      if (errMsg.includes('abort') || errMsg.includes('timeout')) {
        setHealth({
          status: 'offline',
          latencyMs: null,
          lastChecked: new Date(),
          message: 'Timeout al conectar. El servidor no responde.',
        });
      } else {
        setHealth({
          status: 'offline',
          latencyMs: null,
          lastChecked: new Date(),
          message: 'Error de conexión. Revisa tu red.',
        });
      }
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();

    // Re-check every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

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
        config.color
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
