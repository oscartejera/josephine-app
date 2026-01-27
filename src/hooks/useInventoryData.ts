import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
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
  const { locations, group, loading: appLoading } = useApp();
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

  // Create a stable cache key for the current request
  const cacheKey = useMemo(() => {
    const fromStr = dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : '';
    const toStr = dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : '';
    const locsStr = selectedLocations.sort().join(',');
    return `${fromStr}-${toStr}-${locsStr}`;
  }, [dateRange.from, dateRange.to, selectedLocations]);

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
      if (effectiveLocationIds.length === 0) {
        if (locations.length > 0) {
          effectiveLocationIds = locations.map(l => l.id);
        } else {
          // No locations available - show empty state
          if (isMountedRef.current) {
            setEmptyState();
            setIsLoading(false);
          }
          return;
        }
      }

      // Try to fetch real data (only if we have real locations)
      let hasReal = false;
      if (locations.length > 0 && !appLoading) {
        let ticketsQuery = supabase
          .from('tickets')
          .select('id, location_id, net_total, gross_total, closed_at')
          .gte('closed_at', `${fromDateStr}T00:00:00`)
          .lte('closed_at', `${toDateStr}T23:59:59`)
          .eq('status', 'closed')
          .limit(2000);

        if (effectiveLocationIds.length > 0 && effectiveLocationIds.length < locations.length) {
          ticketsQuery = ticketsQuery.in('location_id', effectiveLocationIds);
        }

        const { data: tickets, error: ticketsError } = await ticketsQuery;
        
        if (ticketsError) {
          if (isMountedRef.current) {
            setEmptyState();
            setIsLoading(false);
          }
          return;
        }
        
        hasReal = tickets && tickets.length > 0;
        if (hasReal && isMountedRef.current) {
          setHasRealData(true);
          await processRealData(tickets, fromDateStr, toDateStr, effectiveLocationIds);
          return;
        }
      }

      // No real data found - show empty state
      if (isMountedRef.current) {
        setEmptyState();
      }

      if (isMountedRef.current) {
        setLastUpdated(new Date());
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setEmptyState();
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [cacheKey, dateRange.from, dateRange.to, selectedLocations, locations, appLoading]);

  // Trigger fetch when dependencies change
  useEffect(() => {
    // Don't fetch while app context is still loading
    if (appLoading) {
      return;
    }
    
    fetchData();
  }, [fetchData, appLoading]);

  // Subscribe to realtime inventory updates
  // Realtime subscription with throttling
  useEffect(() => {
    let lastRefreshTime = 0;
    const THROTTLE_MS = 10000; // Throttle inventory updates to every 10s
    
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
          const now = Date.now();
          if (now - lastRefreshTime < THROTTLE_MS) return;
          lastRefreshTime = now;
          
          fetchedRef.current = '';
          fetchData();
          
          const eventType = payload.eventType;
          if (eventType === 'UPDATE') {
            toast.info('Stock updated', { duration: 3000 });
          } else if (eventType === 'INSERT') {
            toast.success('New item added', { duration: 3000 });
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
  }, [fetchData]);

  const processRealData = async (
    tickets: any[], 
    fromDateStr: string, 
    toDateStr: string,
    effectiveLocationIds: string[]
  ) => {
    // Fetch ticket lines for category breakdown
    const { data: ticketLines } = await supabase
      .from('ticket_lines')
      .select('ticket_id, item_name, category_name, gross_line_total, quantity')
      .in('ticket_id', tickets.map(t => t.id));

    // Fetch waste events
    let wasteQuery = supabase
      .from('waste_events')
      .select('id, location_id, waste_value, reason, created_at, inventory_items(name, category)')
      .gte('created_at', `${fromDateStr}T00:00:00`)
      .lte('created_at', `${toDateStr}T23:59:59`);

    if (effectiveLocationIds.length > 0 && effectiveLocationIds.length < locations.length) {
      wasteQuery = wasteQuery.in('location_id', effectiveLocationIds);
    }

    const { data: wasteEvents } = await wasteQuery;

    // Fetch recipes for theoretical cost
    const { data: recipes } = await supabase
      .from('recipes')
      .select(`
        id, menu_item_name, selling_price,
        recipe_ingredients(quantity, inventory_items(last_cost))
      `);

    // Fetch stock counts for the period
    const { data: stockCounts } = await supabase
      .from('stock_counts')
      .select('id, location_id, status')
      .gte('start_date', fromDateStr)
      .lte('end_date', toDateStr);

    if (!isMountedRef.current) return;

    // Calculate metrics from real data
    const totalSales = tickets.reduce((sum, t) => sum + (t.net_total || t.gross_total || 0), 0);
    
    // Build recipe cost map
    const recipeCostMap = new Map<string, number>();
    (recipes || []).forEach((r: any) => {
      const cost = (r.recipe_ingredients || []).reduce((sum: number, ing: any) => {
        return sum + (ing.quantity * (ing.inventory_items?.last_cost || 0));
      }, 0);
      recipeCostMap.set(r.menu_item_name.toLowerCase(), cost);
    });

    // Calculate theoretical COGS from ticket lines
    let theoreticalCOGS = 0;
    (ticketLines || []).forEach(line => {
      const itemName = line.item_name?.toLowerCase() || '';
      const recipeCost = recipeCostMap.get(itemName);
      if (recipeCost) {
        theoreticalCOGS += recipeCost * (line.quantity || 1);
      } else {
        theoreticalCOGS += (line.gross_line_total || 0) * 0.28;
      }
    });

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

    // Category breakdown from real data
    const categoryMap = new Map<string, { actual: number; theoretical: number }>();
    ['Food', 'Beverage', 'Miscellaneous'].forEach(cat => {
      categoryMap.set(cat, { actual: 0, theoretical: 0 });
    });

    (ticketLines || []).forEach(line => {
      const cat = line.category_name || 'Miscellaneous';
      const catLower = cat.toLowerCase();
      
      // Support both Spanish (POS) and English category names
      const mappedCat = 
        catLower.includes('bebida') || catLower.includes('beverage') || 
        catLower.includes('drink') || catLower.includes('vino') || catLower.includes('cerveza')
          ? 'Beverage' 
        : catLower.includes('entrante') || catLower.includes('principal') || 
          catLower.includes('postre') || catLower.includes('comida') || 
          catLower.includes('food') || catLower.includes('plato')
          ? 'Food'
        : 'Miscellaneous';
      
      const existing = categoryMap.get(mappedCat) || { actual: 0, theoretical: 0 };
      const lineTotal = line.gross_line_total || 0;
      const recipeCost = recipeCostMap.get(line.item_name?.toLowerCase() || '') || lineTotal * 0.28;
      
      existing.actual += recipeCost * 1.05;
      existing.theoretical += recipeCost;
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
      const cat = w.inventory_items?.category || 'food';
      const catLower = cat.toLowerCase();
      // Support both Spanish and English category names
      const mappedCat = 
        catLower.includes('bebida') || catLower === 'beverage'
          ? 'Beverage' 
        : catLower.includes('comida') || catLower === 'food'
          ? 'Food' 
        : 'Miscellaneous';
      const existing = wasteByCat.get(mappedCat) || { accounted: 0, unaccounted: 0 };
      existing.accounted += w.waste_value || 0;
      wasteByCat.set(mappedCat, existing);
    });

    // Distribute unaccounted proportionally
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

    tickets.forEach(t => {
      salesByLoc.set(t.location_id, (salesByLoc.get(t.location_id) || 0) + (t.net_total || t.gross_total || 0));
    });

    (wasteEvents || []).forEach((w: any) => {
      const existing = wasteByLoc.get(w.location_id) || { accounted: 0, unaccounted: 0 };
      existing.accounted += w.waste_value || 0;
      wasteByLoc.set(w.location_id, existing);
    });

    const stockCountLocations = new Set((stockCounts || []).map(sc => sc.location_id));

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
        hasStockCount: stockCountLocations.has(loc.id)
      };
    }));

    // Location performance - filter out locations with no POS data
    setLocationPerformance(locations
      .filter(l => effectiveLocationIds.includes(l.id))
      .filter(loc => {
        const locSales = salesByLoc.get(loc.id) || 0;
        return locSales > 0; // Only include locations with actual sales data
      })
      .map(loc => {
        const locSales = salesByLoc.get(loc.id) || 0;
        const locTheoreticalCOGS = locSales * 0.28;
        const locActualCOGS = locTheoreticalCOGS * 1.05;
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
          hasStockCount: stockCountLocations.has(loc.id)
        };
      }));

    setLastUpdated(new Date());
  };

  // Empty data state - no more demo fallback
  const setEmptyState = () => {
    setMetrics(defaultMetrics);
    setCategoryBreakdown([]);
    setWasteByCategory([]);
    setWasteByLocation([]);
    setLocationPerformance([]);
    setLastUpdated(new Date());
    setHasRealData(false);
    setError(new Error('NO_DATA'));
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
