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

interface InventoryMetrics {
  totalSales: number;
  assignedSales: number;
  unassignedSales: number;
  theoreticalCOGS: number;
  theoreticalCOGSPercent: number;
  actualCOGS: number;
  actualCOGSPercent: number;
  theoreticalGP: number;
  theoreticalGPPercent: number;
  actualGP: number;
  actualGPPercent: number;
  gapCOGS: number;
  gapCOGSPercent: number;
  gapGP: number;
  gapGPPercent: number;
  accountedWaste: number;
  unaccountedWaste: number;
  surplus: number;
}

interface CategoryBreakdown {
  category: string;
  actualPercent: number;
  actualAmount: number;
  theoreticalPercent: number;
  theoreticalAmount: number;
}

interface WasteByCategory {
  category: string;
  accounted: number;
  unaccounted: number;
}

interface WasteByLocation {
  locationId: string;
  locationName: string;
  accountedPercent: number;
  accountedAmount: number;
  unaccountedPercent: number;
  unaccountedAmount: number;
  hasStockCount: boolean;
}

interface LocationPerformance {
  locationId: string;
  locationName: string;
  sales: number;
  theoreticalValue: number;
  theoreticalPercent: number;
  actualValue: number;
  actualPercent: number;
  variancePercent: number;
  varianceAmount: number;
  hasStockCount?: boolean;
}

const defaultMetrics: InventoryMetrics = {
  totalSales: 0,
  assignedSales: 0,
  unassignedSales: 0,
  theoreticalCOGS: 0,
  theoreticalCOGSPercent: 0,
  actualCOGS: 0,
  actualCOGSPercent: 0,
  theoreticalGP: 0,
  theoreticalGPPercent: 0,
  actualGP: 0,
  actualGPPercent: 0,
  gapCOGS: 0,
  gapCOGSPercent: 0,
  gapGP: 0,
  gapGPPercent: 0,
  accountedWaste: 0,
  unaccountedWaste: 0,
  surplus: 0
};

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
  }, [cacheKey, dateRange.from, dateRange.to, selectedLocations, locations, appLoading, dataSource, dsUnified]);

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
      .select('date, location_id, product_id, net_sales, cogs, products(name, category)')
      .eq('data_source', dsLegacy)
      .gte('date', fromDateStr)
      .lte('date', toDateStr);

    if (effectiveLocationIds.length > 0 && effectiveLocationIds.length < locations.length) {
      prodQuery = prodQuery.in('location_id', effectiveLocationIds);
    }

    const { data: productSales } = await prodQuery;

    // Fetch waste events
    let wasteQuery = supabase
      .from('waste_events')
      .select('id, location_id, waste_value, reason, created_at, inventory_items(name, category_name)')
      .gte('created_at', `${fromDateStr}T00:00:00`)
      .lte('created_at', `${toDateStr}T23:59:59`);

    if (effectiveLocationIds.length > 0 && effectiveLocationIds.length < locations.length) {
      wasteQuery = wasteQuery.in('location_id', effectiveLocationIds);
    }

    const { data: wasteEvents } = await wasteQuery;

    if (!isMountedRef.current) return;

    // Calculate metrics from real data
    const totalSales = tickets.reduce((sum, t) => sum + (t.net_total || t.gross_total || 0), 0);
    
    // Theoretical COGS from cogs_daily table
    const theoreticalCOGS = (cogsRows || []).reduce((sum, r) => sum + (r.cogs_amount || 0), 0);

    const totalWaste = (wasteEvents || []).reduce((sum, w) => sum + (w.waste_value || 0), 0);
    const actualCOGS = theoreticalCOGS + totalWaste * 0.6;

    const theoreticalGP = totalSales - theoreticalCOGS;
    const actualGP = totalSales - actualCOGS;
    const gapCOGS = actualCOGS - theoreticalCOGS;

    const accountedWaste = totalWaste;
    const unaccountedWaste = Math.max(0, gapCOGS - accountedWaste) * 0.7;
    const surplus = Math.max(0, gapCOGS - accountedWaste - unaccountedWaste);

    setMetrics({
      totalSales,
      assignedSales: totalSales * 0.85,
      unassignedSales: totalSales * 0.15,
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

    // Category breakdown from product_sales_daily joined with products
    const categoryMap = new Map<string, { actual: number; theoretical: number }>();
    ['Food', 'Beverage', 'Miscellaneous'].forEach(cat => {
      categoryMap.set(cat, { actual: 0, theoretical: 0 });
    });

    (productSales || []).forEach((row: any) => {
      const cat = row.products?.category || 'Food';
      const mappedCat = cat.toLowerCase().includes('beverage') || cat.toLowerCase().includes('drink')
        ? 'Beverage'
        : cat.toLowerCase().includes('food') || cat.toLowerCase().includes('plato')
        ? 'Food'
        : 'Miscellaneous';

      const existing = categoryMap.get(mappedCat) || { actual: 0, theoretical: 0 };
      existing.theoretical += row.cogs || 0;
      existing.actual += (row.cogs || 0) * 1.05; // Actual = theoretical + 5% variance
      categoryMap.set(mappedCat, existing);
    });

    setCategoryBreakdown(Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      actualPercent: totalSales > 0 ? (data.actual / totalSales) * 100 : 0,
      actualAmount: data.actual,
      theoreticalPercent: totalSales > 0 ? (data.theoretical / totalSales) * 100 : 0,
      theoreticalAmount: data.theoretical
    })));

    // Waste by category
    const wasteByCat = new Map<string, { accounted: number; unaccounted: number }>();
    ['Food', 'Beverage', 'Miscellaneous'].forEach(cat => {
      wasteByCat.set(cat, { accounted: 0, unaccounted: 0 });
    });

    (wasteEvents || []).forEach((w: any) => {
      const cat = w.inventory_items?.category_name || 'food';
      const mappedCat = cat === 'beverage' ? 'Beverage' : cat === 'food' ? 'Food' : 'Miscellaneous';
      const existing = wasteByCat.get(mappedCat) || { accounted: 0, unaccounted: 0 };
      existing.accounted += w.waste_value || 0;
      wasteByCat.set(mappedCat, existing);
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
      const locActualCOGS = locTheoreticalCOGS + locWaste * 0.6;
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
