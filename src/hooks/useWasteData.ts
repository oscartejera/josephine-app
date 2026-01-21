import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { getDemoGenerator } from '@/lib/demoDataGenerator';
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

const REASON_LABELS: Record<WasteReason, string> = {
  broken: 'Broken',
  end_of_day: 'End of day',
  expired: 'Expired',
  theft: 'Theft',
  other: 'Other'
};

export function useWasteData(
  dateRange: DateRangeValue,
  dateMode: DateMode,
  selectedLocations: string[]
) {
  const { locations, group } = useApp();
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

      // Fetch tickets for sales data
      let ticketsQuery = supabase
        .from('tickets')
        .select('id, location_id, net_total, gross_total')
        .gte('closed_at', `${fromDate}T00:00:00`)
        .lte('closed_at', `${toDate}T23:59:59`)
        .eq('status', 'closed');

      if (locationIds.length > 0 && locationIds.length < locations.length) {
        ticketsQuery = ticketsQuery.in('location_id', locationIds);
      }

      const { data: tickets } = await ticketsQuery;
      const totalSales = (tickets || []).reduce((sum, t) => sum + (t.net_total || t.gross_total || 0), 0);

      // Fetch waste events with inventory items
      let wasteQuery = supabase
        .from('waste_events')
        .select('id, location_id, waste_value, reason, quantity, created_at, inventory_item_id, inventory_items(name, category)')
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
          const reason = (event.reason as WasteReason) || 'other';
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
        const reason = (event.reason as WasteReason) || 'other';
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
        const cat = event.inventory_items?.category || 'Other';
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
        const reason = (event.reason as WasteReason) || 'other';
        
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

  // Seed demo data to database
  const seedDemoData = useCallback(async () => {
    if (!group?.id || locations.length === 0) {
      toast.error('No group or locations available');
      return;
    }

    const reasonsWeighted = [
      'End of day', 'End of day', 'End of day', 'End of day', 'End of day',
      'Expired', 'Expired', 'Expired',
      'Broken', 'Broken',
      'Other',
      'Theft'
    ];
    const categories = ['Fresh', 'Dairy', 'Frozen', 'Sauce', 'Dry goods'];
    const itemNames = [
      'Brined Chicken Fillets (kg)', 'Luxury cheese sauce (kg)', 'Fresh salmon (kg)',
      'Organic eggs (dozen)', 'Butter (500g)', 'Fresh cream (ltr)',
      'Mixed salad leaves (kg)', 'Tomatoes (kg)', 'Potatoes (kg)',
      'Pasta sauce (jar)', 'Olive oil (ltr)', 'Milk (ltr)',
      'Ice cream (tub)', 'Frozen peas (kg)', 'Beef mince (kg)',
      'Yogurt (pack)', 'Cheese block (kg)', 'Ham slices (pack)'
    ];

    const wasteRows = [];
    const today = new Date();

    for (const loc of locations) {
      // Generate 80-200 logs per location
      const logsCount = 80 + Math.floor(Math.random() * 120);
      
      for (let i = 0; i < logsCount; i++) {
        const daysAgo = Math.floor(Math.random() * 30);
        const eventDate = new Date(today);
        eventDate.setDate(eventDate.getDate() - daysAgo);
        
        const reason = reasonsWeighted[Math.floor(Math.random() * reasonsWeighted.length)];
        const itemName = itemNames[Math.floor(Math.random() * itemNames.length)];
        const category = categories[Math.floor(Math.random() * categories.length)];
        const quantity = 0.5 + Math.random() * 10;
        const unitCost = 2 + Math.random() * 40;
        const wasteValue = quantity * unitCost;

        wasteRows.push({
          location_id: loc.id,
          inventory_item_id: null, // We'll use the first available or skip FK
          quantity: Math.round(quantity * 100) / 100,
          reason,
          waste_value: Math.round(wasteValue * 100) / 100,
          created_at: eventDate.toISOString()
        });
      }
    }

    // Get an inventory item to use (or skip if none)
    const { data: invItems } = await supabase
      .from('inventory_items')
      .select('id')
      .limit(1);

    const inventoryItemId = invItems?.[0]?.id;
    
    if (!inventoryItemId) {
      toast.error('No inventory items found. Please create inventory items first.');
      return;
    }

    // Update all rows with the inventory item ID
    const rowsWithItem = wasteRows.map(r => ({
      ...r,
      inventory_item_id: inventoryItemId
    }));

    const { error } = await supabase
      .from('waste_events')
      .insert(rowsWithItem);

    if (error) {
      console.error('Error seeding waste data:', error);
      toast.error('Failed to generate demo data');
      return;
    }

    toast.success(`Generated ${wasteRows.length} waste events`);
    fetchData();
  }, [group?.id, locations, fetchData]);

  // Generate demo data fallback if empty (in-memory only)
  useEffect(() => {
    if (!isLoading && metrics.totalAccountedWaste === 0) {
      generateDemoData();
    }
  }, [isLoading, metrics.totalAccountedWaste]);

  const generateDemoData = () => {
    const demoSales = 52000 + Math.random() * 8000;
    const demoWaste = demoSales * (0.018 + Math.random() * 0.008); // 1.8-2.6% waste

    setMetrics({
      totalSales: demoSales,
      totalAccountedWaste: demoWaste,
      wastePercentOfSales: (demoWaste / demoSales) * 100
    });

    // Demo trend data
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    const demoTrend: WasteTrendData[] = days.map(day => {
      const dayFactor = Math.random() * 0.5 + 0.75;
      const baseDaily = demoWaste / days.length * dayFactor;
      return {
        date: format(day, 'yyyy-MM-dd'),
        broken: baseDaily * 0.08,
        end_of_day: baseDaily * 0.55,
        expired: baseDaily * 0.20,
        theft: baseDaily * 0.05,
        other: baseDaily * 0.12
      };
    });
    setTrendData(demoTrend);

    // Demo by reason
    setByReason([
      { reason: 'end_of_day', count: 156, value: demoWaste * 0.55 },
      { reason: 'expired', count: 42, value: demoWaste * 0.20 },
      { reason: 'broken', count: 28, value: demoWaste * 0.08 },
      { reason: 'other', count: 18, value: demoWaste * 0.12 },
      { reason: 'theft', count: 5, value: demoWaste * 0.05 }
    ]);

    // Demo by category
    setByCategory([
      { category: 'Fresh', value: demoWaste * 0.35, percentOfTotal: 35 },
      { category: 'Dairy', value: demoWaste * 0.22, percentOfTotal: 22 },
      { category: 'Frozen', value: demoWaste * 0.18, percentOfTotal: 18 },
      { category: 'Sauce', value: demoWaste * 0.15, percentOfTotal: 15 },
      { category: 'Other', value: demoWaste * 0.10, percentOfTotal: 10 }
    ]);

    // Demo leaderboard
    setLeaderboard([
      { employeeId: '1', employeeName: 'Carlos Martín', initials: 'CM', locationName: 'Madrid Centro', logsCount: 48, totalValue: demoWaste * 0.32 },
      { employeeId: '2', employeeName: 'Ana López', initials: 'AL', locationName: 'Barcelona Gràcia', logsCount: 35, totalValue: demoWaste * 0.28 },
      { employeeId: '3', employeeName: 'María García', initials: 'MG', locationName: 'Valencia Ruzafa', logsCount: 28, totalValue: demoWaste * 0.22 },
      { employeeId: '4', employeeName: 'David Ruiz', initials: 'DR', locationName: 'Madrid Centro', logsCount: 15, totalValue: demoWaste * 0.12 },
      { employeeId: '5', employeeName: 'Laura Sánchez', initials: 'LS', locationName: 'Barcelona Gràcia', logsCount: 8, totalValue: demoWaste * 0.06 }
    ]);

    // Demo items
    const demoItems = [
      'Ensalada mixta', 'Tomate fresco', 'Lechuga romana', 'Pollo asado',
      'Salmón', 'Queso manchego', 'Pan de barra', 'Leche entera',
      'Huevos', 'Patatas', 'Cebolla', 'Pimiento rojo'
    ];
    const reasons: WasteReason[] = ['end_of_day', 'expired', 'broken', 'other', 'theft'];
    
    setItems(demoItems.map((name, i) => ({
      itemId: `demo-${i}`,
      itemName: name,
      quantity: Math.floor(5 + Math.random() * 20),
      value: (demoWaste / demoItems.length) * (1.5 - i * 0.08),
      type: Math.random() > 0.3 ? 'ingredient' : 'product',
      topReason: reasons[i % reasons.length],
      percentOfSales: ((demoWaste / demoItems.length) * (1.5 - i * 0.08)) / demoSales * 100
    })));
  };

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
    seedDemoData,
    refetch: fetchData
  };
}
