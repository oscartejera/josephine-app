import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { format } from 'date-fns';
import { getDemoGenerator } from '@/lib/demoDataGenerator';
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

export function useInventoryData(
  dateRange: DateRangeValue,
  dateMode: DateMode,
  viewMode: ViewMode,
  selectedLocations: string[]
) {
  const { locations, group } = useApp();
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [hasRealData, setHasRealData] = useState(false);
  const [metrics, setMetrics] = useState<InventoryMetrics>({
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
  });
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([]);
  const [wasteByCategory, setWasteByCategory] = useState<WasteByCategory[]>([]);
  const [wasteByLocation, setWasteByLocation] = useState<WasteByLocation[]>([]);
  const [locationPerformance, setLocationPerformance] = useState<LocationPerformance[]>([]);

  const locationIds = useMemo(() => {
    if (selectedLocations.length === 0) {
      return locations.map(l => l.id);
    }
    return selectedLocations;
  }, [selectedLocations, locations]);

  useEffect(() => {
    fetchData();
  }, [dateRange, locationIds, group]);

  const fetchData = async () => {
    setIsLoading(true);

    try {
      const fromDate = dateRange.from;
      const toDate = dateRange.to;
      const fromDateStr = format(fromDate, 'yyyy-MM-dd');
      const toDateStr = format(toDate, 'yyyy-MM-dd');

      // Try to fetch real data first
      let ticketsQuery = supabase
        .from('tickets')
        .select('id, location_id, net_total, gross_total, closed_at')
        .gte('closed_at', `${fromDateStr}T00:00:00`)
        .lte('closed_at', `${toDateStr}T23:59:59`)
        .eq('status', 'closed');

      if (locationIds.length > 0 && locationIds.length < locations.length) {
        ticketsQuery = ticketsQuery.in('location_id', locationIds);
      }

      const { data: tickets } = await ticketsQuery;

      // Check if we have real data
      const hasReal = tickets && tickets.length > 0;
      setHasRealData(hasReal);

      if (hasReal) {
        // Use real data processing
        await processRealData(tickets, fromDateStr, toDateStr);
      } else {
        // Use demo generator
        useDemoData(fromDate, toDate);
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching inventory data:', error);
      // Fallback to demo data on error
      useDemoData(dateRange.from, dateRange.to);
    } finally {
      setIsLoading(false);
    }
  };

  const processRealData = async (tickets: any[], fromDateStr: string, toDateStr: string) => {
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

    if (locationIds.length > 0 && locationIds.length < locations.length) {
      wasteQuery = wasteQuery.in('location_id', locationIds);
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
      const mappedCat = cat.toLowerCase().includes('beverage') || cat.toLowerCase().includes('drink') 
        ? 'Beverage' 
        : cat.toLowerCase().includes('food') || cat.toLowerCase().includes('plato')
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
      const mappedCat = cat === 'beverage' ? 'Beverage' : cat === 'food' ? 'Food' : 'Miscellaneous';
      const existing = wasteByCat.get(mappedCat) || { accounted: 0, unaccounted: 0 };
      existing.accounted += w.waste_value || 0;
      wasteByCat.set(mappedCat, existing);
    });

    // Distribute unaccounted proportionally
    const totalAccounted = Array.from(wasteByCat.values()).reduce((s, v) => s + v.accounted, 0);
    if (totalAccounted > 0 && unaccountedWaste > 0) {
      wasteByCat.forEach((val, key) => {
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

    setWasteByLocation(locations.filter(l => locationIds.includes(l.id)).map(loc => {
      const data = wasteByLoc.get(loc.id) || { accounted: 0, unaccounted: 0 };
      const locSales = salesByLoc.get(loc.id) || 0;
      const locUnaccounted = locSales > 0 ? locSales * 0.005 : 0; // Estimate
      
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

    // Location performance
    setLocationPerformance(locations.filter(l => locationIds.includes(l.id)).map(loc => {
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
  };

  const useDemoData = (fromDate: Date, toDate: Date) => {
    const generator = getDemoGenerator(fromDate, toDate);
    
    // Use demo location IDs if no real locations exist
    const demoLocationIds = generator.getLocations().map(l => l.id);
    const effectiveLocationIds = selectedLocations.length > 0 ? selectedLocations : demoLocationIds;

    // Get demo metrics
    const demoMetrics = generator.getInventoryMetrics(fromDate, toDate, effectiveLocationIds);
    
    setMetrics({
      totalSales: demoMetrics.totalSales,
      assignedSales: demoMetrics.assignedSales,
      unassignedSales: demoMetrics.unassignedSales,
      theoreticalCOGS: demoMetrics.theoreticalCOGS,
      theoreticalCOGSPercent: demoMetrics.theoreticalCOGSPercent,
      actualCOGS: demoMetrics.actualCOGS,
      actualCOGSPercent: demoMetrics.actualCOGSPercent,
      theoreticalGP: demoMetrics.theoreticalGP,
      theoreticalGPPercent: demoMetrics.theoreticalGPPercent,
      actualGP: demoMetrics.actualGP,
      actualGPPercent: demoMetrics.actualGPPercent,
      gapCOGS: demoMetrics.gapCOGS,
      gapCOGSPercent: demoMetrics.gapCOGSPercent,
      gapGP: demoMetrics.gapGP,
      gapGPPercent: demoMetrics.gapGPPercent,
      accountedWaste: demoMetrics.accountedWaste,
      unaccountedWaste: demoMetrics.unaccountedWaste,
      surplus: demoMetrics.surplus
    });

    setCategoryBreakdown(generator.getCategoryBreakdown(fromDate, toDate, effectiveLocationIds));
    setWasteByCategory(generator.getWasteByCategory(fromDate, toDate, effectiveLocationIds));
    setWasteByLocation(generator.getWasteByLocation(fromDate, toDate, effectiveLocationIds));
    setLocationPerformance(generator.getLocationPerformance(fromDate, toDate, effectiveLocationIds));
  };

  return {
    isLoading,
    lastUpdated,
    hasRealData,
    metrics,
    categoryBreakdown,
    wasteByCategory,
    wasteByLocation,
    locationPerformance
  };
}
