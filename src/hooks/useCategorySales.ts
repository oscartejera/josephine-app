import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { subDays } from 'date-fns';

export interface CategorySales {
  category: string;
  sales: number;
  percentage: number;
  units: number;
}

export function useCategorySales() {
  const { group, selectedLocationId, dataSource } = useApp();
  const [categories, setCategories] = useState<CategorySales[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSales, setTotalSales] = useState(0);

  const fetchCategorySales = useCallback(async () => {
    if (!group?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const from = subDays(new Date(), 30);
      const to = new Date();

      // Get products with their categories
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, category')
        .eq('group_id', group.id);

      if (productsError) throw productsError;

      // Build location filter
      let salesQuery = supabase
        .from('product_sales_daily')
        .select('product_id, net_sales, units_sold')
        .eq('data_source', dataSource)
        .gte('date', from.toISOString().split('T')[0])
        .lte('date', to.toISOString().split('T')[0]);

      if (selectedLocationId && selectedLocationId !== 'all') {
        salesQuery = salesQuery.eq('location_id', selectedLocationId);
      }

      const { data: sales, error: salesError } = await salesQuery;

      if (salesError) throw salesError;

      // Create product to category map
      const productCategoryMap = new Map<string, string>();
      products?.forEach(p => {
        productCategoryMap.set(p.id, p.category || 'Sin categoría');
      });

      // Aggregate by category
      const categoryMap = new Map<string, { sales: number; units: number }>();
      let total = 0;

      sales?.forEach(sale => {
        const category = productCategoryMap.get(sale.product_id) || 'Sin categoría';
        const existing = categoryMap.get(category) || { sales: 0, units: 0 };
        existing.sales += Number(sale.net_sales) || 0;
        existing.units += Number(sale.units_sold) || 0;
        categoryMap.set(category, existing);
        total += Number(sale.net_sales) || 0;
      });

      // Convert to array and calculate percentages
      const categoryOrder = ['Bebidas', 'Entrantes', 'Principales', 'Postres'];
      const categoriesArray: CategorySales[] = [];

      categoryOrder.forEach(cat => {
        const data = categoryMap.get(cat);
        if (data) {
          categoriesArray.push({
            category: cat,
            sales: data.sales,
            units: data.units,
            percentage: total > 0 ? (data.sales / total) * 100 : 0
          });
        }
      });

      // Add any other categories not in the order
      categoryMap.forEach((data, cat) => {
        if (!categoryOrder.includes(cat)) {
          categoriesArray.push({
            category: cat,
            sales: data.sales,
            units: data.units,
            percentage: total > 0 ? (data.sales / total) * 100 : 0
          });
        }
      });

      // Sort by sales descending
      categoriesArray.sort((a, b) => b.sales - a.sales);

      setCategories(categoriesArray);
      setTotalSales(total);
    } catch (error) {
      console.error('Error fetching category sales:', error);
    } finally {
      setLoading(false);
    }
  }, [group?.id, selectedLocationId, dataSource]);

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
