import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { subDays, format } from 'date-fns';

export interface CategorySales {
  category: string;
  sales: number;
  percentage: number;
  units: number;
}

export function useCategorySales() {
  const { group, selectedLocationId, locations } = useApp();
  const orgId = group?.id;
  const [categories, setCategories] = useState<CategorySales[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSales, setTotalSales] = useState(0);

  const fetchCategorySales = useCallback(async () => {
    if (!orgId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const from = subDays(new Date(), 30);
      const to = new Date();

      // Build location IDs
      const locationIds = selectedLocationId && selectedLocationId !== 'all'
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
        p_limit: 100, // Get all products for accurate category aggregation
      });

      if (error) throw error;

      const items = data?.items || [];
      const total = Number(data?.total_sales) || 0;

      // Aggregate items by category
      const categoryMap = new Map<string, { sales: number; units: number }>();

      items.forEach((item: Record<string, unknown>) => {
        const category = (item.category as string) || 'Sin categoría';
        const existing = categoryMap.get(category) || { sales: 0, units: 0 };
        existing.sales += Number(item.sales) || 0;
        existing.units += Number(item.qty) || 0;
        categoryMap.set(category, existing);
      });

      // Convert to array with percentages
      const categoriesArray: CategorySales[] = Array.from(categoryMap.entries())
        .map(([category, data]) => ({
          category,
          sales: data.sales,
          units: data.units,
          percentage: total > 0 ? (data.sales / total) * 100 : 0,
        }))
        .sort((a, b) => b.sales - a.sales);

      setCategories(categoriesArray);
      setTotalSales(total);
    } catch (error) {
      console.error('Error fetching category sales:', error);
    } finally {
      setLoading(false);
    }
  }, [orgId, selectedLocationId, locations]);

  useEffect(() => {
    fetchCategorySales();
  }, [fetchCategorySales]);

  return {
    categories,
    loading,
    totalSales,
    refetch: fetchCategorySales
  };
}
