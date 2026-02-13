import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { useEffectiveDataSource } from '@/hooks/useEffectiveDataSource';
import type { DateRange } from './useDashboardMetrics';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProductMetric = 'share' | 'gp_eur' | 'gp_pct';

export interface HonestProduct {
  productId: string;
  name: string;
  category: string;
  units: number;
  netSales: number;
  pctSales: number;
  /** null = COGS not configured for this product */
  cogs: number | null;
  /** null = cannot calculate (missing COGS) */
  gpValue: number | null;
  /** null = cannot calculate (missing COGS or sales=0) */
  gpPct: number | null;
  /** Explanation when GP data missing */
  reason: string | null;
}

export interface UseTopProductsHonestParams {
  dateRange: DateRange;
  metric: ProductMetric;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTopProductsHonest({ dateRange, metric }: UseTopProductsHonestParams) {
  const { selectedLocationId, locations } = useApp();
  const { dsUnified } = useEffectiveDataSource();

  return useQuery({
    queryKey: [
      'top-products-honest',
      selectedLocationId ?? 'all',
      dateRange.from,
      dateRange.to,
      dsUnified,
      metric,
    ],
    queryFn: async (): Promise<HonestProduct[]> => {
      // Build location filter
      const locationIds = selectedLocationId && selectedLocationId !== 'all'
        ? [selectedLocationId]
        : locations.map(l => l.id);

      if (locationIds.length === 0) return [];

      // Fetch via unified view (normalizes 'simulated' → 'demo')
      let query = supabase
        .from('v_product_sales_daily_unified')
        .select('product_id, net_sales, units_sold, cogs')
        .in('location_id', locationIds)
        .gte('date', dateRange.from)
        .lte('date', dateRange.to);

      query = query.eq('data_source_unified', dsUnified);

      const { data: rows, error } = await query;

      if (error) {
        console.error('Error fetching product_sales_daily:', error);
        return [];
      }

      if (!rows || rows.length === 0) return [];

      // Aggregate by product_id
      const byProduct = new Map<string, { netSales: number; units: number; cogs: number; hasCogs: boolean }>();

      for (const row of rows) {
        const pid = row.product_id as string;
        const existing = byProduct.get(pid) || { netSales: 0, units: 0, cogs: 0, hasCogs: false };
        existing.netSales += Number(row.net_sales) || 0;
        existing.units += Number(row.units_sold) || 0;
        const rowCogs = Number(row.cogs) || 0;
        existing.cogs += rowCogs;
        if (rowCogs > 0) existing.hasCogs = true;
        byProduct.set(pid, existing);
      }

      // Get total sales for share calculation
      const totalSales = Array.from(byProduct.values()).reduce((s, p) => s + p.netSales, 0);

      // Fetch product names
      const productIds = Array.from(byProduct.keys());
      const { data: products } = await supabase
        .from('products')
        .select('id, name, category')
        .in('id', productIds);

      const nameMap = new Map<string, { name: string; category: string }>();
      if (products) {
        for (const p of products) {
          nameMap.set(p.id, { name: p.name, category: p.category || 'Sin categoría' });
        }
      }

      // Build result list
      const result: HonestProduct[] = [];

      for (const [pid, agg] of byProduct) {
        const info = nameMap.get(pid) || { name: 'Producto desconocido', category: 'Sin categoría' };
        const pctSales = totalSales > 0 ? (agg.netSales / totalSales) * 100 : 0;

        let cogs: number | null = null;
        let gpValue: number | null = null;
        let gpPct: number | null = null;
        let reason: string | null = null;

        if (agg.hasCogs) {
          cogs = agg.cogs;
          gpValue = agg.netSales - agg.cogs;
          gpPct = agg.netSales > 0 ? ((agg.netSales - agg.cogs) / agg.netSales) * 100 : null;
        } else {
          reason = 'Sin receta/costes configurados';
        }

        result.push({
          productId: pid,
          name: info.name,
          category: info.category,
          units: agg.units,
          netSales: agg.netSales,
          pctSales: Math.round(pctSales * 100) / 100,
          cogs,
          gpValue: gpValue !== null ? Math.round(gpValue * 100) / 100 : null,
          gpPct: gpPct !== null ? Math.round(gpPct * 10) / 10 : null,
          reason,
        });
      }

      // Sort by selected metric
      result.sort((a, b) => {
        switch (metric) {
          case 'gp_eur':
            // Items with GP first, nulls last
            if (a.gpValue === null && b.gpValue === null) return b.netSales - a.netSales;
            if (a.gpValue === null) return 1;
            if (b.gpValue === null) return -1;
            return b.gpValue - a.gpValue;
          case 'gp_pct':
            if (a.gpPct === null && b.gpPct === null) return b.netSales - a.netSales;
            if (a.gpPct === null) return 1;
            if (b.gpPct === null) return -1;
            return b.gpPct - a.gpPct;
          case 'share':
          default:
            return b.netSales - a.netSales;
        }
      });

      return result.slice(0, 10);
    },
    staleTime: 30_000,
    enabled: locations.length > 0,
  });
}
