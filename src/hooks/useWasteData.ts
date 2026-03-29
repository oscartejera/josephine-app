// Migrated to sales_daily_unified contract view
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { toLegacyDataSource } from '@/data';
import { format, eachDayOfInterval, parseISO, differenceInDays, subDays } from 'date-fns';
import { toast } from 'sonner';
import type { DateMode, DateRangeValue } from '@/components/bi/DateRangePickerNoryLike';

export type WasteReason = 'spillage' | 'expiry' | 'kitchen_error' | 'courtesy' | 'broken' | 'end_of_day' | 'over_production' | 'plate_waste' | 'expired' | 'theft' | 'other';

export interface WasteMetrics {
  totalSales: number;
  totalAccountedWaste: number;
  wastePercentOfSales: number;
}

export interface WasteTrendData {
  date: string;
  spillage: number;
  expiry: number;
  kitchen_error: number;
  courtesy: number;
  broken: number;
  end_of_day: number;
  over_production: number;
  plate_waste: number;
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
  spillage: 'Derrame',
  expiry: 'Caducidad',
  kitchen_error: 'Error de cocina',
  courtesy: 'Cortesía',
  broken: 'Rotura',
  end_of_day: 'Fin de día',
  over_production: 'Sobreproducción',
  plate_waste: 'Resto de plato',
  expired: 'Producto vencido',
  theft: 'Robo/Consumo',
  other: 'Otros'
};

// Normalize reason from various formats to standard WasteReason (8 canonical codes)
function normalizeReason(rawReason: string | null | undefined): WasteReason {
  if (!rawReason) return 'other';

  const lower = rawReason.toLowerCase().trim();

  // Canonical codes — pass through directly
  const canonical: WasteReason[] = ['spillage', 'expiry', 'kitchen_error', 'courtesy', 'broken', 'end_of_day', 'over_production', 'plate_waste', 'expired', 'theft', 'other'];
  if (canonical.includes(lower as WasteReason)) return lower as WasteReason;

  // Spanish / legacy aliases
  if (lower === 'derrame' || lower === 'vertido') return 'spillage';
  if (lower === 'caducado' || lower === 'caducidad' || lower === 'vencido') return 'expiry';
  if (lower === 'error cocina' || lower === 'error_cocina' || lower.includes('preparación')) return 'kitchen_error';
  if (lower === 'cortesía' || lower === 'cortesia' || lower === 'invitación' || lower.includes('devolución')) return 'courtesy';
  if (lower === 'rotura' || lower === 'dañado' || lower === 'deterioro') return 'broken';
  if (lower === 'fin de día' || lower === 'end of day') return 'end_of_day';
  if (lower === 'sobreproducción' || lower === 'overproduction') return 'over_production';
  if (lower === 'resto de plato' || lower === 'plate waste' || lower === 'plate_return') return 'plate_waste';
  if (lower === 'robo' || lower === 'hurto') return 'theft';

  return 'other';
}

export function useWasteData(
  dateRange: DateRangeValue,
  _dateMode: DateMode, // Reserved for future use
  selectedLocations: string[]
) {
  const { locations, dataSource, loading: appLoading } = useApp();
  const { session } = useAuth();
  const dsLegacy = toLegacyDataSource(dataSource);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [metrics, setMetrics] = useState<WasteMetrics>({
    totalSales: 0,
    totalAccountedWaste: 0,
    wastePercentOfSales: 0
  });
  const [prevMetrics, setPrevMetrics] = useState<{ totalWaste: number; wastePercent: number } | null>(null);
  const [trendData, setTrendData] = useState<WasteTrendData[]>([]);
  const [byReason, setByReason] = useState<WasteByReason[]>([]);
  const [byCategory, setByCategory] = useState<WasteByCategory[]>([]);
  const [leaderboard, setLeaderboard] = useState<WasteLeaderboard[]>([]);
  const [items, setItems] = useState<WasteItem[]>([]);
  const [rawEvents, setRawEvents] = useState<any[]>([]);

  const locationIds = useMemo(() => {
    if (selectedLocations.length === 0) {
      return locations.map(l => l.id);
    }
    return selectedLocations;
  }, [selectedLocations, locations]);

  // Safety: if app finished loading but there are no locations, stop loading
  useEffect(() => {
    if (!appLoading && locations.length === 0) {
      setIsLoading(false);
    }
  }, [appLoading, locations.length]);

  const fetchData = useCallback(async () => {
    // Guard: don't fetch while app context is loading or if no locations
    if (appLoading || locations.length === 0) return;

    setIsLoading(true);

    try {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      // Fetch sales data from unified view
      let salesQuery = supabase
        .from('sales_daily_unified' as any)
        .select('location_id, net_sales')
        .eq('data_source', dsLegacy)
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
        .select('id, location_id, waste_value, reason, quantity, created_at, logged_by, inventory_item_id, inventory_items(name, category_name, supplier_name)')
        .gte('created_at', `${fromDate}T00:00:00`)
        .lte('created_at', `${toDate}T23:59:59`);

      if (locationIds.length > 0 && locationIds.length < locations.length) {
        wasteQuery = wasteQuery.in('location_id', locationIds);
      }

      const { data: wasteEvents } = await wasteQuery;
      setRawEvents(wasteEvents || []);

      const totalAccountedWaste = (wasteEvents || []).reduce((sum, w) => sum + (w.waste_value || 0), 0);
      const wastePercentOfSales = totalSales > 0 ? (totalAccountedWaste / totalSales) * 100 : 0;

      // ── Fetch previous period for delta comparison ──
      const periodDays = differenceInDays(dateRange.to, dateRange.from) + 1;
      const prevFrom = format(subDays(dateRange.from, periodDays), 'yyyy-MM-dd');
      const prevTo = format(subDays(dateRange.from, 1), 'yyyy-MM-dd');

      let prevSalesQuery = supabase
        .from('sales_daily_unified' as any)
        .select('net_sales')
        .eq('data_source', dsLegacy)
        .gte('date', prevFrom)
        .lte('date', prevTo);
      if (locationIds.length > 0 && locationIds.length < locations.length) {
        prevSalesQuery = prevSalesQuery.in('location_id', locationIds);
      }
      const { data: prevSalesData } = await prevSalesQuery;
      const prevTotalSales = (prevSalesData || []).reduce((sum: number, d: any) => sum + (d.net_sales || 0), 0);

      let prevWasteQuery = supabase
        .from('waste_events')
        .select('waste_value')
        .gte('created_at', `${prevFrom}T00:00:00`)
        .lte('created_at', `${prevTo}T23:59:59`);
      if (locationIds.length > 0 && locationIds.length < locations.length) {
        prevWasteQuery = prevWasteQuery.in('location_id', locationIds);
      }
      const { data: prevWasteData } = await prevWasteQuery;
      const prevTotalWaste = (prevWasteData || []).reduce((sum: number, w: any) => sum + (w.waste_value || 0), 0);
      const prevWastePercent = prevTotalSales > 0 ? (prevTotalWaste / prevTotalSales) * 100 : 0;

      setPrevMetrics(prevTotalWaste > 0 ? { totalWaste: prevTotalWaste, wastePercent: prevWastePercent } : null);

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
          spillage: 0,
          expiry: 0,
          kitchen_error: 0,
          courtesy: 0,
          broken: 0,
          end_of_day: 0,
          over_production: 0,
          plate_waste: 0,
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
      (['spillage', 'expiry', 'kitchen_error', 'courtesy', 'broken', 'end_of_day', 'over_production', 'plate_waste', 'expired', 'theft', 'other'] as WasteReason[]).forEach(r => {
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

      // Calculate leaderboard from real logged_by data
      const userWasteMap = new Map<string, { count: number; value: number; locationIds: Set<string> }>();
      (wasteEvents || []).forEach((event: any) => {
        const userId = event.logged_by || 'unknown';
        const existing = userWasteMap.get(userId) || { count: 0, value: 0, locationIds: new Set<string>() };
        existing.count++;
        existing.value += event.waste_value || 0;
        existing.locationIds.add(event.location_id);
        userWasteMap.set(userId, existing);
      });

      // Fetch profile names for logged_by users
      const userIds = Array.from(userWasteMap.keys()).filter(id => id !== 'unknown');
      let profileMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        (profiles || []).forEach((p: any) => {
          profileMap.set(p.id, p.full_name || 'Unknown');
        });
      }

      const leaderboardData: WasteLeaderboard[] = [];
      userWasteMap.forEach((data, userId) => {
        const name = userId === 'unknown' ? 'Unassigned' : (profileMap.get(userId) || 'Unknown');
        const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
        // Find primary location
        const locIds = Array.from(data.locationIds);
        const loc = locations.find(l => locIds.includes(l.id));
        leaderboardData.push({
          employeeId: userId === 'unknown' ? null : userId,
          employeeName: name,
          initials: initials || '??',
          locationName: loc?.name || '-',
          logsCount: data.count,
          totalValue: data.value
        });
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
  }, [dateRange, locationIds, locations, dsLegacy, appLoading]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Subscribe to realtime waste event updates
  useEffect(() => {
    if (!session) return;

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
  }, [fetchData, session]);

  return {
    isLoading,
    isConnected,
    metrics,
    prevMetrics,
    trendData,
    byReason,
    byCategory,
    leaderboard,
    items,
    rawEvents,
    locations: locations.filter(l => locationIds.includes(l.id)),
    REASON_LABELS,
    refetch: fetchData
  };
}
