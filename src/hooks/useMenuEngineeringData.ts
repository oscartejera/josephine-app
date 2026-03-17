import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { buildQueryContext, getMenuEngineeringSummaryRpc } from '@/data';
import type { Classification as EngineClassification, DataConfidence, CostSource } from '@/lib/menu-engineering-engine';

export type Classification = EngineClassification;
export type DatePreset = 'last7' | 'last30' | 'custom';
export type PopularityMode = 'units' | 'sales';

/**
 * Menu Engineering Item — canonical data from RPC.
 * All fields are computed server-side by the SQL RPC.
 */
export interface MenuEngineeringItem {
  product_id: string;
  name: string;
  category: string;
  // Core canonical fields
  selling_price_ex_vat: number;
  unit_food_cost: number;
  unit_gross_profit: number;
  total_gross_profit: number;
  units_sold: number;
  popularity_pct: number;
  ideal_average_popularity: number;
  average_gross_profit: number;
  popularity_class: string;
  profitability_class: string;
  classification: Classification;
  classification_reason: string;
  cost_source: string;
  data_confidence: string;
  action_tag: string;
  badges: string[];
  is_canonical: boolean;
  // Legacy compat
  units: number;
  sales: number;
  cogs: number;
  profit_eur: number;
  margin_pct: number;
  profit_per_sale: number;
  popularity_share: number;
  sales_share: number;
}

/**
 * Menu Engineering Stats — computed from item data.
 * Canonical thresholds come from the RPC, not from frontend recalculation.
 */
export interface MenuEngineeringStats {
  stars: number;
  plowHorses: number;
  puzzles: number;
  dogs: number;
  totalUnits: number;
  totalSales: number;
  // Canonical thresholds (from RPC, NOT recalculated)
  popThreshold: number;        // = ideal_average_popularity (%)
  marginThreshold: number;     // = average_gross_profit (€)
  // Data quality
  lowConfidenceCount: number;
  totalItems: number;
  isCanonical: boolean;
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

  // Date range calculation
  const getDateRange = useCallback(() => {
    return {
      from: format(dateFrom, 'yyyy-MM-dd'),
      to: format(dateTo, 'yyyy-MM-dd'),
    };
  }, [dateFrom, dateTo]);

  // Fetch data from RPC
  const fetchData = useCallback(async () => {
    if (appLoading) return;

    setLoading(true);
    setError(null);

    try {
      const { from, to } = getDateRange();
      const ctx = buildQueryContext(orgId, [], dataSource);

      // Pass selected category to RPC for per-category analysis
      const data = await getMenuEngineeringSummaryRpc(
        ctx,
        { from, to },
        selectedLocationId,
        selectedCategory,
      );

      if (!data || data.length === 0) {
        setItems([]);
        setStats(null);
        setLoading(false);
        return;
      }

      // Map RPC results — all calculations already done server-side
      const mappedItems: MenuEngineeringItem[] = data.map((row: Record<string, unknown>) => ({
        product_id: String(row.product_id || ''),
        name: String(row.name || ''),
        category: String(row.category || ''),
        // Canonical fields
        selling_price_ex_vat: Number(row.selling_price_ex_vat) || 0,
        unit_food_cost: Number(row.unit_food_cost) || 0,
        unit_gross_profit: Number(row.unit_gross_profit) || 0,
        total_gross_profit: Number(row.total_gross_profit) || 0,
        units_sold: Number(row.units_sold) || Number(row.units) || 0,
        popularity_pct: Number(row.popularity_pct) || Number(row.popularity_share) || 0,
        ideal_average_popularity: Number(row.ideal_average_popularity) || 0,
        average_gross_profit: Number(row.average_gross_profit) || 0,
        popularity_class: String(row.popularity_class || ''),
        profitability_class: String(row.profitability_class || ''),
        classification: (row.classification as Classification) || 'dog',
        classification_reason: String(row.classification_reason || ''),
        cost_source: String(row.cost_source || 'unknown'),
        data_confidence: String(row.data_confidence || 'low'),
        action_tag: String(row.action_tag || 'Evaluar'),
        badges: (row.badges as string[]) || [],
        is_canonical: Boolean(row.is_canonical),
        // Legacy compat
        units: Number(row.units_sold) || Number(row.units) || 0,
        sales: Number(row.sales) || 0,
        cogs: Number(row.cogs) || Number(row.unit_food_cost) || 0,
        profit_eur: Number(row.profit_eur) || Number(row.total_gross_profit) || 0,
        margin_pct: Number(row.margin_pct) || 0,
        profit_per_sale: Number(row.profit_per_sale) || Number(row.unit_gross_profit) || 0,
        popularity_share: Number(row.popularity_share) || Number(row.popularity_pct) || 0,
        sales_share: Number(row.sales_share) || 0,
      }));

      // Stats from classified items — thresholds from RPC, not recalculated
      const firstItem = mappedItems[0];
      const totalUnits = mappedItems.reduce((s, i) => s + i.units_sold, 0);
      const totalSales = mappedItems.reduce((s, i) => s + i.sales, 0);
      const lowConfidenceCount = mappedItems.filter(i => i.data_confidence === 'low').length;

      const statsData: MenuEngineeringStats = {
        stars: mappedItems.filter(i => i.classification === 'star').length,
        plowHorses: mappedItems.filter(i => i.classification === 'plow_horse').length,
        puzzles: mappedItems.filter(i => i.classification === 'puzzle').length,
        dogs: mappedItems.filter(i => i.classification === 'dog').length,
        totalUnits,
        totalSales,
        // Use canonical thresholds directly from RPC
        popThreshold: firstItem?.ideal_average_popularity || 0,
        marginThreshold: firstItem?.average_gross_profit || 0,
        lowConfidenceCount,
        totalItems: mappedItems.length,
        isCanonical: firstItem?.is_canonical || false,
      };

      setItems(mappedItems);
      setStats(statsData);
    } catch (err) {
      console.error('Menu engineering fetch error:', err);
      setError(err instanceof Error ? err.message : t('data.errorAlCargarDatos'));
    } finally {
      setLoading(false);
    }
  }, [getDateRange, selectedLocationId, selectedCategory, dataSource, appLoading]);

  // Refetch on filter changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Items by classification (already category-filtered by RPC when category is selected)
  const itemsByClassification = useMemo(() => {
    return {
      star: items.filter(i => i.classification === 'star'),
      plow_horse: items.filter(i => i.classification === 'plow_horse'),
      puzzle: items.filter(i => i.classification === 'puzzle'),
      dog: items.filter(i => i.classification === 'dog'),
    };
  }, [items]);

  // Save action to database
  const saveAction = useCallback(async (
    productId: string | null,
    actionType: string,
    classification: string,
    estimatedImpact: number | null
  ) => {
    const { from, to } = getDateRange();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error: insertError } = await supabase
      .from('menu_engineering_actions' as any)
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
    items,
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
