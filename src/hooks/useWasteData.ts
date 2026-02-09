import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { toast } from 'sonner';
import type { DateMode, DateRangeValue } from '@/components/bi/DateRangePickerNoryLike';

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

export interface WasteLeaderboard {
  employeeId: string | null;
  employeeName: string;
  initials: string;
  locationName: string;
  logsCount: number;
  totalValue: number;
}

export interface WasteItem {
  itemId: string;
  itemName: string;
  quantity: number;
  value: number;
  type: 'ingredient' | 'product';
  topReason: WasteReason;
  percentOfSales: number;
}

export const REASON_LABELS: Record<WasteReason, string> = {
  broken: 'Broken',
  end_of_day: 'End of day',
  expired: 'Expired',
  theft: 'Theft',
  other: 'Other'
};

// Normalize reason from various formats to standard WasteReason
function normalizeReason(rawReason: string | null | undefined): WasteReason {
  if (!rawReason) return 'other';
  
  const lower = rawReason.toLowerCase().trim();
  
  // Map various formats to standard reasons
  if (lower === 'broken' || lower === 'rotura' || lower === 'dañado' || lower === 'deterioro') {
    return 'broken';
  }
  if (lower === 'end of day' || lower === 'end_of_day' || lower === 'sobreproducción' || lower === 'fin de día') {
    return 'end_of_day';
  }
  if (lower === 'expired' || lower === 'caducado' || lower === 'caducidad') {
    return 'expired';
  }
  if (lower === 'theft' || lower === 'robo' || lower === 'hurto') {
    return 'theft';
  }
  if (lower === 'other' || lower === 'otro' || lower === 'otros' || lower.includes('error') || lower.includes('devolución') || lower.includes('preparación')) {
    return 'other';
  }
  // Default fallback
  return 'other';
}

export function useWasteData(
  dateRange: DateRangeValue,
  _dateMode: DateMode, // Reserved for future use
  selectedLocations: string[]
) {
  const { locations } = useApp();
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [metrics, setMetrics] = useState<WasteMetrics>({
    totalSales: 0,
    totalAccountedWaste: 0,
    wastePercentOfSales: 0
  });
  const [trendData, setTrendData] = useState<WasteTrendData[]>([]);
  const [byReason, setByReason] = useState<WasteByReason[]>([]);
  const [byCategory, setByCategory] = useState<WasteByCategory[]>([]);
  const [leaderboard, setLeaderboard] = useState<WasteLeaderboard[]>([]);
  const [items, setItems] = useState<WasteItem[]>([]);

  const locationIds = useMemo(() => {
    if (selectedLocations.length === 0) {
      return locations.map(l => l.id);
    }
    return selectedLocations;
  }, [selectedLocations, locations]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);

    try {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      // Fetch sales data from pos_daily_finance
      let salesQuery = supabase
        .from('pos_daily_finance')
        .select('location_id, net_sales')
        .gte('date', fromDate)
        .lte('date', toDate);

      if (locationIds.length > 0 && locationIds.length < locations.length) {
        salesQuery = salesQuery.in('location_id', locationIds);
      }

      const { data: dailySales } = await salesQuery;
      const totalSales = (dailySales || []).reduce((sum, d) => sum + (d.net_sales || 0), 0);

      // Fetch waste events with inventory items
      let wasteQuery = supabase
        .from('waste_events')
        .select('id, location_id, waste_value, reason, quantity, created_at, inventory_item_id, inventory_items(name, category_name)')
        .gte('created_at', `${fromDate}T00:00:00`)
        .lte('created_at', `${toDate}T23:59:59`);

      if (locationIds.length > 0 && locationIds.length < locations.length) {
        wasteQuery = wasteQuery.in('location_id', locationIds);
      }

      const { data: wasteEvents } = await wasteQuery;
      
      const totalAccountedWaste = (wasteEvents || []).reduce((sum, w) => sum + (w.waste_value || 0), 0);
      const wastePercentOfSales = totalSales > 0 ? (totalAccountedWaste / totalSales) * 100 : 0;

      setMetrics({
        totalSales,
        totalAccountedWaste,
        wastePercentOfSales
      });

      // Calculate trend data by day
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

      (wasteEvents || []).forEach(event => {
        const dateStr = format(parseISO(event.created_at), 'yyyy-MM-dd');
        const existing = trendMap.get(dateStr);
        if (existing) {
          const reason = normalizeReason(event.reason);
          existing[reason] = (existing[reason] || 0) + (event.waste_value || 0);
          trendMap.set(dateStr, existing);
        }
      });

      setTrendData(Array.from(trendMap.values()));

      // Calculate by reason
      const reasonMap = new Map<WasteReason, { count: number; value: number }>();
      (['broken', 'end_of_day', 'expired', 'theft', 'other'] as WasteReason[]).forEach(r => {
        reasonMap.set(r, { count: 0, value: 0 });
      });

      (wasteEvents || []).forEach(event => {
        const reason = normalizeReason(event.reason);
        const existing = reasonMap.get(reason) || { count: 0, value: 0 };
        existing.count++;
        existing.value += event.waste_value || 0;
        reasonMap.set(reason, existing);
      });

      setByReason(Array.from(reasonMap.entries()).map(([reason, data]) => ({
        reason,
        count: data.count,
        value: data.value
      })));

      // Calculate by category
      const categoryMap = new Map<string, number>();
      (wasteEvents || []).forEach((event: any) => {
        const cat = event.inventory_items?.category_name || 'Other';
        const catLabel = cat.charAt(0).toUpperCase() + cat.slice(1);
        const existing = categoryMap.get(catLabel) || 0;
        categoryMap.set(catLabel, existing + (event.waste_value || 0));
      });

      const totalCategoryValue = Array.from(categoryMap.values()).reduce((sum, v) => sum + v, 0);
      setByCategory(Array.from(categoryMap.entries()).map(([category, value]) => ({
        category,
        value,
        percentOfTotal: totalCategoryValue > 0 ? (value / totalCategoryValue) * 100 : 0
      })));

      // Calculate leaderboard (mock employee names since we don't have logged_by)
      const locationWasteMap = new Map<string, { count: number; value: number }>();
      (wasteEvents || []).forEach(event => {
        const locId = event.location_id;
        const existing = locationWasteMap.get(locId) || { count: 0, value: 0 };
        existing.count++;
        existing.value += event.waste_value || 0;
        locationWasteMap.set(locId, existing);
      });

      const mockEmployees = [
        { name: 'Carlos Martín', initials: 'CM' },
        { name: 'Ana López', initials: 'AL' },
        { name: 'María García', initials: 'MG' },
        { name: 'David Ruiz', initials: 'DR' },
        { name: 'Laura Sánchez', initials: 'LS' }
      ];

      const leaderboardData: WasteLeaderboard[] = [];
      let empIndex = 0;
      locationWasteMap.forEach((data, locId) => {
        const loc = locations.find(l => l.id === locId);
        if (loc) {
          const emp = mockEmployees[empIndex % mockEmployees.length];
          leaderboardData.push({
            employeeId: null,
            employeeName: emp.name,
            initials: emp.initials,
            locationName: loc.name,
            logsCount: data.count,
            totalValue: data.value
          });
          empIndex++;
        }
      });
      setLeaderboard(leaderboardData.sort((a, b) => b.totalValue - a.totalValue));

      // Calculate items table
      const itemMap = new Map<string, { 
        itemName: string; 
        quantity: number; 
        value: number; 
        reasonValues: Map<WasteReason, number>;
      }>();

      (wasteEvents || []).forEach((event: any) => {
        const itemId = event.inventory_item_id || 'unknown';
        const itemName = event.inventory_items?.name || 'Unknown Item';
        const reason = normalizeReason(event.reason);
        
        const existing = itemMap.get(itemId) || { 
          itemName, 
          quantity: 0, 
          value: 0, 
          reasonValues: new Map() 
        };
        existing.quantity += event.quantity || 0;
        existing.value += event.waste_value || 0;
        
        const reasonVal = existing.reasonValues.get(reason) || 0;
        existing.reasonValues.set(reason, reasonVal + (event.waste_value || 0));
        
        itemMap.set(itemId, existing);
      });

      const itemsData: WasteItem[] = Array.from(itemMap.entries()).map(([itemId, data]) => {
        // Find top reason
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
          quantity: data.quantity,
          value: data.value,
          type: 'ingredient' as const,
          topReason,
          percentOfSales: totalSales > 0 ? (data.value / totalSales) * 100 : 0
        };
      });

      setItems(itemsData.sort((a, b) => b.value - a.value));

    } catch (error) {
      console.error('Error fetching waste data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, locationIds, locations]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Subscribe to realtime waste event updates
  useEffect(() => {
    const channel = supabase
      .channel('waste-events-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'waste_events'
        },
        (payload) => {
          console.log('Waste event realtime update:', payload);
          fetchData();
          
          if (payload.eventType === 'INSERT') {
            toast.success('New waste logged', {
              description: 'Waste data has been updated.',
              duration: 3000,
            });
          } else if (payload.eventType === 'DELETE') {
            toast.info('Waste entry removed', {
              description: 'Waste data has been updated.',
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
  }, [fetchData]);

  return {
    isLoading,
    isConnected,
    metrics,
    trendData,
    byReason,
    byCategory,
    leaderboard,
    items,
    locations: locations.filter(l => locationIds.includes(l.id)),
    REASON_LABELS,
    refetch: fetchData
  };
}
