/**
 * useTopProductsUnified — thin wrapper for get_top_products_unified RPC
 * via data layer.
 *
 * Returns top products with share %, resolved server-side.
 */

import { useQuery } from '@tanstack/react-query';
import { buildQueryContext, getTopProductsRpc, type TopProductsRpcResult } from '@/data';
import { useApp } from '@/contexts/AppContext';
import { format } from 'date-fns';

// Re-export types for backward compatibility
export type TopProductsUnifiedResult = TopProductsRpcResult;

export interface TopProductItem {
  product_id: string;
  name: string;
  category: string;
  sales: number;
  qty: number;
  share: number;
}

// ── Hook params ───────────────────────────────────────────────

interface UseTopProductsUnifiedParams {
  orgId: string | undefined;
  locationIds: string[];
  from: Date;
  to: Date;
  limit?: number;
  enabled?: boolean;
}

// ── Hook ──────────────────────────────────────────────────────

export function useTopProductsUnified({
  orgId,
  locationIds,
  from,
  to,
  limit = 20,
  enabled = true,
}: UseTopProductsUnifiedParams) {
  const { dataSource } = useApp();
  return useQuery({
    queryKey: [
      'top-products-unified',
      orgId,
      locationIds,
      format(from, 'yyyy-MM-dd'),
      format(to, 'yyyy-MM-dd'),
      limit,
    ],
    queryFn: async (): Promise<TopProductsUnifiedResult> => {
      const ctx = buildQueryContext(orgId, locationIds, dataSource);
      const range = {
        from: format(from, 'yyyy-MM-dd'),
        to: format(to, 'yyyy-MM-dd'),
      };

      const result = await getTopProductsRpc(ctx, range, limit);
      return result as TopProductsUnifiedResult;
    },
    enabled: enabled && !!orgId && locationIds.length > 0,
    staleTime: 60_000,
  });
}
