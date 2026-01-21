import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { toast } from 'sonner';
import type { DateMode, DateRangeValue } from '@/components/bi/DateRangePickerNoryLike';

// ============ TYPES ============
export type WasteReason = 'broken' | 'end_of_day' | 'expired' | 'theft' | 'other';

export interface WasteMetrics {
  totalSales: number;
  totalAccountedWaste: number;
  wastePercentOfSales: number;
}

export interface WasteTrendData {
  date: string;
  broken: number;
  end_of_day: number;
  expired: number;
  theft: number;
  other: number;
}

export interface WasteByReason {
  reason: WasteReason;
  count: number;
  value: number;
}

export interface WasteByCategory {
  category: string;
  value: number;
  percentOfTotal: number;
}

export interface WasteLeaderboardEntry {
  userName: string;
  initials: string;
  logsCount: number;
  locationName: string;
  totalValue: number;
}

export interface WasteItemRow {
  itemId: string;
  itemName: string;
  quantity: number;
  value: number;
  itemType: 'ingredient' | 'product';
  topReason: WasteReason;
  percentOfSales: number;
  percentOfTotalWaste: number;
}

export const REASON_LABELS: Record<WasteReason, string> = {
  broken: 'Broken',
  end_of_day: 'End of day',
  expired: 'Expired',
  theft: 'Theft',
  other: 'Other'
};

export const REASON_COLORS: Record<WasteReason, string> = {
  broken: '#22c55e',
  end_of_day: '#3b82f6',
  expired: '#84cc16',
  theft: '#f97316',
  other: '#ef4444'
};

// Mock team members for leaderboard
const MOCK_TEAM = [
  { name: 'Tom Lennon', initials: 'TL' },
  { name: 'Homer Simpson', initials: 'HS' },
  { name: 'Taryn Ferre Purcell', initials: 'TF' },
  { name: 'Sofia Real', initials: 'SR' },
  { name: 'Kaci Trussler', initials: 'KT' },
  { name: 'Sara Cicatiello', initials: 'SC' },
  { name: 'Eve Nutella', initials: 'EN' },
  { name: 'Former employee', initials: '👤' },
];

// ============ HOOK ============
export function useWasteDataNew(
  dateRange: DateRangeValue,
  dateMode: DateMode,
  selectedLocations: string[]
) {
  const { locations, group } = useApp();
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState<WasteMetrics>({
    totalSales: 0,
    totalAccountedWaste: 0,
    wastePercentOfSales: 0
  });
  const [trendData, setTrendData] = useState<WasteTrendData[]>([]);
  const [byReason, setByReason] = useState<WasteByReason[]>([]);
  const [byCategory, setByCategory] = useState<WasteByCategory[]>([]);
  const [leaderboard, setLeaderboard] = useState<WasteLeaderboardEntry[]>([]);
  const [items, setItems] = useState<WasteItemRow[]>([]);
  const [hasData, setHasData] = useState(true);

  const locationIds = useMemo(() => {
    if (selectedLocations.length === 0) {
      return locations.map(l => l.id);
    }
    return selectedLocations;
  }, [selectedLocations, locations]);

  // ============ FETCH DATA ============
  const fetchData = useCallback(async () => {
    if (!group?.id || locations.length === 0) return;
    
    setIsLoading(true);

    try {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      // 1. Fetch Total Sales from product_sales_daily
      let salesQuery = supabase
        .from('product_sales_daily')
        .select('net_sales, location_id')
        .gte('date', fromDate)
        .lte('date', toDate);

      if (locationIds.length > 0 && locationIds.length < locations.length) {
        salesQuery = salesQuery.in('location_id', locationIds);
      }

      const { data: salesData } = await salesQuery;
      const totalSales = (salesData || []).reduce((sum, s) => sum + (s.net_sales || 0), 0);

      // 2. Fetch waste_logs with waste_items join
      let logsQuery = supabase
        .from('waste_logs')
        .select(`
          id,
          date,
          location_id,
          user_id,
          item_id,
          reason,
          quantity,
          value,
          waste_items!inner(id, name, item_type, ingredient_category)
        `)
        .gte('date', fromDate)
        .lte('date', toDate);

      if (locationIds.length > 0 && locationIds.length < locations.length) {
        logsQuery = logsQuery.in('location_id', locationIds);
      }

      const { data: logsData, error: logsError } = await logsQuery;

      if (logsError) {
        console.error('Error fetching waste logs:', logsError);
      }

      const logs = logsData || [];
      
      if (logs.length === 0) {
        setHasData(false);
        setMetrics({ totalSales, totalAccountedWaste: 0, wastePercentOfSales: 0 });
        setTrendData([]);
        setByReason([]);
        setByCategory([]);
        setLeaderboard([]);
        setItems([]);
        setIsLoading(false);
        return;
      }

      setHasData(true);

      // 3. Calculate metrics
      const totalWaste = logs.reduce((sum, l) => sum + (l.value || 0), 0);
      const wastePercent = totalSales > 0 ? (totalWaste / totalSales) * 100 : 0;

      setMetrics({
        totalSales,
        totalAccountedWaste: totalWaste,
        wastePercentOfSales: wastePercent
      });

      // 4. Calculate trend data (by day and reason)
      const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
      const trendMap = new Map<string, WasteTrendData>();
      
      days.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        trendMap.set(dateStr, {
          date: dateStr,
          broken: 0,
          end_of_day: 0,
          expired: 0,
          theft: 0,
          other: 0
        });
      });

      logs.forEach(log => {
        const dateStr = log.date;
        const existing = trendMap.get(dateStr);
        if (existing) {
          const reason = log.reason as WasteReason;
          existing[reason] = (existing[reason] || 0) + (log.value || 0);
          trendMap.set(dateStr, existing);
        }
      });

      setTrendData(Array.from(trendMap.values()));

      // 5. Calculate by reason
      const reasonMap = new Map<WasteReason, { count: number; value: number }>();
      (['broken', 'end_of_day', 'expired', 'theft', 'other'] as WasteReason[]).forEach(r => {
        reasonMap.set(r, { count: 0, value: 0 });
      });

      logs.forEach(log => {
        const reason = log.reason as WasteReason;
        const existing = reasonMap.get(reason) || { count: 0, value: 0 };
        existing.count++;
        existing.value += log.value || 0;
        reasonMap.set(reason, existing);
      });

      setByReason(Array.from(reasonMap.entries()).map(([reason, data]) => ({
        reason,
        count: data.count,
        value: data.value
      })));

      // 6. Calculate by ingredient category (only ingredients)
      const categoryMap = new Map<string, number>();
      logs.forEach((log: any) => {
        if (log.waste_items?.item_type === 'ingredient') {
          const cat = log.waste_items?.ingredient_category || 'Other';
          const existing = categoryMap.get(cat) || 0;
          categoryMap.set(cat, existing + (log.value || 0));
        }
      });

      const totalCategoryValue = Array.from(categoryMap.values()).reduce((sum, v) => sum + v, 0);
      setByCategory(Array.from(categoryMap.entries()).map(([category, value]) => ({
        category,
        value,
        percentOfTotal: totalCategoryValue > 0 ? (value / totalCategoryValue) * 100 : 0
      })).sort((a, b) => b.value - a.value));

      // 7. Calculate leaderboard (mock users based on location distribution)
      const locationLogsMap = new Map<string, { count: number; value: number }>();
      logs.forEach(log => {
        const locId = log.location_id;
        const existing = locationLogsMap.get(locId) || { count: 0, value: 0 };
        existing.count++;
        existing.value += log.value || 0;
        locationLogsMap.set(locId, existing);
      });

      const leaderboardData: WasteLeaderboardEntry[] = [];
      let teamIdx = 0;
      locationLogsMap.forEach((data, locId) => {
        const loc = locations.find(l => l.id === locId);
        // Split each location into 2-3 team members
        const numMembers = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < numMembers; i++) {
          const member = MOCK_TEAM[teamIdx % MOCK_TEAM.length];
          const portion = (i === 0) ? 0.5 : (1 - 0.5) / (numMembers - 1);
          leaderboardData.push({
            userName: member.name,
            initials: member.initials,
            logsCount: Math.round(data.count * portion),
            locationName: loc?.name || 'Unknown',
            totalValue: data.value * portion
          });
          teamIdx++;
        }
      });
      setLeaderboard(leaderboardData.sort((a, b) => b.totalValue - a.totalValue).slice(0, 10));

      // 8. Calculate items table
      const itemMap = new Map<string, {
        itemName: string;
        itemType: 'ingredient' | 'product';
        quantity: number;
        value: number;
        reasonValues: Map<WasteReason, number>;
      }>();

      logs.forEach((log: any) => {
        const itemId = log.item_id;
        const itemName = log.waste_items?.name || 'Unknown';
        const itemType = log.waste_items?.item_type || 'ingredient';
        const reason = log.reason as WasteReason;

        const existing = itemMap.get(itemId) || {
          itemName,
          itemType,
          quantity: 0,
          value: 0,
          reasonValues: new Map()
        };
        existing.quantity += log.quantity || 0;
        existing.value += log.value || 0;
        
        const reasonVal = existing.reasonValues.get(reason) || 0;
        existing.reasonValues.set(reason, reasonVal + (log.value || 0));
        
        itemMap.set(itemId, existing);
      });

      const itemsData: WasteItemRow[] = Array.from(itemMap.entries()).map(([itemId, data]) => {
        // Find top reason by value
        let topReason: WasteReason = 'other';
        let topValue = 0;
        data.reasonValues.forEach((val, reason) => {
          if (val > topValue) {
            topValue = val;
            topReason = reason;
          }
        });

        return {
          itemId,
          itemName: data.itemName,
          itemType: data.itemType as 'ingredient' | 'product',
          quantity: data.quantity,
          value: data.value,
          topReason,
          percentOfSales: totalSales > 0 ? (data.value / totalSales) * 100 : 0,
          percentOfTotalWaste: totalWaste > 0 ? (data.value / totalWaste) * 100 : 0
        };
      });

      setItems(itemsData.sort((a, b) => b.value - a.value));

    } catch (error) {
      console.error('Error fetching waste data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, locationIds, locations, group?.id]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ============ SEED DEMO DATA ============
  const seedDemoData = useCallback(async () => {
    if (!group?.id || locations.length === 0) {
      toast.error('No group or locations available');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Create waste_items
      const ingredientNames = [
        { name: 'Flour Mix (kg)', category: 'Dry' },
        { name: 'Candied Bacon (cooked) (kg)', category: 'Meat' },
        { name: 'Brined Chicken Fillets (6 Days shelf li...', category: 'Meat' },
        { name: 'Tenders. Raw (5 days shelf life) (ea)', category: 'Meat' },
        { name: 'Buffalo Sauce. (kg)', category: 'Sauce' },
        { name: 'Luxury cheese sauce (kg)', category: 'Sauce' },
        { name: 'Amish roll bun (ea)', category: 'Dry' },
        { name: 'Milk Choc Callebaut (kg)', category: 'Dairy' },
        { name: 'Pre blanched fries (kg)', category: 'Frozen' },
        { name: 'Nashville Spiced Oil (service) (kg)', category: 'Sauce' },
        { name: 'Fresh Lettuce (kg)', category: 'Fresh' },
        { name: 'Tomatoes (kg)', category: 'Fresh' },
        { name: 'Onions (kg)', category: 'Veg' },
        { name: 'Pickles (kg)', category: 'Fresh' },
        { name: 'Coleslaw Mix (kg)', category: 'Fresh' },
        { name: 'Mac & Cheese Base (kg)', category: 'Dairy' },
        { name: 'BBQ Sauce (kg)', category: 'Sauce' },
        { name: 'Hot Sauce (kg)', category: 'Sauce' },
        { name: 'Garlic Butter (kg)', category: 'Dairy' },
        { name: 'Frozen Wings (kg)', category: 'Frozen' },
      ];

      // Insert waste items
      const { data: insertedItems, error: itemsError } = await supabase
        .from('waste_items')
        .insert(ingredientNames.map(item => ({
          name: item.name,
          item_type: 'ingredient',
          ingredient_category: item.category,
          unit: item.name.includes('(ea)') ? 'ea' : 'kg',
          group_id: group.id
        })))
        .select();

      if (itemsError) {
        console.error('Error inserting waste items:', itemsError);
        toast.error('Failed to create waste items');
        setIsLoading(false);
        return;
      }

      if (!insertedItems || insertedItems.length === 0) {
        toast.error('No waste items created');
        setIsLoading(false);
        return;
      }

      // 2. Generate waste_logs for each location and day
      const logs: any[] = [];
      const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });

      for (const loc of locations) {
        for (const day of days) {
          // 30-60 logs per day per location
          const logsPerDay = 30 + Math.floor(Math.random() * 30);
          
          for (let i = 0; i < logsPerDay; i++) {
            const item = insertedItems[Math.floor(Math.random() * insertedItems.length)];
            
            // Reason distribution: end_of_day 65%, expired 15%, broken 10%, other 8%, theft 2%
            const rand = Math.random();
            let reason: WasteReason;
            if (rand < 0.65) reason = 'end_of_day';
            else if (rand < 0.80) reason = 'expired';
            else if (rand < 0.90) reason = 'broken';
            else if (rand < 0.98) reason = 'other';
            else reason = 'theft';

            const quantity = item.unit === 'ea' 
              ? Math.floor(1 + Math.random() * 30)
              : Math.round((0.5 + Math.random() * 8) * 100) / 100;

            // Value: €0.50 - €40, with some outliers
            let value = 0.5 + Math.random() * 15;
            if (Math.random() < 0.1) value = 30 + Math.random() * 50; // 10% outliers

            logs.push({
              date: format(day, 'yyyy-MM-dd'),
              location_id: loc.id,
              item_id: item.id,
              reason,
              quantity,
              value: Math.round(value * 100) / 100,
              user_id: null
            });
          }
        }
      }

      // 3. Insert logs in batches
      const batchSize = 500;
      for (let i = 0; i < logs.length; i += batchSize) {
        const batch = logs.slice(i, i + batchSize);
        const { error } = await supabase.from('waste_logs').insert(batch);
        if (error) {
          console.error('Error inserting waste logs batch:', error);
        }
      }

      toast.success(`Generated ${logs.length} waste logs for ${locations.length} locations`);
      
      // Refresh data
      await fetchData();

    } catch (error) {
      console.error('Error seeding demo data:', error);
      toast.error('Failed to generate demo data');
    } finally {
      setIsLoading(false);
    }
  }, [group?.id, locations, dateRange, fetchData]);

  return {
    isLoading,
    hasData,
    metrics,
    trendData,
    byReason,
    byCategory,
    leaderboard,
    items,
    seedDemoData,
    refetch: fetchData
  };
}
