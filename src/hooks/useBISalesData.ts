import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { format, eachDayOfInterval, eachHourOfInterval, startOfDay, endOfDay, differenceInDays, isSameDay } from 'date-fns';
import { toast } from 'sonner';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type CompareMode = 'forecast' | 'previous_period' | 'previous_year';
export type GranularityMode = 'daily' | 'weekly' | 'monthly';

export interface BIDateRange {
  from: Date;
  to: Date;
}

export interface ChannelData {
  channel: string;
  sales: number;
  salesDelta: number;
  projectedSales: number;
  projectedSalesDelta: number;
  acs: number;
  acsDelta: number;
  projectedAcs: number;
  projectedAcsDelta: number;
  orders: number;
}

export interface CategoryData {
  category: string;
  amount: number;
  ratio: number;
}

export interface ProductData {
  name: string;
  value: number;
  percentage: number;
}

export interface LocationSalesData {
  id: string;
  name: string;
  salesActual: number;
  salesForecast: number;
  dineIn: number;
  dineInDelta: number;
  delivery: number;
  deliveryDelta: number;
  pickUp: number;
  pickUpDelta: number;
  orders: number;
  acs: number;
  dwellTime: number | null;
}

export interface ChartDataPoint {
  label: string;
  actual: number;
  forecast: number;
  avgCheckSize: number;
  avgCheckForecast: number;
  orders?: number;
  forecastOrders?: number;
}

export interface BISalesData {
  isEmpty: boolean;
  dataSource: 'pos' | 'empty';
  kpis: {
    salesToDate: number;
    salesToDateDelta: number;
    avgCheckSize: number;
    avgCheckSizeDelta: number;
    totalOrders: number;
    totalOrdersDelta: number;
    forecastAccuracy: number;
    dwellTime: number | null;
    dwellTimeDelta: number | null;
    channelBreakdown: { channel: string; value: number; percentage: number }[];
    acsBreakdown: { channel: string; value: number }[];
    salesSparkline: number[];
    ordersSparkline: number[];
    acsSparkline: number[];
  };
  chartData: ChartDataPoint[];
  channels: ChannelData[];
  categories: CategoryData[];
  products: ProductData[];
  locations: LocationSalesData[];
}

interface UseBISalesDataParams {
  dateRange: BIDateRange;
  granularity: GranularityMode;
  compareMode: CompareMode;
  locationIds: string[];
}

// Generate empty data structure when there's no real data
function generateEmptyData(dateRange: BIDateRange, isSingleDay: boolean): BISalesData {
  const days = isSingleDay 
    ? eachHourOfInterval({ start: startOfDay(dateRange.from), end: endOfDay(dateRange.from) }).filter(h => h.getHours() >= 10 && h.getHours() <= 21)
    : eachDayOfInterval({ start: dateRange.from, end: dateRange.to });

  const chartData: ChartDataPoint[] = days.map((d) => ({
    label: isSingleDay ? format(d, 'HH:mm') : format(d, 'EEE, dd'),
    actual: 0,
    forecast: 0,
    avgCheckSize: 0,
    avgCheckForecast: 0,
    orders: 0,
    forecastOrders: 0
  }));

  return {
    isEmpty: true,
    dataSource: 'empty',
    kpis: {
      salesToDate: 0,
      salesToDateDelta: 0,
      avgCheckSize: 0,
      avgCheckSizeDelta: 0,
      totalOrders: 0,
      totalOrdersDelta: 0,
      forecastAccuracy: 0,
      dwellTime: null,
      dwellTimeDelta: null,
      channelBreakdown: [],
      acsBreakdown: [],
      salesSparkline: [],
      ordersSparkline: [],
      acsSparkline: []
    },
    chartData,
    channels: [],
    categories: [],
    products: [],
    locations: []
  };
}

export function useBISalesData({ dateRange, granularity, compareMode, locationIds }: UseBISalesDataParams) {
  const { locations } = useApp();
  const queryClient = useQueryClient();
  const effectiveLocationIds = locationIds.length > 0 ? locationIds : locations.map(l => l.id);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  const isSingleDay = isSameDay(dateRange.from, dateRange.to) || differenceInDays(dateRange.to, dateRange.from) === 0;

  // Subscribe to realtime ticket updates - throttled to prevent excessive re-renders
  useEffect(() => {
    let lastRefreshTime = 0;
    const THROTTLE_MS = 5000; // Only refresh every 5 seconds max
    
    const channel = supabase
      .channel('sales-tickets-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tickets'
        },
        (payload) => {
          const now = Date.now();
          if (now - lastRefreshTime < THROTTLE_MS) return;
          lastRefreshTime = now;
          
          setLastUpdate(new Date());
          queryClient.invalidateQueries({ queryKey: ['bi-sales'] });
          
          const newTicket = payload.new as any;
          const amount = newTicket.net_total || newTicket.gross_total || 0;
          toast.success('New transaction!', {
            description: `€${amount.toFixed(2)} sale recorded`,
            duration: 3000,
          });
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, [queryClient]);

  const query = useQuery({
    queryKey: ['bi-sales', dateRange, granularity, compareMode, effectiveLocationIds],
    queryFn: async (): Promise<BISalesData> => {
      if (effectiveLocationIds.length === 0) {
        return generateEmptyData(dateRange, isSingleDay);
      }

      // Fetch tickets data
      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .select(`
          id,
          location_id,
          opened_at,
          closed_at,
          channel,
          gross_total,
          net_total,
          discount_total,
          covers,
          status
        `)
        .in('location_id', effectiveLocationIds)
        .gte('closed_at', dateRange.from.toISOString())
        .lte('closed_at', dateRange.to.toISOString())
        .eq('status', 'closed');

      // Fetch ticket lines for categories and products
      // Use a more efficient approach - fetch by ticket IDs in batches to avoid query limits
      const ticketIds = tickets?.map(t => t.id) || [];
      let ticketLines: any[] = [];
      
      if (ticketIds.length > 0) {
        // Batch ticket IDs to avoid query limits (max ~500 per query)
        const batchSize = 500;
        const batches: string[][] = [];
        for (let i = 0; i < ticketIds.length; i += batchSize) {
          batches.push(ticketIds.slice(i, i + batchSize));
        }
        
        // Fetch all batches in parallel
        const batchResults = await Promise.all(
          batches.map(batch => 
            supabase
              .from('ticket_lines')
              .select('ticket_id, item_name, category_name, gross_line_total, quantity')
              .in('ticket_id', batch)
          )
        );
        
        // Combine results
        batchResults.forEach(result => {
          if (result.data) {
            ticketLines.push(...result.data);
          }
        });
      }

      // Fetch forecasts from the LR+SI v3 model (daily forecasts)
      const { data: dailyForecasts } = await supabase
        .from('forecast_daily_metrics')
        .select('location_id, date, forecast_sales, confidence')
        .in('location_id', effectiveLocationIds)
        .gte('date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('date', format(dateRange.to, 'yyyy-MM-dd'));
      
      // Hourly weights for distributing daily forecast (typical restaurant pattern)
      const HOURLY_WEIGHTS: Record<number, number> = {
        10: 0.02, 11: 0.04, 12: 0.10, 13: 0.14, 14: 0.10, 15: 0.04,
        16: 0.03, 17: 0.05, 18: 0.08, 19: 0.12, 20: 0.14, 21: 0.10, 22: 0.04
      };
      
      // Helper to get hourly forecast from daily
      const getHourlyForecast = (dailyForecast: number, hour: number): number => {
        return dailyForecast * (HOURLY_WEIGHTS[hour] || 0);
      };

      // If no data, return empty state
      if (!tickets || tickets.length === 0) {
        return generateEmptyData(dateRange, isSingleDay);
      }

      // Calculate KPIs
      const totalSales = tickets.reduce((sum, t) => sum + (t.net_total || t.gross_total || 0), 0);
      const totalOrders = tickets.length;
      const totalCovers = tickets.reduce((sum, t) => sum + (t.covers || 1), 0);
      const avgCheckSize = totalCovers > 0 ? totalSales / totalCovers : 0;
      const totalForecast = (dailyForecasts || []).reduce((sum, f) => sum + (f.forecast_sales || 0), 0);
      const salesToDateDelta = totalForecast > 0 ? ((totalSales - totalForecast) / totalForecast) * 100 : 0;

      // Calculate dwell time (only for dine-in with opened_at)
      const dineInTickets = tickets.filter(t => 
        t.channel === 'dinein' && t.opened_at && t.closed_at
      );
      let dwellTime: number | null = null;
      if (dineInTickets.length > 0) {
        const totalDwell = dineInTickets.reduce((sum, t) => {
          const opened = new Date(t.opened_at!);
          const closed = new Date(t.closed_at!);
          return sum + (closed.getTime() - opened.getTime()) / 60000;
        }, 0);
        dwellTime = Math.round(totalDwell / dineInTickets.length);
      }

      // Channel breakdown
      const channelMap = new Map<string, number>();
      tickets.forEach(t => {
        const channel = t.channel || 'unknown';
        const sales = t.net_total || t.gross_total || 0;
        channelMap.set(channel, (channelMap.get(channel) || 0) + sales);
      });

      const channelBreakdown = Array.from(channelMap.entries()).map(([channel, value]) => ({
        channel: channel === 'dinein' ? 'Dine-in' : channel === 'takeaway' ? 'Pick-up' : channel === 'delivery' ? 'Delivery' : channel,
        value,
        percentage: totalSales > 0 ? Math.round((value / totalSales) * 100) : 0
      }));

      // ACS by channel (use covers, not orders)
      const channelCoversMap = new Map<string, number>();
      tickets.forEach(t => {
        const channel = t.channel || 'unknown';
        channelCoversMap.set(channel, (channelCoversMap.get(channel) || 0) + (t.covers || 1));
      });

      const acsBreakdown = Array.from(channelMap.entries()).map(([channel, value]) => ({
        channel: channel === 'dinein' ? 'Dine-in' : channel === 'takeaway' ? 'Pick-up' : channel === 'delivery' ? 'Delivery' : channel,
        value: (channelCoversMap.get(channel) || 1) > 0 ? value / (channelCoversMap.get(channel) || 1) : 0
      }));

      // Calculate forecast ACS based on expected orders per forecast sales
      const forecastAvgCheckSize = totalForecast > 0 && totalCovers > 0 
        ? (totalForecast / (totalCovers * (totalForecast / totalSales || 1)))
        : avgCheckSize * 0.95;

      // Calculate ACS delta vs forecast
      const avgCheckSizeDelta = forecastAvgCheckSize > 0 
        ? ((avgCheckSize - forecastAvgCheckSize) / forecastAvgCheckSize) * 100 
        : 0;

      // Build chart data
      const chartData: ChartDataPoint[] = [];
      if (isSingleDay) {
        const hours = eachHourOfInterval({ 
          start: startOfDay(dateRange.from), 
          end: endOfDay(dateRange.from) 
        }).filter(h => h.getHours() >= 10 && h.getHours() <= 21);

        hours.forEach(hour => {
          const hourNum = hour.getHours();
          const hourTickets = tickets.filter(t => {
            const closedAt = new Date(t.closed_at!);
            return closedAt.getHours() === hourNum;
          });
          const hourSales = hourTickets.reduce((sum, t) => sum + (t.net_total || t.gross_total || 0), 0);
          const hourCovers = hourTickets.reduce((sum, t) => sum + (t.covers || 1), 0);
          // Get daily forecast for this date and distribute by hourly weight
          const dayStr = format(dateRange.from, 'yyyy-MM-dd');
          const dailyForecastTotal = (dailyForecasts || [])
            .filter(f => f.date === dayStr)
            .reduce((sum, f) => sum + (f.forecast_sales || 0), 0);
          const hourForecast = getHourlyForecast(dailyForecastTotal, hourNum);

          const hourOrders = hourTickets.length;
          chartData.push({
            label: format(hour, 'HH:mm'),
            actual: hourSales,
            forecast: hourForecast,
            avgCheckSize: hourCovers > 0 ? hourSales / hourCovers : avgCheckSize,
            avgCheckForecast: forecastAvgCheckSize,
            orders: hourOrders,
            forecastOrders: Math.round(hourOrders * (totalForecast / totalSales || 0.95))
          });
        });
      } else {
        const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
        days.forEach(day => {
          const dayStr = format(day, 'yyyy-MM-dd');
          const dayTickets = tickets.filter(t => {
            const closedAt = new Date(t.closed_at!);
            return format(closedAt, 'yyyy-MM-dd') === dayStr;
          });
          const daySales = dayTickets.reduce((sum, t) => sum + (t.net_total || t.gross_total || 0), 0);
          const dayCovers = dayTickets.reduce((sum, t) => sum + (t.covers || 1), 0);
          const dayForecast = (dailyForecasts || [])
            .filter(f => f.date === dayStr)
            .reduce((sum, f) => sum + (f.forecast_sales || 0), 0);

          const dayOrders = dayTickets.length;
          chartData.push({
            label: format(day, 'EEE, dd'),
            actual: daySales,
            forecast: dayForecast,
            avgCheckSize: dayCovers > 0 ? daySales / dayCovers : (dayForecast > 0 ? forecastAvgCheckSize : 0),
            avgCheckForecast: forecastAvgCheckSize,
            orders: dayOrders,
            forecastOrders: Math.round(dayOrders * (totalForecast / totalSales || 0.95))
          });
        });
      }

      // Build channels table data - CORRECTED: use covers for ACS, not orders
      const channelsData: ChannelData[] = ['dinein', 'takeaway', 'delivery'].map(ch => {
        const channelTickets = tickets.filter(t => t.channel === ch);
        const sales = channelTickets.reduce((sum, t) => sum + (t.net_total || t.gross_total || 0), 0);
        const orders = channelTickets.length;
        const channelCovers = channelTickets.reduce((sum, t) => sum + (t.covers || 1), 0);
        const acs = channelCovers > 0 ? sales / channelCovers : 0; // Fixed: divide by covers, not orders
        const projectedSales = totalForecast * (sales / totalSales || 0.33);
        
        return {
          channel: ch === 'dinein' ? 'Dine in' : ch === 'takeaway' ? 'Pick-up' : 'Delivery',
          sales,
          salesDelta: projectedSales > 0 ? ((sales - projectedSales) / projectedSales) * 100 : 0,
          projectedSales,
          projectedSalesDelta: 0,
          acs,
          acsDelta: 0,
          projectedAcs: acs * 0.95,
          projectedAcsDelta: 0,
          orders
        };
      });

      // Categories
      const categoryMap = new Map<string, number>();
      ticketLines.forEach(line => {
        const cat = line.category_name || 'Other';
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + (line.gross_line_total || 0));
      });
      const totalCategorySales = Array.from(categoryMap.values()).reduce((a, b) => a + b, 0);
      const categories: CategoryData[] = Array.from(categoryMap.entries())
        .map(([category, amount]) => ({
          category,
          amount,
          ratio: totalCategorySales > 0 ? Math.round((amount / totalCategorySales) * 100) : 0
        }))
        .sort((a, b) => b.amount - a.amount);

      // Products
      const productMap = new Map<string, number>();
      ticketLines.forEach(line => {
        productMap.set(line.item_name, (productMap.get(line.item_name) || 0) + (line.gross_line_total || 0));
      });
      const products: ProductData[] = Array.from(productMap.entries())
        .map(([name, value]) => ({
          name,
          value,
          percentage: totalCategorySales > 0 ? (value / totalCategorySales) * 100 : 0
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      // Locations
      const locationSalesData: LocationSalesData[] = locations.map(loc => {
        const locTickets = tickets.filter(t => t.location_id === loc.id);
        const locSales = locTickets.reduce((sum, t) => sum + (t.net_total || t.gross_total || 0), 0);
        const locCovers = locTickets.reduce((sum, t) => sum + (t.covers || 1), 0);
        const locForecast = (dailyForecasts || [])
          .filter(f => f.location_id === loc.id)
          .reduce((sum, f) => sum + (f.forecast_sales || 0), 0);

        const dineInSales = locTickets.filter(t => t.channel === 'dinein')
          .reduce((sum, t) => sum + (t.net_total || t.gross_total || 0), 0);
        const deliverySales = locTickets.filter(t => t.channel === 'delivery')
          .reduce((sum, t) => sum + (t.net_total || t.gross_total || 0), 0);
        const pickUpSales = locTickets.filter(t => t.channel === 'takeaway')
          .reduce((sum, t) => sum + (t.net_total || t.gross_total || 0), 0);

        const locDineInTickets = locTickets.filter(t => 
          t.channel === 'dinein' && t.opened_at && t.closed_at
        );
        let locDwellTime: number | null = null;
        if (locDineInTickets.length > 0) {
          const totalDwell = locDineInTickets.reduce((sum, t) => {
            const opened = new Date(t.opened_at!);
            const closed = new Date(t.closed_at!);
            return sum + (closed.getTime() - opened.getTime()) / 60000;
          }, 0);
          locDwellTime = Math.round(totalDwell / locDineInTickets.length);
        }

        return {
          id: loc.id,
          name: loc.name,
          salesActual: locSales,
          salesForecast: locForecast,
          dineIn: dineInSales,
          dineInDelta: 0,
          delivery: deliverySales,
          deliveryDelta: 0,
          pickUp: pickUpSales,
          pickUpDelta: 0,
          orders: locTickets.length,
          acs: locCovers > 0 ? locSales / locCovers : 0,
          dwellTime: locDwellTime
        };
      });

      // Calculate forecast accuracy (based on MAPE)
      const dataWithBoth = chartData.filter(d => d.actual > 0 && d.forecast > 0);
      let forecastAccuracy = 0;
      if (dataWithBoth.length > 0) {
        const mape = dataWithBoth.reduce((sum, d) => {
          return sum + Math.abs((d.actual - d.forecast) / d.forecast);
        }, 0) / dataWithBoth.length;
        forecastAccuracy = Math.max(0, Math.min(100, Math.round((1 - mape) * 100)));
      }

      // Generate sparklines from chart data
      const salesSparkline = chartData.slice(-7).map(d => d.actual);
      const ordersSparkline = chartData.slice(-7).map(d => d.orders || 0);
      const acsSparkline = chartData.slice(-7).map(d => d.avgCheckSize);

      // Calculate orders delta
      const totalOrdersForecast = chartData.reduce((sum, d) => sum + (d.forecastOrders || 0), 0);
      const totalOrdersDelta = totalOrdersForecast > 0 
        ? ((totalOrders - totalOrdersForecast) / totalOrdersForecast) * 100 
        : 0;

      return {
        isEmpty: false,
        dataSource: 'pos',
        kpis: {
          salesToDate: totalSales,
          salesToDateDelta,
          avgCheckSize,
          avgCheckSizeDelta,
          totalOrders,
          totalOrdersDelta,
          forecastAccuracy,
          dwellTime,
          dwellTimeDelta: -3.2, // Placeholder for now
          channelBreakdown,
          acsBreakdown,
          salesSparkline,
          ordersSparkline,
          acsSparkline
        },
        chartData,
        channels: channelsData,
        categories,
        products,
        locations: locationSalesData
      };
    },
    staleTime: 60000, // Cache for 1 minute
    gcTime: 300000 // Keep in memory for 5 minutes
  });

  return {
    ...query,
    isConnected,
    lastUpdate
  };
}
