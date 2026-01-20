import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { format, eachDayOfInterval, eachHourOfInterval, startOfDay, endOfDay, differenceInDays, isSameDay } from 'date-fns';

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
  forecastLive: number;
  forecast: number;
  avgCheckSize: number;
  avgCheckForecast: number;
}

export interface BISalesData {
  kpis: {
    salesToDate: number;
    salesToDateDelta: number;
    avgCheckSize: number;
    avgCheckSizeDelta: number;
    dwellTime: number | null;
    dwellTimeDelta: number | null;
    channelBreakdown: { channel: string; value: number; percentage: number }[];
    acsBreakdown: { channel: string; value: number }[];
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

// Generate demo data for when there's no real data
function generateDemoData(dateRange: BIDateRange, isSingleDay: boolean): BISalesData {
  const days = isSingleDay 
    ? eachHourOfInterval({ start: startOfDay(dateRange.from), end: endOfDay(dateRange.from) }).filter(h => h.getHours() >= 10 && h.getHours() <= 21)
    : eachDayOfInterval({ start: dateRange.from, end: dateRange.to });

  const chartData: ChartDataPoint[] = days.map((d, i) => {
    const base = 2000 + Math.random() * 3000;
    const forecastBase = base * (0.9 + Math.random() * 0.2);
    return {
      label: isSingleDay ? format(d, 'HH:mm') : format(d, 'EEE, dd'),
      actual: Math.round(base),
      forecastLive: Math.round(forecastBase * 1.05),
      forecast: Math.round(forecastBase),
      avgCheckSize: 18 + Math.random() * 8,
      avgCheckForecast: 20 + Math.random() * 5
    };
  });

  const totalSales = chartData.reduce((sum, d) => sum + d.actual, 0);
  const totalForecast = chartData.reduce((sum, d) => sum + d.forecast, 0);
  const avgAcs = chartData.reduce((sum, d) => sum + d.avgCheckSize, 0) / chartData.length;

  return {
    kpis: {
      salesToDate: totalSales,
      salesToDateDelta: ((totalSales - totalForecast) / totalForecast) * 100,
      avgCheckSize: avgAcs,
      avgCheckSizeDelta: 2.5,
      dwellTime: 42,
      dwellTimeDelta: -3.2,
      channelBreakdown: [
        { channel: 'Dine-in', value: totalSales * 0.55, percentage: 55 },
        { channel: 'Pick-up', value: totalSales * 0.25, percentage: 25 },
        { channel: 'Delivery', value: totalSales * 0.20, percentage: 20 }
      ],
      acsBreakdown: [
        { channel: 'Dine-in', value: avgAcs * 1.1 },
        { channel: 'Pick-up', value: avgAcs * 0.85 },
        { channel: 'Delivery', value: avgAcs * 0.95 }
      ]
    },
    chartData,
    channels: [
      { channel: 'Dine in', sales: totalSales * 0.55, salesDelta: 1.2, projectedSales: totalForecast * 0.55, projectedSalesDelta: 0.8, acs: avgAcs * 1.1, acsDelta: 2.1, projectedAcs: avgAcs * 1.05, projectedAcsDelta: 1.5, orders: 450 },
      { channel: 'Pick-up', sales: totalSales * 0.25, salesDelta: -0.5, projectedSales: totalForecast * 0.25, projectedSalesDelta: 0.3, acs: avgAcs * 0.85, acsDelta: -1.2, projectedAcs: avgAcs * 0.88, projectedAcsDelta: -0.8, orders: 280 },
      { channel: 'Delivery', sales: totalSales * 0.20, salesDelta: 3.5, projectedSales: totalForecast * 0.20, projectedSalesDelta: 2.1, acs: avgAcs * 0.95, acsDelta: 0.8, projectedAcs: avgAcs * 0.92, projectedAcsDelta: 0.5, orders: 190 }
    ],
    categories: [
      { category: 'Food', amount: totalSales * 0.65, ratio: 65 },
      { category: 'Beverage', amount: totalSales * 0.28, ratio: 28 },
      { category: 'Other', amount: totalSales * 0.07, ratio: 7 }
    ],
    products: [
      { name: 'Hamburguesa Clásica', value: totalSales * 0.12, percentage: 12 },
      { name: 'Pizza Margarita', value: totalSales * 0.10, percentage: 10 },
      { name: 'Ensalada César', value: totalSales * 0.08, percentage: 8 },
      { name: 'Pollo a la Plancha', value: totalSales * 0.07, percentage: 7 },
      { name: 'Pasta Carbonara', value: totalSales * 0.065, percentage: 6.5 },
      { name: 'Cerveza Artesanal', value: totalSales * 0.06, percentage: 6 },
      { name: 'Vino de la Casa', value: totalSales * 0.055, percentage: 5.5 },
      { name: 'Postre del Día', value: totalSales * 0.05, percentage: 5 }
    ],
    locations: [
      { id: '1', name: 'Centro Madrid', salesActual: totalSales * 0.35, salesForecast: totalForecast * 0.35, dineIn: 4500, dineInDelta: 2.1, delivery: 1800, deliveryDelta: 5.2, pickUp: 1200, pickUpDelta: -1.3, orders: 320, acs: avgAcs * 1.05, dwellTime: 38 },
      { id: '2', name: 'Salamanca', salesActual: totalSales * 0.28, salesForecast: totalForecast * 0.28, dineIn: 3800, dineInDelta: 1.5, delivery: 1500, deliveryDelta: 3.8, pickUp: 980, pickUpDelta: 0.5, orders: 280, acs: avgAcs * 1.12, dwellTime: 45 },
      { id: '3', name: 'Chamberí', salesActual: totalSales * 0.22, salesForecast: totalForecast * 0.22, dineIn: 2900, dineInDelta: -0.8, delivery: 1100, deliveryDelta: 2.1, pickUp: 750, pickUpDelta: 1.8, orders: 210, acs: avgAcs * 0.98, dwellTime: 40 },
      { id: '4', name: 'Malasaña', salesActual: totalSales * 0.15, salesForecast: totalForecast * 0.15, dineIn: 2100, dineInDelta: 4.2, delivery: 850, deliveryDelta: 8.5, pickUp: 520, pickUpDelta: 3.2, orders: 150, acs: avgAcs * 0.92, dwellTime: null }
    ]
  };
}

export function useBISalesData({ dateRange, granularity, compareMode, locationIds }: UseBISalesDataParams) {
  const { locations } = useApp();
  const effectiveLocationIds = locationIds.length > 0 ? locationIds : locations.map(l => l.id);
  
  const isSingleDay = isSameDay(dateRange.from, dateRange.to) || differenceInDays(dateRange.to, dateRange.from) === 0;

  return useQuery({
    queryKey: ['bi-sales', dateRange, granularity, compareMode, effectiveLocationIds],
    queryFn: async (): Promise<BISalesData> => {
      if (effectiveLocationIds.length === 0) {
        return generateDemoData(dateRange, isSingleDay);
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
          status
        `)
        .in('location_id', effectiveLocationIds)
        .gte('closed_at', dateRange.from.toISOString())
        .lte('closed_at', dateRange.to.toISOString())
        .eq('status', 'closed');

      // Fetch ticket lines for categories and products
      const ticketIds = tickets?.map(t => t.id) || [];
      let ticketLines: any[] = [];
      if (ticketIds.length > 0) {
        const { data: lines } = await supabase
          .from('ticket_lines')
          .select('ticket_id, item_name, category_name, gross_line_total, quantity')
          .in('ticket_id', ticketIds);
        ticketLines = lines || [];
      }

      // Fetch forecasts
      const { data: forecasts } = await supabase
        .from('forecasts')
        .select('location_id, forecast_date, hour, forecast_sales')
        .in('location_id', effectiveLocationIds)
        .gte('forecast_date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('forecast_date', format(dateRange.to, 'yyyy-MM-dd'));

      // If no data, return demo data
      if (!tickets || tickets.length === 0) {
        return generateDemoData(dateRange, isSingleDay);
      }

      // Calculate KPIs
      const totalSales = tickets.reduce((sum, t) => sum + (t.net_total || t.gross_total || 0), 0);
      const totalOrders = tickets.length;
      const avgCheckSize = totalOrders > 0 ? totalSales / totalOrders : 0;
      const totalForecast = (forecasts || []).reduce((sum, f) => sum + (f.forecast_sales || 0), 0);
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

      // ACS by channel
      const channelOrdersMap = new Map<string, number>();
      tickets.forEach(t => {
        const channel = t.channel || 'unknown';
        channelOrdersMap.set(channel, (channelOrdersMap.get(channel) || 0) + 1);
      });

      const acsBreakdown = Array.from(channelMap.entries()).map(([channel, value]) => ({
        channel: channel === 'dinein' ? 'Dine-in' : channel === 'takeaway' ? 'Pick-up' : channel === 'delivery' ? 'Delivery' : channel,
        value: (channelOrdersMap.get(channel) || 1) > 0 ? value / (channelOrdersMap.get(channel) || 1) : 0
      }));

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
          const hourOrders = hourTickets.length;
          const hourForecast = (forecasts || [])
            .filter(f => f.hour === hourNum)
            .reduce((sum, f) => sum + (f.forecast_sales || 0), 0);

          chartData.push({
            label: format(hour, 'HH:mm'),
            actual: hourSales,
            forecastLive: hourForecast * 1.05,
            forecast: hourForecast,
            avgCheckSize: hourOrders > 0 ? hourSales / hourOrders : 0,
            avgCheckForecast: 22
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
          const dayOrders = dayTickets.length;
          const dayForecast = (forecasts || [])
            .filter(f => f.forecast_date === dayStr)
            .reduce((sum, f) => sum + (f.forecast_sales || 0), 0);

          chartData.push({
            label: format(day, 'EEE, dd'),
            actual: daySales,
            forecastLive: dayForecast * 1.05,
            forecast: dayForecast,
            avgCheckSize: dayOrders > 0 ? daySales / dayOrders : 0,
            avgCheckForecast: 22
          });
        });
      }

      // Build channels table data
      const channelsData: ChannelData[] = ['dinein', 'takeaway', 'delivery'].map(ch => {
        const channelTickets = tickets.filter(t => t.channel === ch);
        const sales = channelTickets.reduce((sum, t) => sum + (t.net_total || t.gross_total || 0), 0);
        const orders = channelTickets.length;
        const acs = orders > 0 ? sales / orders : 0;
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
        const locOrders = locTickets.length;
        const locForecast = (forecasts || [])
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
          orders: locOrders,
          acs: locOrders > 0 ? locSales / locOrders : 0,
          dwellTime: locDwellTime
        };
      });

      return {
        kpis: {
          salesToDate: totalSales,
          salesToDateDelta,
          avgCheckSize,
          avgCheckSizeDelta: 2.5, // Placeholder
          dwellTime,
          dwellTimeDelta: -3.2, // Placeholder
          channelBreakdown,
          acsBreakdown
        },
        chartData,
        channels: channelsData,
        categories,
        products,
        locations: locationSalesData
      };
    },
    staleTime: 30000
  });
}
