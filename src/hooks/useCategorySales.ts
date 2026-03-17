import { useQuery } from '@tanstack/react-query';
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
  const { group, selectedLocationId, locations, dataSource } = useApp();
  const orgId = group?.id;

  const locationIds =
    selectedLocationId && selectedLocationId !== 'all'
      ? [selectedLocationId]
      : locations.map(l => l.id);

  const from = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const to = format(new Date(), 'yyyy-MM-dd');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['category-sales', orgId, locationIds, from, to],
    queryFn: async () => {
      const ctx = buildQueryContext(orgId, locationIds, dataSource);
      const result = await getTopProductsRpc(ctx, { from, to }, 100);

      const items = result?.items || [];
      const total = Number(result?.total_sales) || 0;

      const categoryMap = new Map<string, { sales: number; units: number }>();

      items.forEach((item: Record<string, unknown>) => {
        const category = (item.category as string) || 'Sin categoría';
        const existing = categoryMap.get(category) || { sales: 0, units: 0 };
        existing.sales += Number(item.sales) || 0;
        existing.units += Number(item.qty) || 0;
        categoryMap.set(category, existing);
      });

      const categories: CategorySales[] = Array.from(categoryMap.entries())
        .map(([category, data]) => ({
          category,
          sales: data.sales,
          units: data.units,
          percentage: total > 0 ? (data.sales / total) * 100 : 0,
        }))
        .sort((a, b) => b.sales - a.sales);

      return { categories, totalSales: total };
    },
    enabled: !!orgId && locationIds.length > 0,
    staleTime: 60_000,
  });

  return {
    categories: data?.categories || [],
    loading: isLoading,
    totalSales: data?.totalSales || 0,
    refetch,
  };
}
