/**
 * useLabourReadiness — determines whether Labour should operate as Live or Demo.
 *
 * Lightweight probe: calls get_labour_kpis once to check if real labour
 * data exists for the current location + date range.
 *
 * Uses legacy data_source naming from AppContext ('pos' | 'simulated').
 * Does NOT touch resolve_data_source or the unified naming layer.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';

// ── Types ────────────────────────────────────────────────────

export type LabourReadinessStatus = 'live' | 'demo' | 'error';
export type LabourReadinessReason = 'simulated' | 'pos_no_rows' | 'rpc_error';

export interface LabourReadiness {
  status: LabourReadinessStatus;
  reason?: LabourReadinessReason;
  dataSource: 'pos' | 'simulated';
  errorMessage?: string;
  refetch: () => void;
}

interface UseLabourReadinessArgs {
  selectedLocationId: string | 'all' | null;
  dateRange: { from: string; to: string }; // YYYY-MM-DD
}

// ── Hook ─────────────────────────────────────────────────────

export function useLabourReadiness({
  selectedLocationId,
  dateRange,
}: UseLabourReadinessArgs): LabourReadiness {
  const { dataSource, loading: appLoading } = useApp();

  const locationParam = selectedLocationId === 'all' ? null : selectedLocationId;
  const canQuery = !appLoading && !!dataSource && dataSource !== 'simulated';

  const { data, error, isLoading, refetch } = useQuery({
    queryKey: [
      'labour-readiness',
      dataSource,
      locationParam ?? 'all',
      dateRange.from,
      dateRange.to,
    ],
    queryFn: async () => {
      const { data: kpis, error: rpcError } = await supabase.rpc(
        'get_labour_kpis',
        {
          date_from: dateRange.from,
          date_to: dateRange.to,
          selected_location_id: locationParam,
          p_data_source: dataSource,
        },
      );

      if (rpcError) throw new Error(rpcError.message);

      const d = kpis as Record<string, unknown> | null;
      if (!d) throw new Error('RPC returned null');

      // Check if any meaningful metric has a non-null value.
      // We look for actual labour data signals: hours, cost, or sales.
      // A value of 0 is valid (could be a real day with zero).
      // null/undefined means no data was found at all.
      const hasSignal =
        d.actual_labor_cost != null ||
        d.actual_labor_hours != null ||
        d.actual_sales != null;

      return { hasSignal };
    },
    enabled: canQuery,
    staleTime: 60_000,
  });

  const doRefetch = () => { refetch(); };

  // ── Simulated data source → always demo ────────────────────
  if (dataSource === 'simulated') {
    return {
      status: 'demo',
      reason: 'simulated',
      dataSource,
      refetch: doRefetch,
    };
  }

  // ── App still loading or query loading ─────────────────────
  if (!canQuery || isLoading) {
    return {
      status: 'demo',
      dataSource,
      refetch: doRefetch,
    };
  }

  // ── RPC error ──────────────────────────────────────────────
  if (error || !data) {
    return {
      status: 'error',
      reason: 'rpc_error',
      dataSource,
      errorMessage: error instanceof Error ? error.message : String(error),
      refetch: doRefetch,
    };
  }

  // ── POS but no signal → demo with pos_no_rows ─────────────
  if (!data.hasSignal) {
    return {
      status: 'demo',
      reason: 'pos_no_rows',
      dataSource,
      refetch: doRefetch,
    };
  }

  // ── Live ───────────────────────────────────────────────────
  return {
    status: 'live',
    dataSource,
    refetch: doRefetch,
  };
}
