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
  const [products, setProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
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
    setLoading(true);
    try {
      const { from, to } = getDateRange();
      
      const { data, error } = await supabase.rpc('get_top_products', {
        p_location_id: selectedLocationId || null,
        p_date_from: format(from, 'yyyy-MM-dd'),
        p_date_to: format(to, 'yyyy-MM-dd'),
        p_order_by: orderBy
      });

      if (error) throw error;
      
      setProducts((data || []) as TopProduct[]);
    } catch (error) {
      console.error('Error fetching top products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [selectedLocationId, orderBy, getDateRange]);

  const seedDemoData = useCallback(async () => {
    if (!group?.id) return;
    
    setSeeding(true);
    try {
      const { error } = await supabase.rpc('seed_demo_products_and_sales', {
        p_group_id: group.id
      });

      if (error) throw error;
      
      // Mark as seeded
      localStorage.setItem('topProductsDemoSeeded', 'true');
      
      // Refetch products
      await fetchTopProducts();
    } catch (error) {
      console.error('Error seeding demo data:', error);
    } finally {
      setSeeding(false);
    }
  }, [group?.id, fetchTopProducts]);

  // Auto-seed on first load if no data
  useEffect(() => {
    const checkAndSeed = async () => {
      if (!group?.id) return;
      
      const alreadySeeded = localStorage.getItem('topProductsDemoSeeded');
      if (alreadySeeded) return;

      // Check if products exist
      const { count } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      if (count === 0) {
        await seedDemoData();
      } else {
        localStorage.setItem('topProductsDemoSeeded', 'true');
      }
    };

    checkAndSeed();
  }, [group?.id, seedDemoData]);

  // Fetch products when filters change
  useEffect(() => {
    fetchTopProducts();
  }, [fetchTopProducts]);

  return {
    products,
    loading,
    seeding,
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
    seedDemoData,
    refetch: fetchTopProducts
  };
}
