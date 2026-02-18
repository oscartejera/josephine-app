/**
 * Data Access Layer — Runtime Guards
 *
 * Reusable guard utilities for the UI layer:
 *   - useQueryContext(): builds a QueryContext from React contexts, guarding org_id
 *   - EmptyLocationsState: component to show when no locations are accessible
 */

import { useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { buildQueryContext, type QueryContext } from './client';
import type { DateRange } from './types';

/**
 * Hook that builds a QueryContext from AuthContext + AppContext.
 * Returns null if org_id is missing (user needs onboarding).
 *
 * Usage:
 *   const { ctx, locationIds, range, ready } = useQueryContext();
 *   if (!ready) return <EmptyState />;
 */
export function useQueryContext(): {
  ctx: QueryContext | null;
  locationIds: string[];
  ready: boolean;
  orgId: string | null;
  range: DateRange;
} {
  const { profile } = useAuth();
  const { selectedLocationId, accessibleLocations, getDateRangeValues, dataSource } = useApp();

  const orgId = profile?.group_id || null;

  const locationIds = useMemo(() => {
    if (!selectedLocationId || selectedLocationId === 'all') {
      return accessibleLocations.map(l => l.id);
    }
    return [selectedLocationId];
  }, [selectedLocationId, accessibleLocations]);

  const range = useMemo(() => {
    const { from, to } = getDateRangeValues();
    return {
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0],
    };
  }, [getDateRangeValues]);

  const ctx = useMemo(() => {
    if (!orgId) return null;
    return buildQueryContext(orgId, locationIds, dataSource);
  }, [orgId, locationIds, dataSource]);

  return {
    ctx,
    locationIds,
    ready: !!orgId && locationIds.length > 0,
    orgId,
    range,
  };
}
