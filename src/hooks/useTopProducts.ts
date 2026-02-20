import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/contexts/AppContext';
import { buildQueryContext, getTopProductsRpc } from '@/data';
import { supabase } from '@/integrations/supabase/client';
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
  cogs_source: 'recipe' | 'estimated';
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
  const { group, locations, dataSource } = useApp();
  const orgId = group?.id;

  // Filter state
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

  const { from: dateFrom, to: dateTo } = getDateRange();
  const fromStr = format(dateFrom, 'yyyy-MM-dd');
  const toStr = format(dateTo, 'yyyy-MM-dd');

  const locationIds = selectedLocationId
    ? [selectedLocationId]
    : locations.map(l => l.id);

  const { data: rawProducts, isLoading, refetch } = useQuery({
    queryKey: ['top-products', orgId, locationIds, fromStr, toStr],
    queryFn: async () => {
      const ctx = buildQueryContext(orgId, locationIds, dataSource);

      // Fetch top products from RPC (for ranking/share) and mart view (for COGS)
      const [rpcResult, martResult] = await Promise.all([
        getTopProductsRpc(ctx, { from: fromStr, to: toStr }, 20),
        supabase
          .from('mart_sales_category_daily' as any)
          .select('product_id, product_name, category, units_sold, net_sales, cogs, cogs_source')
          .eq('org_id', orgId)
          .gte('date', fromStr)
          .lte('date', toStr)
          .then(({ data }) => data || []),
      ]);

      // Aggregate mart data by product
      const martMap = new Map<string, { cogs: number; units: number; sales: number; cogsSource: string }>();
      (martResult as any[]).forEach((row: any) => {
        const pid = row.product_id;
        const existing = martMap.get(pid) || { cogs: 0, units: 0, sales: 0, cogsSource: 'estimated' };
        existing.cogs += Number(row.cogs) || 0;
        existing.units += Number(row.units_sold) || 0;
        existing.sales += Number(row.net_sales) || 0;
        if (row.cogs_source === 'recipe') existing.cogsSource = 'recipe';
        martMap.set(pid, existing);
      });

      const items = rpcResult?.items || [];

      return items.map((item: Record<string, unknown>) => {
        const productId = item.product_id as string;
        const sales = Number(item.sales) || 0;
        const qty = Number(item.qty) || 0;
        const share = Number(item.share) || 0;

        // Use mart COGS if available, fallback to mart aggregated data
        const martData = martMap.get(productId);
        const cogs = martData?.cogs ?? 0;
        const cogsSource = (martData?.cogsSource ?? 'estimated') as 'recipe' | 'estimated';
        const gp = sales - cogs;

        return {
          product_id: productId,
          product_name: item.name as string,
          category: (item.category as string) || 'Sin categoría',
          units: qty,
          sales,
          sales_share_pct: share,
          cogs,
          gp,
          gp_pct: sales > 0 ? (gp / sales) * 100 : 0,
          cogs_source: cogsSource,
          badge_label: share >= 10 ? 'Top seller' : null,
        } as TopProduct;
      });
    },
    enabled: !!orgId && locationIds.length > 0,
    staleTime: 60_000,
  });

  // Client-side sort
  const products = useMemo(() => {
    const list = rawProducts || [];
    if (orderBy === 'gp_eur') return [...list].sort((a, b) => b.gp - a.gp);
    if (orderBy === 'gp_pct') return [...list].sort((a, b) => b.gp_pct - a.gp_pct);
    return list;
  }, [rawProducts, orderBy]);

  return {
    products,
    loading: isLoading,
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
    refetch,
  };
}
