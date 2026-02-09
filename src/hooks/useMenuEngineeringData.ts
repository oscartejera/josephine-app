import { useState, useEffect, useCallback, useMemo } from 'react';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';

export type Classification = 'star' | 'plow_horse' | 'puzzle' | 'dog';
export type DatePreset = 'last7' | 'last30' | 'custom';
export type PopularityMode = 'units' | 'sales';

export interface MenuEngineeringItem {
  product_id: string;
  name: string;
  category: string;
  units: number;
  sales: number;
  cogs: number;
  profit_eur: number;
  margin_pct: number;
  profit_per_sale: number;
  popularity_share: number;
  sales_share: number;
  classification: Classification;
  action_tag: string;
  badges: string[];
}

export interface MenuEngineeringStats {
  stars: number;
  plowHorses: number;
  puzzles: number;
  dogs: number;
  totalUnits: number;
  totalSales: number;
  popThreshold: number;
  marginThreshold: number;
}

export function useMenuEngineeringData() {
  const { accessibleLocations } = useApp();

  // State
  const [items, setItems] = useState<MenuEngineeringItem[]>([]);
  const [stats, setStats] = useState<MenuEngineeringStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<Date>(() => startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(() => endOfMonth(new Date()));
  // Keep datePreset for backward compatibility
  const [datePreset, setDatePreset] = useState<DatePreset>('last30');
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>();
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [popularityMode, setPopularityMode] = useState<PopularityMode>('units');

  // Categories from items
  const categories = useMemo(() => {
    const cats = new Set(items.map(i => i.category));
    return Array.from(cats).sort();
  }, [items]);

  // Date range calculation - uses the direct from/to dates
  const getDateRange = useCallback(() => {
    return {
      from: format(dateFrom, 'yyyy-MM-dd'),
      to: format(dateTo, 'yyyy-MM-dd'),
    };
  }, [dateFrom, dateTo]);

  // Fetch data from RPC
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { from, to } = getDateRange();

      const { data, error: rpcError } = await supabase.rpc('menu_engineering_summary', {
        p_date_from: from,
        p_date_to: to,
        p_location_id: selectedLocationId || null,
      });

      if (rpcError) throw rpcError;

      if (!data || data.length === 0) {
        setItems([]);
        setStats(null);
        setLoading(false);
        return;
      }

      // Map to typed items
      const mappedItems: MenuEngineeringItem[] = data.map((row: Record<string, unknown>) => ({
        product_id: row.product_id as string,
        name: row.name as string,
        category: row.category as string,
        units: Number(row.units) || 0,
        sales: Number(row.sales) || 0,
        cogs: Number(row.cogs) || 0,
        profit_eur: Number(row.profit_eur) || 0,
        margin_pct: Number(row.margin_pct) || 0,
        profit_per_sale: Number(row.profit_per_sale) || 0,
        popularity_share: Number(row.popularity_share) || 0,
        sales_share: Number(row.sales_share) || 0,
        classification: (row.classification as Classification) || 'dog',
        action_tag: row.action_tag as string || 'Revisar',
        badges: (row.badges as string[]) || [],
      }));

      // Calculate stats
      const firstRow = data[0];
      const statsData: MenuEngineeringStats = {
        stars: mappedItems.filter(i => i.classification === 'star').length,
        plowHorses: mappedItems.filter(i => i.classification === 'plow_horse').length,
        puzzles: mappedItems.filter(i => i.classification === 'puzzle').length,
        dogs: mappedItems.filter(i => i.classification === 'dog').length,
        totalUnits: Number(firstRow.total_units_period) || 0,
        totalSales: Number(firstRow.total_sales_period) || 0,
        popThreshold: Number(firstRow.pop_threshold) || 0,
        marginThreshold: Number(firstRow.margin_threshold) || 0,
      };

      setItems(mappedItems);
      setStats(statsData);
    } catch (err) {
      console.error('Menu engineering fetch error:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [getDateRange, selectedLocationId]);

  // Refetch on filter changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter items by category
  const filteredItems = useMemo(() => {
    if (!selectedCategory) return items;
    return items.filter(i => i.category === selectedCategory);
  }, [items, selectedCategory]);

  // Items by classification
  const itemsByClassification = useMemo(() => {
    return {
      star: filteredItems.filter(i => i.classification === 'star'),
      plow_horse: filteredItems.filter(i => i.classification === 'plow_horse'),
      puzzle: filteredItems.filter(i => i.classification === 'puzzle'),
      dog: filteredItems.filter(i => i.classification === 'dog'),
    };
  }, [filteredItems]);

  // Save action to database
  const saveAction = useCallback(async (
    productId: string | null,
    actionType: string,
    classification: string,
    estimatedImpact: number | null
  ) => {
    const { from, to } = getDateRange();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error: insertError } = await supabase
      .from('menu_engineering_actions')
      .insert({
        user_id: user.id,
        location_id: selectedLocationId || null,
        date_from: from,
        date_to: to,
        product_id: productId,
        action_type: actionType,
        classification,
        estimated_impact_eur: estimatedImpact,
      });

    if (insertError) {
      console.error('Error saving action:', insertError);
      throw insertError;
    }
  }, [getDateRange, selectedLocationId]);

  return {
    // Data
    items: filteredItems,
    allItems: items,
    stats,
    categories,
    itemsByClassification,

    // State
    loading,
    error,

    // Filters
    selectedLocationId,
    setSelectedLocationId,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    datePreset,
    setDatePreset,
    customDateFrom,
    setCustomDateFrom,
    customDateTo,
    setCustomDateTo,
    selectedCategory,
    setSelectedCategory,
    popularityMode,
    setPopularityMode,

    // Actions
    refetch: fetchData,
    saveAction,

    // Context
    accessibleLocations,
  };
}
