/**
 * useTopProductsUnified — thin wrapper for get_top_products_unified RPC.
 *
 * Returns top products with share %, resolved server-side.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

// ── Response types ────────────────────────────────────────────

export interface TopProductItem {
  product_id: string;
  name: string;
  category: string;
  sales: number;
  qty: number;
  share: number;
}

export interface TopProductsUnifiedResult {
  data_source: string;
  mode: string;
  reason: string;
  last_synced_at: string | null;
  total_sales: number;
  items: TopProductItem[];
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
      // RPC not yet in auto-generated types
      type RpcFn = (name: string, params: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
      const rpc: RpcFn = supabase.rpc as unknown as RpcFn;
      const { data, error } = await rpc(
        'get_top_products_unified',
        {
          p_org_id: orgId,
          p_location_ids: locationIds,
          p_from: format(from, 'yyyy-MM-dd'),
          p_to: format(to, 'yyyy-MM-dd'),
          p_limit: limit,
        },
      );

      if (error) throw error;
      return data as TopProductsUnifiedResult;
    },
    enabled: enabled && !!orgId && locationIds.length > 0,
    staleTime: 60_000,
  });
}
