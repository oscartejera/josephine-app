import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { subDays, format } from 'date-fns';
import { toast } from 'sonner';

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

      if (error) {
        console.error('Error in get_top_products RPC:', error);
        throw error;
      }
      
      setProducts((data || []) as TopProduct[]);
    } catch (error) {
      console.error('Error fetching top products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [selectedLocationId, orderBy, getDateRange]);

  const seedDemoData = useCallback(async () => {
    console.log('seedDemoData called, group:', group);
    
    if (!group?.id) {
      console.error('No group ID available');
      toast.error('Error: No se encontró el grupo');
      return;
    }
    
    // Clear localStorage to allow re-seeding
    localStorage.removeItem('topProductsDemoSeeded');
    
    setSeeding(true);
    toast.loading('Generando datos de ventas...', { id: 'seeding' });
    
    try {
      const { error } = await supabase.rpc('seed_sales_for_existing_products', {
        p_group_id: group.id
      });

      if (error) {
        throw error;
      }
      
      // Mark as seeded
      localStorage.setItem('topProductsDemoSeeded', 'true');
      
      toast.success('Datos de ventas generados para productos del POS', { id: 'seeding' });
      
      // Refetch products
      await fetchTopProducts();
    } catch (error: any) {
      console.error('Error seeding demo data:', error);
      toast.error(`Error: ${error.message || 'No se pudieron generar los datos'}`, { id: 'seeding' });
    } finally {
      setSeeding(false);
    }
  }, [group?.id, fetchTopProducts]);

  // Fetch products when filters change
  useEffect(() => {
    if (group?.id) {
      fetchTopProducts();
    }
  }, [fetchTopProducts, group?.id]);

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
