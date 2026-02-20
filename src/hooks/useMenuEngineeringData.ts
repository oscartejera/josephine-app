import { useState, useEffect, useCallback, useMemo } from 'react';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { buildQueryContext, getMenuEngineeringSummaryRpc } from '@/data';

type CogsSource = 'recipe' | 'estimated' | 'none';

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
  const { accessibleLocations, dataSource, loading: appLoading } = useApp();
  const { profile } = useAuth();
  const orgId = profile?.group_id;

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
    // Guard: don't fetch while app context is loading
    if (appLoading) return;

    setLoading(true);
    setError(null);

    try {
      const { from, to } = getDateRange();

      const ctx = buildQueryContext(orgId, [], dataSource);
      const [rpcData, martResult] = await Promise.all([
        getMenuEngineeringSummaryRpc(ctx, { from, to }, selectedLocationId),
        // Fetch COGS from mart_sales_category_daily for real margins
        supabase
          .from('mart_sales_category_daily' as any)
          .select('product_id, product_name, units_sold, net_sales, cogs, cogs_source')
          .eq('org_id', orgId)
          .gte('date', from)
          .lte('date', to)
          .then(({ data: d }) => d || []),
      ]);

      const data = rpcData;

      if (!data || data.length === 0) {
        setItems([]);
        setStats(null);
        setLoading(false);
        return;
      }

      // Build COGS lookup from mart view (aggregated by product)
      const martCogsMap = new Map<string, { cogs: number; source: CogsSource }>();
      (martResult as any[]).forEach((r: any) => {
        const pid = String(r.product_id);
        const existing = martCogsMap.get(pid) || { cogs: 0, source: 'none' as CogsSource };
        existing.cogs += Number(r.cogs) || 0;
        if (r.cogs_source === 'recipe') existing.source = 'recipe';
        else if (existing.source === 'none') existing.source = 'estimated';
        martCogsMap.set(pid, existing);
      });

      // Map to typed items, enriching COGS from mart view
      const mappedItems: MenuEngineeringItem[] = data.map((row: Record<string, unknown>) => {
        const productId = row.product_id as string;
        const sales = Number(row.sales) || 0;
        const units = Number(row.units) || 0;

        // Use mart COGS if RPC returned 0
        const rpcCogs = Number(row.cogs) || 0;
        const martData = martCogsMap.get(productId);
        const cogs = rpcCogs > 0 ? rpcCogs : (martData?.cogs ?? 0);
        const profitEur = sales - cogs;
        const marginPct = sales > 0 ? (profitEur / sales) * 100 : 0;
        const profitPerSale = units > 0 ? profitEur / units : 0;

        return {
          product_id: productId,
          name: row.name as string,
          category: row.category as string,
          units,
          sales,
          cogs,
          profit_eur: profitEur,
          margin_pct: marginPct,
          profit_per_sale: profitPerSale,
          popularity_share: Number(row.popularity_share) || 0,
          sales_share: Number(row.sales_share) || 0,
          classification: (row.classification as Classification) || 'dog',
          action_tag: row.action_tag as string || 'Revisar',
          badges: (row.badges as string[]) || [],
        };
      });

      // Recompute classification with real margins
      const totalUnits = mappedItems.reduce((s, i) => s + i.units, 0);
      const avgMargin = mappedItems.length > 0
        ? mappedItems.reduce((s, i) => s + i.margin_pct, 0) / mappedItems.length
        : 0;
      const popThreshold = totalUnits > 0 && mappedItems.length > 0
        ? (1 / mappedItems.length) * 0.7 * 100
        : 0;

      mappedItems.forEach(item => {
        const isPopular = totalUnits > 0 && (item.units / totalUnits) * 100 >= popThreshold;
        const isHighMargin = item.margin_pct >= avgMargin;

        if (isPopular && isHighMargin) item.classification = 'star';
        else if (isPopular && !isHighMargin) item.classification = 'plow_horse';
        else if (!isPopular && isHighMargin) item.classification = 'puzzle';
        else item.classification = 'dog';
      });

      // Calculate stats with real data
      const totalSales = mappedItems.reduce((s, i) => s + i.sales, 0);
      const statsData: MenuEngineeringStats = {
        stars: mappedItems.filter(i => i.classification === 'star').length,
        plowHorses: mappedItems.filter(i => i.classification === 'plow_horse').length,
        puzzles: mappedItems.filter(i => i.classification === 'puzzle').length,
        dogs: mappedItems.filter(i => i.classification === 'dog').length,
        totalUnits,
        totalSales,
        popThreshold,
        marginThreshold: avgMargin,
      };

      setItems(mappedItems);
      setStats(statsData);
    } catch (err) {
      console.error('Menu engineering fetch error:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [getDateRange, selectedLocationId, dataSource, appLoading]);

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
