import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InventoryReadiness {
  /** true when at least one stock_movement exists for the location */
  isLive: boolean;
  isLoading: boolean;
  /** Human-readable reason for the current state */
  reason: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Determines whether a location has real (LIVE) inventory data by checking
 * the `v_stock_on_hand_by_location` view for at least one row.
 *
 * This is intentionally independent of the effectiveDataSource (demo/pos)
 * layer — inventory readiness is about whether stock_movements exist,
 * not about POS sync status.
 */
export function useInventoryReadiness(locationId: string | null): InventoryReadiness {
  const enabled = !!locationId && locationId !== 'all';

  const { data, isLoading } = useQuery<boolean>({
    queryKey: ['inventory-readiness', locationId],
    queryFn: async () => {
      if (!locationId || locationId === 'all') return false;

      // Quick existence check — limit 1 for performance
      // View not in generated types — use generic table accessor
      const { data: rows, error } = await (supabase
        .from('v_stock_on_hand_by_location') as ReturnType<typeof supabase.from>)
        .select('item_id')
        .eq('location_id', locationId)
        .limit(1);

      if (error) {
        console.error('useInventoryReadiness error:', error);
        return false;
      }

      return Array.isArray(rows) && rows.length > 0;
    },
    enabled,
    staleTime: 5 * 60_000, // 5 min — readiness rarely changes mid-session
  });

  if (!enabled) {
    return { isLive: false, isLoading: false, reason: 'no_location_selected' };
  }

  if (isLoading) {
    return { isLive: false, isLoading: true, reason: 'loading' };
  }

  return {
    isLive: !!data,
    isLoading: false,
    reason: data ? 'inventory_live' : 'no_inventory_movements',
  };
}
