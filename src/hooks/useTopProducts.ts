import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { subDays, format } from 'date-fns';

export type OrderByOption = 'share' | 'gp_eur' | 'gp_pct';

export interface TopProduct {
  product_id: string;
  product_name: string;
  category: string;
  units: number;
  sales: number;
  sales_share_pct: number;
  cogs: number;
  gp: number;
  gp_pct: number;
  badge_label: string | null;
}

export interface DateRangePreset {
  label: string;
  value: 'last7' | 'last30' | 'custom';
  from: Date;
  to: Date;
}

const getPresetDates = (preset: 'last7' | 'last30' | 'custom'): { from: Date; to: Date } => {
  const today = new Date();
  switch (preset) {
    case 'last7':
      return { from: subDays(today, 7), to: today };
    case 'last30':
      return { from: subDays(today, 30), to: today };
    default:
      return { from: subDays(today, 7), to: today };
  }
};

export function useTopProducts() {
  const { group, locations } = useApp();
  const orgId = group?.id;
  const [products, setProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<'last7' | 'last30' | 'custom'>('last7');
  const [customDateFrom, setCustomDateFrom] = useState<Date>(subDays(new Date(), 7));
  const [customDateTo, setCustomDateTo] = useState<Date>(new Date());
  const [orderBy, setOrderBy] = useState<OrderByOption>('share');

  const getDateRange = useCallback(() => {
    if (datePreset === 'custom') {
      return { from: customDateFrom, to: customDateTo };
    }
    return getPresetDates(datePreset);
  }, [datePreset, customDateFrom, customDateTo]);

  const fetchTopProducts = useCallback(async () => {
    if (!orgId) return;

    setLoading(true);
    try {
      const { from, to } = getDateRange();
      const locationIds = selectedLocationId
        ? [selectedLocationId]
        : locations.map(l => l.id);

      // Use unified RPC — data source resolved server-side
      type RpcFn = (name: string, params: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
      const rpc: RpcFn = supabase.rpc as unknown as RpcFn;
      const { data, error } = await rpc('get_top_products_unified', {
        p_org_id: orgId,
        p_location_ids: locationIds,
        p_from: format(from, 'yyyy-MM-dd'),
        p_to: format(to, 'yyyy-MM-dd'),
        p_limit: 20,
      });

      if (error) {
        console.error('Error in get_top_products_unified RPC:', error);
        throw error;
      }

      const items = data?.items || [];
      const totalSales = Number(data?.total_sales) || 0;

      // Map unified response to TopProduct interface
      const mapped: TopProduct[] = items.map((item: Record<string, unknown>) => {
        const sales = Number(item.sales) || 0;
        const qty = Number(item.qty) || 0;
        const share = Number(item.share) || 0;
        // Estimate COGS at ~28% (same as seeded data) since unified RPC doesn't return it
        const estimatedCogs = sales * 0.28;
        const gp = sales - estimatedCogs;

        return {
          product_id: item.product_id as string,
          product_name: item.name as string,
          category: (item.category as string) || 'Sin categoría',
          units: qty,
          sales,
          sales_share_pct: share,
          cogs: estimatedCogs,
          gp,
          gp_pct: sales > 0 ? (gp / sales) * 100 : 0,
          badge_label: share >= 10 ? 'Top seller' : null,
        };
      });

      // Client-side sort by orderBy
      if (orderBy === 'gp_eur') {
        mapped.sort((a, b) => b.gp - a.gp);
      } else if (orderBy === 'gp_pct') {
        mapped.sort((a, b) => b.gp_pct - a.gp_pct);
      }
      // Default 'share' is already sorted by sales DESC from RPC

      setProducts(mapped);
    } catch (error) {
      console.error('Error fetching top products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [orgId, selectedLocationId, orderBy, getDateRange, locations]);

  // Fetch products when filters change
  useEffect(() => {
    if (orgId) {
      fetchTopProducts();
    }
  }, [fetchTopProducts, orgId]);

  return {
    products,
    loading,
    locations,
    selectedLocationId,
    setSelectedLocationId,
    datePreset,
    setDatePreset,
    customDateFrom,
    setCustomDateFrom,
    customDateTo,
    setCustomDateTo,
    orderBy,
    setOrderBy,
    refetch: fetchTopProducts
  };
}
