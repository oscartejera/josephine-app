import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { format, subDays } from 'date-fns';

export type Classification = 'star' | 'plow_horse' | 'puzzle' | 'dog';
export type DatePreset = 'last7' | 'last30' | 'custom';

export interface MenuEngineeringItem {
  productId: string;
  name: string;
  category: string;
  units: number;
  sales: number;
  cogs: number;
  gp: number;          // Gross Profit = sales - cogs
  gpPct: number;       // GP% = gp / sales
  cm: number;          // Contribution Margin €/unit = gp / units
  popularity: number;  // Share of units = units / totalUnits
  classification: Classification;
  lowData: boolean;    // Flag for insufficient data
}

export interface MenuEngineeringStats {
  totalProducts: number;
  stars: number;
  plowHorses: number;
  puzzles: number;
  dogs: number;
  popularityThreshold: number;  // P*
  marginThreshold: number;      // M* (median CM)
}

interface RawAggregation {
  product_id: string;
  name: string;
  category: string;
  units: number;
  sales: number;
  cogs: number;
}

export function useMenuEngineeringData() {
  const { accessibleLocations, canShowAllLocations } = useApp();
  
  const [items, setItems] = useState<MenuEngineeringItem[]>([]);
  const [stats, setStats] = useState<MenuEngineeringStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>('last30');
  const [customDateFrom, setCustomDateFrom] = useState<Date>(subDays(new Date(), 30));
  const [customDateTo, setCustomDateTo] = useState<Date>(new Date());
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [includeLowData, setIncludeLowData] = useState(false);

  // Categories from data
  const [categories, setCategories] = useState<string[]>([]);

  // Get date range based on preset
  const getDateRange = useCallback(() => {
    const now = new Date();
    switch (datePreset) {
      case 'last7':
        return { from: subDays(now, 7), to: now };
      case 'last30':
        return { from: subDays(now, 30), to: now };
      case 'custom':
        return { from: customDateFrom, to: customDateTo };
    }
  }, [datePreset, customDateFrom, customDateTo]);

  // Calculate low data threshold based on date range
  const getLowDataThreshold = useCallback(() => {
    return datePreset === 'last7' ? 10 : 30;
  }, [datePreset]);

  // Fetch and calculate menu engineering data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { from, to } = getDateRange();
      const dateFrom = format(from, 'yyyy-MM-dd');
      const dateTo = format(to, 'yyyy-MM-dd');

      // Build query for aggregated product sales
      let query = supabase
        .from('product_sales_daily')
        .select(`
          product_id,
          units_sold,
          net_sales,
          cogs,
          location_id,
          products!inner(id, name, category)
        `)
        .gte('date', dateFrom)
        .lte('date', dateTo);

      // Apply location filter
      if (selectedLocationId && selectedLocationId !== 'all') {
        query = query.eq('location_id', selectedLocationId);
      }

      const { data: salesData, error: salesError } = await query;

      if (salesError) throw salesError;

      if (!salesData || salesData.length === 0) {
        setItems([]);
        setStats(null);
        setCategories([]);
        return;
      }

      // Aggregate by product
      const productMap = new Map<string, RawAggregation>();
      const categorySet = new Set<string>();

      salesData.forEach((row: any) => {
        const productId = row.product_id;
        const product = row.products;
        const category = product?.category || 'Other';
        
        categorySet.add(category);

        // Apply category filter
        if (selectedCategory && category !== selectedCategory) return;

        const existing = productMap.get(productId) || {
          product_id: productId,
          name: product?.name || 'Unknown',
          category,
          units: 0,
          sales: 0,
          cogs: 0,
        };

        existing.units += Number(row.units_sold) || 0;
        existing.sales += Number(row.net_sales) || 0;
        existing.cogs += Number(row.cogs) || 0;

        productMap.set(productId, existing);
      });

      setCategories(Array.from(categorySet).sort());

      const aggregated = Array.from(productMap.values());

      if (aggregated.length === 0) {
        setItems([]);
        setStats(null);
        return;
      }

      // Calculate totals
      const totalUnits = aggregated.reduce((sum, p) => sum + p.units, 0);
      const lowDataThreshold = getLowDataThreshold();

      // Calculate derived metrics for each product
      const itemsWithMetrics = aggregated.map(p => {
        const gp = p.sales - p.cogs;
        const gpPct = p.sales > 0 ? (gp / p.sales) * 100 : 0;
        const cm = p.units > 0 ? gp / p.units : 0;
        const popularity = totalUnits > 0 ? (p.units / totalUnits) * 100 : 0;
        const lowData = p.units < lowDataThreshold;

        return {
          productId: p.product_id,
          name: p.name,
          category: p.category,
          units: p.units,
          sales: p.sales,
          cogs: p.cogs,
          gp,
          gpPct,
          cm,
          popularity,
          lowData,
          classification: 'dog' as Classification, // Will be calculated below
        };
      });

      // Filter items for threshold calculation (exclude low data)
      const validItems = itemsWithMetrics.filter(i => !i.lowData && i.units > 0 && i.cm > 0);
      const N = validItems.length;

      if (N === 0) {
        setItems(itemsWithMetrics);
        setStats({
          totalProducts: itemsWithMetrics.length,
          stars: 0,
          plowHorses: 0,
          puzzles: 0,
          dogs: itemsWithMetrics.length,
          popularityThreshold: 0,
          marginThreshold: 0,
        });
        return;
      }

      // Calculate thresholds
      // P* = 0.70 * (1 / N) as a percentage
      const popularityThreshold = (0.70 / N) * 100;

      // M* = Median of CM for valid items
      const sortedCMs = validItems.map(i => i.cm).sort((a, b) => a - b);
      const midIndex = Math.floor(sortedCMs.length / 2);
      const marginThreshold = sortedCMs.length % 2 === 0
        ? (sortedCMs[midIndex - 1] + sortedCMs[midIndex]) / 2
        : sortedCMs[midIndex];

      // Classify each item
      const classifiedItems = itemsWithMetrics.map(item => {
        let classification: Classification;
        
        if (item.lowData) {
          classification = 'dog'; // Default for low data items
        } else {
          const highPopularity = item.popularity >= popularityThreshold;
          const highMargin = item.cm >= marginThreshold;

          if (highPopularity && highMargin) classification = 'star';
          else if (highPopularity && !highMargin) classification = 'plow_horse';
          else if (!highPopularity && highMargin) classification = 'puzzle';
          else classification = 'dog';
        }

        return { ...item, classification };
      });

      // Count by classification
      const counts = {
        stars: classifiedItems.filter(i => i.classification === 'star').length,
        plowHorses: classifiedItems.filter(i => i.classification === 'plow_horse').length,
        puzzles: classifiedItems.filter(i => i.classification === 'puzzle').length,
        dogs: classifiedItems.filter(i => i.classification === 'dog').length,
      };

      // Sort by sales descending
      classifiedItems.sort((a, b) => b.sales - a.sales);

      setItems(classifiedItems);
      setStats({
        totalProducts: classifiedItems.length,
        ...counts,
        popularityThreshold,
        marginThreshold,
      });

    } catch (err: any) {
      console.error('Menu Engineering fetch error:', err);
      setError(err.message || 'Error loading data');
    } finally {
      setLoading(false);
    }
  }, [selectedLocationId, datePreset, customDateFrom, customDateTo, selectedCategory, getDateRange, getLowDataThreshold]);

  // Initial load and refetch on filter changes
  useEffect(() => {
    // Set default location
    if (!selectedLocationId && accessibleLocations.length > 0) {
      if (canShowAllLocations) {
        setSelectedLocationId('all');
      } else {
        setSelectedLocationId(accessibleLocations[0].id);
      }
    }
  }, [accessibleLocations, canShowAllLocations, selectedLocationId]);

  useEffect(() => {
    if (selectedLocationId) {
      fetchData();
    }
  }, [selectedLocationId, datePreset, customDateFrom, customDateTo, selectedCategory, fetchData]);

  // Filtered items based on includeLowData toggle
  const displayItems = useMemo(() => {
    if (includeLowData) return items;
    return items.filter(i => !i.lowData);
  }, [items, includeLowData]);

  // Items for scatter plot (exclude low data by default)
  const scatterItems = useMemo(() => {
    return items.filter(i => !i.lowData);
  }, [items]);

  // Generate recommendations based on classification
  const recommendations = useMemo(() => {
    if (!items.length || !stats) return [];

    const recs: { type: Classification; title: string; description: string; items: string[] }[] = [];

    // Stars recommendation
    const stars = items.filter(i => i.classification === 'star').slice(0, 3);
    if (stars.length > 0) {
      recs.push({
        type: 'star',
        title: 'Mantener y destacar',
        description: 'Estos productos tienen alta rentabilidad y popularidad. Asegurar stock y posición en menú.',
        items: stars.map(i => i.name),
      });
    }

    // Plow Horses recommendation
    const plowHorses = items.filter(i => i.classification === 'plow_horse').slice(0, 3);
    if (plowHorses.length > 0 && stats.marginThreshold > 0) {
      const avgCM = plowHorses.reduce((s, i) => s + i.cm, 0) / plowHorses.length;
      recs.push({
        type: 'plow_horse',
        title: 'Mejorar margen',
        description: `CM promedio €${avgCM.toFixed(2)} vs mediana €${stats.marginThreshold.toFixed(2)}. Subir precio 2-5% o reducir costes.`,
        items: plowHorses.map(i => i.name),
      });
    }

    // Puzzles recommendation
    const puzzles = items.filter(i => i.classification === 'puzzle').slice(0, 3);
    if (puzzles.length > 0) {
      recs.push({
        type: 'puzzle',
        title: 'Aumentar visibilidad',
        description: 'Alta rentabilidad pero baja popularidad. Mejorar posición en menú, naming o promociones.',
        items: puzzles.map(i => i.name),
      });
    }

    // Dogs recommendation
    const dogs = items.filter(i => i.classification === 'dog' && !i.lowData).slice(0, 3);
    if (dogs.length > 0) {
      recs.push({
        type: 'dog',
        title: 'Reevaluar o eliminar',
        description: 'Baja rentabilidad y popularidad. Considerar eliminar del menú o reformular receta.',
        items: dogs.map(i => i.name),
      });
    }

    return recs;
  }, [items, stats]);

  return {
    // Data
    items: displayItems,
    scatterItems,
    stats,
    categories,
    recommendations,
    
    // State
    loading,
    error,
    
    // Filters
    selectedLocationId,
    setSelectedLocationId,
    datePreset,
    setDatePreset,
    customDateFrom,
    setCustomDateFrom,
    customDateTo,
    setCustomDateTo,
    selectedCategory,
    setSelectedCategory,
    includeLowData,
    setIncludeLowData,
    
    // Actions
    refetch: fetchData,
  };
}
