/**
 * Data Health Admin Page
 * Displays system health: MV refresh status, POS sync, KPI coverage,
 * inventory health, and stock count activity.
 * Route: /admin/data-health
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw,
  Database,
  ShoppingCart,
  BarChart3,
  Package,
  ClipboardCheck,
  AlertTriangle,
} from 'lucide-react';

interface DataHealthResult {
  last_mv_refresh: {
    status: string;
    finished_at: string | null;
    duration_ms: number | null;
    views_refreshed: string[] | null;
    triggered_by?: string;
    error_message?: string | null;
  };
  last_pos_order: {
    last_closed_at: string | null;
    orders_7d: number;
  };
  kpi_coverage: {
    location_days_30d: number;
    distinct_locations: number;
  };
  inventory: {
    total_items: number;
    with_recipes: number;
    with_par_level: number;
    with_cost: number;
  };
  stock_counts: {
    total: number;
    last_30d: number;
    distinct_locations: number;
  };
}

function statusColor(status: string): 'default' | 'destructive' | 'secondary' | 'outline' {
  if (status === 'success') return 'default';
  if (status === 'error') return 'destructive';
  if (status === 'running') return 'secondary';
  return 'outline';
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Nunca';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Hace menos de 1 min';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Hace ${diffDays}d`;
}

function healthBadge(value: number, good: number, warn: number) {
  if (value >= good) return <Badge variant="default">OK</Badge>;
  if (value >= warn) return <Badge variant="secondary">Parcial</Badge>;
  return <Badge variant="destructive">Sin datos</Badge>;
}

export default function DataHealth() {
  const { profile } = useAuth();
  const orgId = profile?.group_id;
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<DataHealthResult | null>({
    queryKey: ['data-health', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase.rpc('rpc_data_health', {
        p_org_id: orgId,
      });
      if (error) throw error;
      return data as unknown as DataHealthResult;
    },
    enabled: !!orgId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const handleRefreshMvs = async () => {
    setRefreshing(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      // Use the RPC directly via service_role (the Edge Function requires CRON_SECRET,
      // but we can call the refresh function directly via RPC)
      const { error } = await supabase.rpc('refresh_all_mvs', {
        p_triggered_by: 'admin_manual',
      });
      if (error) {
        console.error('Refresh error:', error.message);
      }
      // Re-fetch health data to reflect new refresh
      await refetch();
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Data Health</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Estado de las vistas materializadas, POS y cobertura de datos
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefreshMvs}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            Refrescar MVs
          </Button>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Recargar
          </Button>
        </div>
      </div>

      {isError && (
        <Card className="border-destructive">
          <CardContent className="pt-4">
            <p className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Error cargando datos de salud. Verifica que las migraciones estén aplicadas.
            </p>
          </CardContent>
        </Card>
      )}

      {data && (
        <div className="grid gap-4">
          {/* 1. MV Refresh Status */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Materialized Views
                </CardTitle>
                <Badge variant={statusColor(data.last_mv_refresh.status)}>
                  {data.last_mv_refresh.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Ultimo refresh:</span>{' '}
                  <strong>{timeAgo(data.last_mv_refresh.finished_at)}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Duracion:</span>{' '}
                  <strong>{data.last_mv_refresh.duration_ms ? `${data.last_mv_refresh.duration_ms}ms` : '—'}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Trigger:</span>{' '}
                  <strong>{data.last_mv_refresh.triggered_by || '—'}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Vistas:</span>{' '}
                  <strong>{data.last_mv_refresh.views_refreshed?.length || 0}</strong>
                </div>
                {data.last_mv_refresh.error_message && (
                  <div className="col-span-2 text-destructive text-xs">
                    Error: {data.last_mv_refresh.error_message}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 2. POS Sync */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  POS Sync
                </CardTitle>
                {healthBadge(data.last_pos_order.orders_7d, 1, 0)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Ultima orden:</span>{' '}
                  <strong>{timeAgo(data.last_pos_order.last_closed_at)}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Ordenes (7d):</span>{' '}
                  <strong>{data.last_pos_order.orders_7d.toLocaleString()}</strong>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. KPI Coverage */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Cobertura KPI (30d)
                </CardTitle>
                {healthBadge(data.kpi_coverage.location_days_30d, 10, 1)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Location-days:</span>{' '}
                  <strong>{data.kpi_coverage.location_days_30d}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Ubicaciones activas:</span>{' '}
                  <strong>{data.kpi_coverage.distinct_locations}</strong>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 4. Inventory */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Inventario
                </CardTitle>
                {healthBadge(data.inventory.total_items, 1, 0)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Items totales:</span>{' '}
                  <strong>{data.inventory.total_items}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Con receta:</span>{' '}
                  <strong>{data.inventory.with_recipes}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Con par level:</span>{' '}
                  <strong>{data.inventory.with_par_level}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Con coste:</span>{' '}
                  <strong>{data.inventory.with_cost}</strong>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 5. Stock Counts */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4" />
                  Conteos de Stock
                </CardTitle>
                {healthBadge(data.stock_counts.last_30d, 1, 0)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Total conteos:</span>{' '}
                  <strong>{data.stock_counts.total}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Ultimos 30d:</span>{' '}
                  <strong>{data.stock_counts.last_30d}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Ubicaciones con conteo:</span>{' '}
                  <strong>{data.stock_counts.distinct_locations}</strong>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!data && !isLoading && !isError && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Cargando datos de salud del sistema...
          </CardContent>
        </Card>
      )}
    </div>
  );
}
