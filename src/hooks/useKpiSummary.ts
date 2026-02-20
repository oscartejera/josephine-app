/**
 * useKpiSummary — React Query hook for KPI contract data
 *
 * Single source of truth for Dashboard, Sales, and P&L KPI cards.
 * Calls rpc_kpi_range_summary which returns current + previous period.
 */

import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { buildQueryContext } from '@/data';
import { getKpiRangeSummary } from '@/data/kpi';
import type { KpiRangeSummary } from '@/data/types';

export function useKpiSummary(from: string, to: string) {
  const { accessibleLocations, selectedLocationId, dataSource } = useApp();
  const { profile } = useAuth();
  const orgId = profile?.group_id;

  const locationIds =
    selectedLocationId && selectedLocationId !== 'all'
      ? [selectedLocationId]
      : accessibleLocations.map(l => l.id);

  return useQuery<KpiRangeSummary>({
    queryKey: ['kpi-summary', orgId, locationIds, from, to],
    queryFn: () => {
      const ctx = buildQueryContext(orgId, locationIds, dataSource);
      return getKpiRangeSummary(ctx, from, to);
    },
    enabled: !!orgId && !!from && !!to && locationIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
