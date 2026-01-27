import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay } from 'date-fns';

export interface KDSLocationStats {
  locationId: string;
  locationName: string;
  ordersCompleted: number;
  itemsCompleted: number;
  avgPrepTime: number; // minutes
  overdueCount: number;
  onTimePercentage: number;
  byDestination: {
    kitchen: { count: number; avgTime: number };
    bar: { count: number; avgTime: number };
    prep: { count: number; avgTime: number };
  };
}

export interface KDSHourlyData {
  hour: number;
  orders: number;
  avgPrepTime: number;
}

export interface KDSDashboardData {
  totalOrdersCompleted: number;
  totalItemsCompleted: number;
  avgPrepTime: number;
  onTimePercentage: number;
  overdueAlerts: number;
  locationStats: KDSLocationStats[];
  hourlyData: KDSHourlyData[];
  topSlowProducts: { name: string; avgTime: number; count: number }[];
  fastestProducts: { name: string; avgTime: number; count: number }[];
}

interface UseKDSDashboardDataOptions {
  date?: Date;
  locationIds?: string[];
}

export function useKDSDashboardData(options: UseKDSDashboardDataOptions = {}) {
  const [data, setData] = useState<KDSDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const targetDate = options.date || new Date();
    const dayStart = startOfDay(targetDate).toISOString();
    const dayEnd = endOfDay(targetDate).toISOString();

    try {
      setLoading(true);
      setError(null);

      // Fetch locations
      const { data: locations, error: locError } = await supabase
        .from('locations')
        .select('id, name');

      if (locError) throw locError;

      // Build location filter
      const locationFilter = options.locationIds?.length 
        ? options.locationIds 
        : locations?.map(l => l.id) || [];

      if (locationFilter.length === 0) {
        setData({
          totalOrdersCompleted: 0,
          totalItemsCompleted: 0,
          avgPrepTime: 0,
          onTimePercentage: 100,
          overdueAlerts: 0,
          locationStats: [],
          hourlyData: [],
          topSlowProducts: [],
          fastestProducts: [],
        });
        setLoading(false);
        return;
      }

      // Fetch tickets for the day
      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .select('id, location_id, opened_at')
        .in('location_id', locationFilter)
        .gte('opened_at', dayStart)
        .lte('opened_at', dayEnd);

      if (ticketsError) throw ticketsError;

      const ticketIds = tickets?.map(t => t.id) || [];

      if (ticketIds.length === 0) {
        setData({
          totalOrdersCompleted: 0,
          totalItemsCompleted: 0,
          avgPrepTime: 0,
          onTimePercentage: 100,
          overdueAlerts: 0,
          locationStats: locations?.map(l => ({
            locationId: l.id,
            locationName: l.name,
            ordersCompleted: 0,
            itemsCompleted: 0,
            avgPrepTime: 0,
            overdueCount: 0,
            onTimePercentage: 100,
            byDestination: {
              kitchen: { count: 0, avgTime: 0 },
              bar: { count: 0, avgTime: 0 },
              prep: { count: 0, avgTime: 0 },
            },
          })) || [],
          hourlyData: Array.from({ length: 24 }, (_, i) => ({ hour: i, orders: 0, avgPrepTime: 0 })),
          topSlowProducts: [],
          fastestProducts: [],
        });
        setLoading(false);
        return;
      }

      // Fetch ticket lines with prep data - batch if needed
      const batchSize = 500;
      const batches = [];
      for (let i = 0; i < ticketIds.length; i += batchSize) {
        batches.push(ticketIds.slice(i, i + batchSize));
      }

      const lineResults = await Promise.all(
        batches.map(batch =>
          supabase
            .from('ticket_lines')
            .select('*, products:product_id(name, target_prep_time)')
            .in('ticket_id', batch)
            .eq('sent_to_kitchen', true)
            .not('prep_started_at', 'is', null)
            .not('ready_at', 'is', null)
        )
      );

      const allLines = lineResults.flatMap(r => r.data || []);

      // Calculate metrics
      const locationStatsMap = new Map<string, KDSLocationStats>();
      const hourlyMap = new Map<number, { orders: Set<string>; totalTime: number; count: number }>();
      const productTimes = new Map<string, { totalTime: number; count: number }>();

      // Default thresholds
      const defaultThresholds = { kitchen: 8, bar: 3, prep: 5 };

      let totalPrepTime = 0;
      let totalItems = 0;
      let overdueCount = 0;
      const completedTickets = new Set<string>();

      for (const line of allLines) {
        const lineData = line as any;
        const ticket = tickets?.find(t => t.id === line.ticket_id);
        if (!ticket) continue;

        const prepStart = new Date(line.prep_started_at!).getTime();
        const readyAt = new Date(line.ready_at!).getTime();
        const prepTime = Math.max(0, Math.min((readyAt - prepStart) / 60000, 120)); // Cap at 120 min

        const destination = (line.destination || 'kitchen') as 'kitchen' | 'bar' | 'prep';
        const threshold = lineData.products?.target_prep_time ?? defaultThresholds[destination];
        const isOverdue = prepTime > threshold;

        if (isOverdue) overdueCount++;
        totalPrepTime += prepTime;
        totalItems++;
        completedTickets.add(line.ticket_id);

        // Location stats
        if (!locationStatsMap.has(ticket.location_id)) {
          const loc = locations?.find(l => l.id === ticket.location_id);
          locationStatsMap.set(ticket.location_id, {
            locationId: ticket.location_id,
            locationName: loc?.name || 'Unknown',
            ordersCompleted: 0,
            itemsCompleted: 0,
            avgPrepTime: 0,
            overdueCount: 0,
            onTimePercentage: 100,
            byDestination: {
              kitchen: { count: 0, avgTime: 0 },
              bar: { count: 0, avgTime: 0 },
              prep: { count: 0, avgTime: 0 },
            },
          });
        }

        const locStats = locationStatsMap.get(ticket.location_id)!;
        locStats.itemsCompleted++;
        locStats.avgPrepTime = (locStats.avgPrepTime * (locStats.itemsCompleted - 1) + prepTime) / locStats.itemsCompleted;
        if (isOverdue) locStats.overdueCount++;
        locStats.byDestination[destination].count++;
        const destStats = locStats.byDestination[destination];
        destStats.avgTime = (destStats.avgTime * (destStats.count - 1) + prepTime) / destStats.count;

        // Hourly stats
        const hour = new Date(line.prep_started_at!).getHours();
        if (!hourlyMap.has(hour)) {
          hourlyMap.set(hour, { orders: new Set(), totalTime: 0, count: 0 });
        }
        const hourStats = hourlyMap.get(hour)!;
        hourStats.orders.add(line.ticket_id);
        hourStats.totalTime += prepTime;
        hourStats.count++;

        // Product stats
        const productName = lineData.products?.name || line.item_name || 'Unknown';
        if (!productTimes.has(productName)) {
          productTimes.set(productName, { totalTime: 0, count: 0 });
        }
        const prodStats = productTimes.get(productName)!;
        prodStats.totalTime += prepTime;
        prodStats.count++;
      }

      // Calculate order counts per location
      for (const ticket of tickets || []) {
        if (completedTickets.has(ticket.id)) {
          const locStats = locationStatsMap.get(ticket.location_id);
          if (locStats) {
            locStats.ordersCompleted++;
          }
        }
      }

      // Calculate on-time percentage per location
      locationStatsMap.forEach(stats => {
        if (stats.itemsCompleted > 0) {
          stats.onTimePercentage = ((stats.itemsCompleted - stats.overdueCount) / stats.itemsCompleted) * 100;
        }
      });

      // Build hourly data
      const hourlyData: KDSHourlyData[] = Array.from({ length: 24 }, (_, i) => {
        const stats = hourlyMap.get(i);
        return {
          hour: i,
          orders: stats?.orders.size || 0,
          avgPrepTime: stats && stats.count > 0 ? stats.totalTime / stats.count : 0,
        };
      });

      // Top slow and fast products
      const productList = Array.from(productTimes.entries())
        .map(([name, stats]) => ({
          name,
          avgTime: stats.totalTime / stats.count,
          count: stats.count,
        }))
        .filter(p => p.count >= 3); // Only products with at least 3 items

      const topSlowProducts = [...productList]
        .sort((a, b) => b.avgTime - a.avgTime)
        .slice(0, 5);

      const fastestProducts = [...productList]
        .sort((a, b) => a.avgTime - b.avgTime)
        .slice(0, 5);

      const onTimePercentage = totalItems > 0 
        ? ((totalItems - overdueCount) / totalItems) * 100 
        : 100;

      setData({
        totalOrdersCompleted: completedTickets.size,
        totalItemsCompleted: totalItems,
        avgPrepTime: totalItems > 0 ? totalPrepTime / totalItems : 0,
        onTimePercentage,
        overdueAlerts: overdueCount,
        locationStats: Array.from(locationStatsMap.values()),
        hourlyData,
        topSlowProducts,
        fastestProducts,
      });
    } catch (err) {
      console.error('Error fetching KDS dashboard data:', err);
      setError('Error al cargar datos del KDS');
    } finally {
      setLoading(false);
    }
  }, [options.date, options.locationIds?.join(',')]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
