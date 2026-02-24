// Migrated to sales_daily_unified + product_sales_daily_unified contract views
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { toLegacyDataSource } from '@/data';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { DateMode, DateRangeValue } from '@/components/bi/DateRangePickerNoryLike';
import type { ViewMode } from '@/components/inventory/InventoryHeader';

// Re-export types for backward compatibility
export type { InventoryMetrics, CategoryBreakdown, WasteByCategory, WasteByLocation, LocationPerformance } from './inventory/types';

// Internal imports
import type { InventoryMetrics, CategoryBreakdown, WasteByCategory, WasteByLocation, LocationPerformance } from './inventory/types';
import { defaultMetrics } from './inventory/types';


export function useInventoryData(
  dateRange: DateRangeValue,
  dateMode: DateMode,
  viewMode: ViewMode,
  selectedLocations: string[]
) {
  const { locations, group, loading: appLoading, dataSource } = useApp();
  const { session } = useAuth();
  const dsLegacy = toLegacyDataSource(dataSource);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [hasRealData, setHasRealData] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [metrics, setMetrics] = useState<InventoryMetrics>(defaultMetrics);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([]);
  const [wasteByCategory, setWasteByCategory] = useState<WasteByCategory[]>([]);
  const [wasteByLocation, setWasteByLocation] = useState<WasteByLocation[]>([]);
  const [locationPerformance, setLocationPerformance] = useState<LocationPerformance[]>([]);

  // Track if we've fetched to avoid loops
  const fetchedRef = useRef<string>('');
  const isMountedRef = useRef(true);

  // Create a stable cache key for the current request — includes locations count
  // and dataSource to ensure re-fetch when context finishes loading
  const cacheKey = useMemo(() => {
    const fromStr = dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : '';
    const toStr = dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : '';
    const locsStr = selectedLocations.sort().join(',');
    return `${fromStr}-${toStr}-${locsStr}-${locations.length}-${dataSource}`;
  }, [dateRange.from, dateRange.to, selectedLocations, locations.length, dataSource]);

  // Safety: if app finished loading but there are no locations, stop loading
  useEffect(() => {
    if (!appLoading && locations.length === 0) {
      setIsLoading(false);
    }
  }, [appLoading, locations.length]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Stable data fetching with guards
  const fetchData = useCallback(async () => {
    // Guard: Don't fetch if already fetching same data
    if (fetchedRef.current === cacheKey) {
      return;
    }

    // Guard: Require valid date range
    if (!dateRange.from || !dateRange.to) {
      return;
    }

    // Mark as fetching this key
    fetchedRef.current = cacheKey;
    setIsLoading(true);
    setError(null);

    try {
      const fromDate = dateRange.from;
      const toDate = dateRange.to;
      const fromDateStr = format(fromDate, 'yyyy-MM-dd');
      const toDateStr = format(toDate, 'yyyy-MM-dd');

      // Determine which location IDs to use
      let effectiveLocationIds = selectedLocations;

      // If no selected locations, use all from context
      if (effectiveLocationIds.length === 0 && locations.length > 0) {
        effectiveLocationIds = locations.map(l => l.id);
      }

      // Fetch real data
      if (locations.length > 0 && !appLoading) {
        let salesQuery = supabase
          .from('sales_daily_unified' as any)
          .select('date, location_id, net_sales, gross_sales, orders_count')
          .eq('data_source', dsLegacy)
          .gte('date', fromDateStr)
          .lte('date', toDateStr);

        if (effectiveLocationIds.length > 0 && effectiveLocationIds.length < locations.length) {
          salesQuery = salesQuery.in('location_id', effectiveLocationIds);
        }

        const { data: dailySales, error: salesError } = await salesQuery;

        if (salesError) {
          console.warn('Error fetching sales data:', salesError);
        } else if (dailySales && dailySales.length > 0 && isMountedRef.current) {
          setHasRealData(true);
          const salesAsTickets = (dailySales || []).map(d => ({
            id: `${d.date}-${d.location_id}`,
            location_id: d.location_id,
            net_total: d.net_sales,
            gross_total: d.gross_sales,
            closed_at: `${d.date}T12:00:00`,
          }));
          await processRealData(salesAsTickets, fromDateStr, toDateStr, effectiveLocationIds);
        }
      }

      if (isMountedRef.current) {
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Error fetching inventory data:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [cacheKey, dateRange.from, dateRange.to, selectedLocations, locations, appLoading, dataSource, dsLegacy]);

  // Trigger fetch when dependencies change
  useEffect(() => {
    // Don't fetch while app context is still loading
    if (appLoading) {
      return;
    }

    fetchData();
  }, [fetchData, appLoading]);

  // Subscribe to realtime inventory updates
  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel('inventory-items-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory_items'
        },
        (payload) => {
          console.log('Inventory realtime update:', payload);

          // Reset cache key to force refetch
          fetchedRef.current = '';
          fetchData();

          const eventType = payload.eventType;
          if (eventType === 'UPDATE') {
            toast.info('Stock updated', {
              description: 'Inventory data has been refreshed.',
              duration: 3000,
            });
          } else if (eventType === 'INSERT') {
            toast.success('New item added', {
              description: 'A new inventory item was added.',
              duration: 3000,
            });
          } else if (eventType === 'DELETE') {
            toast.info('Item removed', {
              description: 'An inventory item was deleted.',
              duration: 3000,
            });
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, [fetchData, session]);

  const processRealData = async (
    tickets: any[],
    fromDateStr: string,
    toDateStr: string,
    effectiveLocationIds: string[]
  ) => {
    // Fetch COGS from cogs_daily (seeded as ~28% of net_sales)
    let cogsQuery = supabase
      .from('cogs_daily')
      .select('date, location_id, cogs_amount')
      .gte('date', fromDateStr)
      .lte('date', toDateStr);

    if (effectiveLocationIds.length > 0 && effectiveLocationIds.length < locations.length) {
      cogsQuery = cogsQuery.in('location_id', effectiveLocationIds);
    }

    const { data: cogsRows } = await cogsQuery;

    // Fetch product sales for category breakdown
    let prodQuery = supabase
      .from('product_sales_daily_unified' as any)
      .select('date, location_id, product_id, product_name, product_category, net_sales, cogs')
      .eq('data_source', dsLegacy)
      .gte('date', fromDateStr)
      .lte('date', toDateStr);

    if (effectiveLocationIds.length > 0 && effectiveLocationIds.length < locations.length) {
      prodQuery = prodQuery.in('location_id', effectiveLocationIds);
    }

    const { data: productSales } = await prodQuery;

    // Fetch waste events (simple select — no FK join to avoid PostgREST schema cache issues)
    let wasteQuery = supabase
      .from('waste_events')
      .select('id, location_id, waste_value, reason, created_at, inventory_item_id')
      .gte('created_at', `${fromDateStr}T00:00:00`)
      .lte('created_at', `${toDateStr}T23:59:59`);

    if (effectiveLocationIds.length > 0 && effectiveLocationIds.length < locations.length) {
      wasteQuery = wasteQuery.in('location_id', effectiveLocationIds);
    }

    const { data: wasteEvents, error: wasteError } = await wasteQuery;
    if (wasteError) {
      console.warn('[inventory] waste_events query error:', wasteError.message);
    }

    if (!isMountedRef.current) return;

    // Calculate metrics from real data
    const totalSales = tickets.reduce((sum, t) => sum + (t.net_total || t.gross_total || 0), 0);

    // Theoretical COGS from cogs_daily table
    const theoreticalCOGS = (cogsRows || []).reduce((sum, r) => sum + (r.cogs_amount || 0), 0);

    const totalWaste = (wasteEvents || []).reduce((sum, w) => sum + (w.waste_value || 0), 0);
    // Actual COGS = theoretical + waste (no arbitrary multiplier)
    const actualCOGS = theoreticalCOGS + totalWaste;

    const theoreticalGP = totalSales - theoreticalCOGS;
    const actualGP = totalSales - actualCOGS;
    const gapCOGS = actualCOGS - theoreticalCOGS;

    // Accounted waste = waste events; unaccounted = gap beyond waste events
    const accountedWaste = totalWaste;
    const unaccountedWaste = Math.max(0, gapCOGS - accountedWaste);
    const surplus = 0;

    setMetrics({
      totalSales,
      assignedSales: totalSales,
      unassignedSales: 0,
      theoreticalCOGS,
      theoreticalCOGSPercent: totalSales > 0 ? (theoreticalCOGS / totalSales) * 100 : 0,
      actualCOGS,
      actualCOGSPercent: totalSales > 0 ? (actualCOGS / totalSales) * 100 : 0,
      theoreticalGP,
      theoreticalGPPercent: totalSales > 0 ? (theoreticalGP / totalSales) * 100 : 0,
      actualGP,
      actualGPPercent: totalSales > 0 ? (actualGP / totalSales) * 100 : 0,
      gapCOGS,
      gapCOGSPercent: totalSales > 0 ? (gapCOGS / totalSales) * 100 : 0,
      gapGP: -gapCOGS,
      gapGPPercent: totalSales > 0 ? -(gapCOGS / totalSales) * 100 : 0,
      accountedWaste,
      unaccountedWaste,
      surplus
    });

    // Category breakdown: distribute total COGS proportionally by category sales share
    const categoryMap = new Map<string, { actual: number; theoretical: number }>();
    ['Food', 'Beverage', 'Miscellaneous'].forEach(cat => {
      categoryMap.set(cat, { actual: 0, theoretical: 0 });
    });

    // Map Spanish restaurant categories to Food/Beverage buckets
    const mapToBucket = (cat: string): string => {
      const lower = (cat || '').toLowerCase();
      if (lower === 'bebidas' || lower === 'beverage' || lower.includes('drink') || lower.includes('wine') || lower.includes('beer')) {
        return 'Beverage';
      }
      if (['entrantes', 'carnes', 'pescados', 'pastas', 'postres', 'food', 'plato'].some(k => lower.includes(k))) {
        return 'Food';
      }
      return 'Miscellaneous';
    };

    // First accumulate product sales per bucket to get category share
    const categorySalesMap = new Map<string, number>();
    let totalProductSales = 0;
    (productSales || []).forEach((row: any) => {
      const mappedCat = mapToBucket(row.product_category);
      const sales = Number(row.net_sales) || 0;
      categorySalesMap.set(mappedCat, (categorySalesMap.get(mappedCat) || 0) + sales);
      totalProductSales += sales;
    });

    // Distribute the total cogs_daily COGS proportionally by category sales share
    categorySalesMap.forEach((catSales, bucket) => {
      const share = totalProductSales > 0 ? catSales / totalProductSales : 0;
      const catCogs = theoreticalCOGS * share;
      categoryMap.set(bucket, { actual: catCogs, theoretical: catCogs });
    });

    setCategoryBreakdown(Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      actualPercent: totalSales > 0 ? (data.actual / totalSales) * 100 : 0,
      actualAmount: data.actual,
      theoreticalPercent: totalSales > 0 ? (data.theoretical / totalSales) * 100 : 0,
      theoreticalAmount: data.theoretical
    })));

    // Waste by category — distribute proportionally using the same category sales shares
    const wasteByCat = new Map<string, { accounted: number; unaccounted: number }>();
    ['Food', 'Beverage', 'Miscellaneous'].forEach(cat => {
      wasteByCat.set(cat, { accounted: 0, unaccounted: 0 });
    });

    // Distribute total waste across categories based on product sales mix
    categorySalesMap.forEach((catSales, bucket) => {
      const share = totalProductSales > 0 ? catSales / totalProductSales : 0;
      const existing = wasteByCat.get(bucket) || { accounted: 0, unaccounted: 0 };
      existing.accounted = totalWaste * share;
      wasteByCat.set(bucket, existing);
    });

    const totalAccounted = Array.from(wasteByCat.values()).reduce((s, v) => s + v.accounted, 0);
    if (totalAccounted > 0 && unaccountedWaste > 0) {
      wasteByCat.forEach((val) => {
        val.unaccounted = unaccountedWaste * (val.accounted / totalAccounted);
      });
    }

    setWasteByCategory(Array.from(wasteByCat.entries()).map(([category, data]) => ({
      category,
      accounted: data.accounted,
      unaccounted: data.unaccounted
    })));

    // Waste by location
    const wasteByLoc = new Map<string, { accounted: number; unaccounted: number }>();
    const salesByLoc = new Map<string, number>();
    const cogsByLoc = new Map<string, number>();

    tickets.forEach(t => {
      salesByLoc.set(t.location_id, (salesByLoc.get(t.location_id) || 0) + (t.net_total || t.gross_total || 0));
    });

    (cogsRows || []).forEach(r => {
      cogsByLoc.set(r.location_id, (cogsByLoc.get(r.location_id) || 0) + (r.cogs_amount || 0));
    });

    (wasteEvents || []).forEach((w: any) => {
      const existing = wasteByLoc.get(w.location_id) || { accounted: 0, unaccounted: 0 };
      existing.accounted += w.waste_value || 0;
      wasteByLoc.set(w.location_id, existing);
    });

    setWasteByLocation(locations.filter(l => effectiveLocationIds.includes(l.id)).map(loc => {
      const data = wasteByLoc.get(loc.id) || { accounted: 0, unaccounted: 0 };
      const locSales = salesByLoc.get(loc.id) || 0;
      const locUnaccounted = locSales > 0 ? locSales * 0.005 : 0;

      return {
        locationId: loc.id,
        locationName: loc.name,
        accountedPercent: locSales > 0 ? (data.accounted / locSales) * 100 : 0,
        accountedAmount: data.accounted,
        unaccountedPercent: locSales > 0 ? (locUnaccounted / locSales) * 100 : 0,
        unaccountedAmount: locUnaccounted,
        hasStockCount: false
      };
    }));

    // Location performance using cogs_daily per location
    setLocationPerformance(locations.filter(l => effectiveLocationIds.includes(l.id)).map(loc => {
      const locSales = salesByLoc.get(loc.id) || 0;
      const locTheoreticalCOGS = cogsByLoc.get(loc.id) || 0;
      const locWaste = (wasteByLoc.get(loc.id)?.accounted || 0);
      const locActualCOGS = locTheoreticalCOGS + locWaste;
      const locVariance = locActualCOGS - locTheoreticalCOGS;

      return {
        locationId: loc.id,
        locationName: loc.name,
        sales: locSales,
        theoreticalValue: locTheoreticalCOGS,
        theoreticalPercent: locSales > 0 ? (locTheoreticalCOGS / locSales) * 100 : 0,
        actualValue: locActualCOGS,
        actualPercent: locSales > 0 ? (locActualCOGS / locSales) * 100 : 0,
        variancePercent: locSales > 0 ? (locVariance / locSales) * 100 : 0,
        varianceAmount: locVariance,
        hasStockCount: false
      };
    }));

    setLastUpdated(new Date());
  };

  return {
    isLoading,
    lastUpdated,
    hasRealData,
    isConnected,
    metrics,
    categoryBreakdown,
    wasteByCategory,
    wasteByLocation,
    locationPerformance,
    error
  };
}
