import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type HealthStatus = 'checking' | 'healthy' | 'degraded' | 'offline';

export interface HealthState {
  status: HealthStatus;
  latencyMs: number | null;
  lastChecked: Date | null;
  message: string;
}

export function useBackendHealth() {
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
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  return { health, isRefreshing, checkHealth };
}
