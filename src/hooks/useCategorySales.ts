import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { buildQueryContext, getTopProductsRpc } from '@/data';
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

      // Call via data layer
      const ctx = buildQueryContext(orgId, locationIds, 'pos');
      const range = { from: format(from, 'yyyy-MM-dd'), to: format(to, 'yyyy-MM-dd') };
      const data = await getTopProductsRpc(ctx, range, 100);

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
