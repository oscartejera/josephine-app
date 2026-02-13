/**
 * useSalesReadiness — determines whether Sales should operate as Live or Demo.
 *
 * Calls get_sales_timeseries_unified RPC (lightweight probe) and inspects
 * the metadata (data_source, reason, last_synced_at) plus whether any
 * timeseries rows exist for the given locations + date range.
 *
 * Orthogonal to the global DataSourceProvider — this checks *sales-specific*
 * readiness (a POS-connected org can still have zero historical rows).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { format, subDays } from 'date-fns';

// ── Types ────────────────────────────────────────────────────

export type SalesReadinessStatus = 'live' | 'demo' | 'error';

export interface SalesReadiness {
  status: SalesReadinessStatus;
  isLive: boolean;
  reason?: string;
  dataSource?: 'demo' | 'pos';
  mode?: 'auto' | 'manual';
  lastSyncedAt?: Date | null;
  hasRows?: boolean;
  error?: Error | null;
  refetch: () => void;
}

interface UseSalesReadinessArgs {
  locationIds: string[];
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  enabled?: boolean;
}

// ── Defaults ─────────────────────────────────────────────────

const DEFAULT_RANGE_DAYS = 14;

function defaultRange(): { from: string; to: string } {
  const now = new Date();
  return {
    from: format(subDays(now, DEFAULT_RANGE_DAYS), 'yyyy-MM-dd'),
    to: format(now, 'yyyy-MM-dd'),
  };
}

// ── Hook ─────────────────────────────────────────────────────

export function useSalesReadiness({
  locationIds,
  startDate,
  endDate,
  enabled = true,
}: UseSalesReadinessArgs): SalesReadiness {
  const { group } = useApp();
  const orgId = group?.id;

  const range = (!startDate || !endDate) ? defaultRange() : null;
  const from = startDate || range!.from;
  const to = endDate || range!.to;

  const sortedIds = [...locationIds].sort();
  const canQuery = enabled && !!orgId && sortedIds.length > 0;

  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['sales-readiness', sortedIds, from, to],
    queryFn: async () => {
      // RPC not in auto-generated types — typed cast required
      type RpcFn = (
        name: string,
        params: Record<string, unknown>,
      ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
      const rpc: RpcFn = supabase.rpc as unknown as RpcFn;

      const { data: result, error: rpcError } = await rpc(
        'get_sales_timeseries_unified',
        {
          p_org_id: orgId,
          p_location_ids: sortedIds,
          p_from: from,
          p_to: to,
        },
      );

      if (rpcError) throw new Error(rpcError.message);

      const d = result as Record<string, unknown> | null;
      if (!d) throw new Error('RPC returned null');

      const dataSource = (d.data_source as string) || 'demo';
      const mode = (d.mode as string) || 'auto';
      const reason = (d.reason as string) || '';
      const lastSyncedRaw = d.last_synced_at as string | null;

      // Determine if there are actual timeseries rows
      const hourly = d.hourly as unknown[] | null;
      const daily = d.daily as unknown[] | null;
      const hasRows = (hourly != null && hourly.length > 0) ||
                      (daily != null && daily.length > 0);

      return {
        dataSource: dataSource as 'demo' | 'pos',
        mode: mode as 'auto' | 'manual',
        reason,
        lastSyncedAt: lastSyncedRaw ? new Date(lastSyncedRaw) : null,
        hasRows,
      };
    },
    enabled: canQuery,
    staleTime: 60_000, // 1 min — readiness is stable-ish
  });

  const doRefetch = () => { refetch(); };

  // ── Disabled / no locations ────────────────────────────────
  if (!canQuery) {
    return {
      status: 'demo',
      isLive: false,
      reason: locationIds.length === 0 ? 'no_locations' : undefined,
      hasRows: false,
      error: null,
      refetch: doRefetch,
    };
  }

  // ── Loading ────────────────────────────────────────────────
  if (isLoading) {
    return {
      status: 'demo',
      isLive: false,
      hasRows: false,
      error: null,
      refetch: doRefetch,
    };
  }

  // ── Error ──────────────────────────────────────────────────
  if (error || !data) {
    return {
      status: 'error',
      isLive: false,
      reason: error?.message,
      error: error instanceof Error ? error : new Error(String(error)),
      hasRows: false,
      refetch: doRefetch,
    };
  }

  // ── Live: data_source=pos AND rows exist ───────────────────
  if (data.dataSource === 'pos' && data.hasRows) {
    return {
      status: 'live',
      isLive: true,
      reason: data.reason,
      dataSource: data.dataSource,
      mode: data.mode,
      lastSyncedAt: data.lastSyncedAt,
      hasRows: true,
      error: null,
      refetch: doRefetch,
    };
  }

  // ── Demo fallback ──────────────────────────────────────────
  // Either data_source=demo, or pos with no rows
  const reason = data.dataSource === 'pos' && !data.hasRows
    ? 'pos_no_rows'
    : data.reason || undefined;

  return {
    status: 'demo',
    isLive: false,
    reason,
    dataSource: data.dataSource,
    mode: data.mode,
    lastSyncedAt: data.lastSyncedAt,
    hasRows: data.hasRows,
    error: null,
    refetch: doRefetch,
  };
}
