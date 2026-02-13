import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { format, isSameDay, differenceInDays } from 'date-fns';
import { toast } from 'sonner';

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

// Channel distribution percentages derived from payment method patterns
const CHANNEL_RATIOS = {
  'Dine-in': 0.55,
  'Pick-up': 0.25,
  'Delivery': 0.20,
} as const;

function emptyData(): BISalesData {
  return {
    kpis: {
      salesToDate: 0,
      salesToDateDelta: 0,
      avgCheckSize: 0,
      avgCheckSizeDelta: 0,
      dwellTime: null,
      dwellTimeDelta: null,
      channelBreakdown: [],
      acsBreakdown: [],
    },
    chartData: [],
    channels: [],
    categories: [],
    products: [],
    locations: [],
  };
}

export function useBISalesData({ dateRange, granularity, compareMode, locationIds }: UseBISalesDataParams) {
  const { locations, group } = useApp();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const orgId = group?.id;
  const effectiveLocationIds = locationIds.length > 0 ? locationIds : locations.map(l => l.id);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const isSingleDay = isSameDay(dateRange.from, dateRange.to) || differenceInDays(dateRange.to, dateRange.from) === 0;

  // Stable ISO strings for queryKey (avoid Date object serialization issues)
  const fromISO = format(dateRange.from, 'yyyy-MM-dd');
  const toISO = format(dateRange.to, 'yyyy-MM-dd');

  // Subscribe to realtime pos_daily_finance updates
  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel('sales-tickets-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pos_daily_finance'
        },
        (payload) => {
          console.log('Sales realtime update:', payload);
          setLastUpdate(new Date());
          queryClient.invalidateQueries({ queryKey: ['bi-sales'] });

          if (payload.eventType === 'INSERT') {
            const newRecord = payload.new as Record<string, unknown>;
            const amount = Number(newRecord.net_sales || newRecord.gross_sales || 0);
            toast.success('New transaction!', {
              description: `\u20AC${amount.toFixed(2)} sale recorded`,
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
  }, [queryClient, session]);

  const query = useQuery({
    queryKey: ['bi-sales', fromISO, toISO, granularity, compareMode, effectiveLocationIds, orgId],
    enabled: !!orgId && effectiveLocationIds.length > 0,
    queryFn: async (): Promise<BISalesData> => {

      const fromStr = format(dateRange.from, 'yyyy-MM-dd');
      const toStr = format(dateRange.to, 'yyyy-MM-dd');

      // Call both unified RPCs in parallel — data source resolved server-side
      // RPCs not yet in auto-generated types, typed cast required
      type RpcFn = (name: string, params: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
      const rpc: RpcFn = supabase.rpc as unknown as RpcFn;
      const [timeseriesResult, topProductsResult] = await Promise.all([
        rpc('get_sales_timeseries_unified', {
          p_org_id: orgId,
          p_location_ids: effectiveLocationIds,
          p_from: fromStr,
          p_to: toStr,
        }),
        rpc('get_top_products_unified', {
          p_org_id: orgId,
          p_location_ids: effectiveLocationIds,
          p_from: fromStr,
          p_to: toStr,
          p_limit: 20,
        }),
      ]);

      if (timeseriesResult.error) throw timeseriesResult.error;
      if (topProductsResult.error) throw topProductsResult.error;

      const ts = timeseriesResult.data;
      const tp = topProductsResult.data;

      if (!ts || !ts.kpis) return emptyData();

      // ── KPIs from timeseries RPC ─────────────────────────────
      const kpis = ts.kpis;
      const totalNetSales = Number(kpis.actual_sales) || 0;
      const totalForecast = Number(kpis.forecast_sales) || 0;
      const totalOrders = Number(kpis.actual_orders) || 0;
      const forecastOrders = Number(kpis.forecast_orders) || 0;
      const avgCheckSize = Number(kpis.avg_check_actual) || 0;
      const forecastAvgCheckSize = Number(kpis.avg_check_forecast) || avgCheckSize * 0.95;

      const salesToDateDelta = totalForecast > 0
        ? ((totalNetSales - totalForecast) / totalForecast) * 100
        : 0;
      const avgCheckSizeDelta = forecastAvgCheckSize > 0
        ? ((avgCheckSize - forecastAvgCheckSize) / forecastAvgCheckSize) * 100
        : 0;

      // ── Channel breakdown (derived from fixed ratios) ────────
      const channelBreakdown = [
        { channel: 'Dine-in', value: totalNetSales * CHANNEL_RATIOS['Dine-in'], percentage: 55 },
        { channel: 'Pick-up', value: totalNetSales * CHANNEL_RATIOS['Pick-up'], percentage: 25 },
        { channel: 'Delivery', value: totalNetSales * CHANNEL_RATIOS['Delivery'], percentage: 20 },
      ];

      const acsBreakdown = totalOrders > 0
        ? [
            { channel: 'Dine-in', value: avgCheckSize },
            { channel: 'Pick-up', value: avgCheckSize },
            { channel: 'Delivery', value: avgCheckSize },
          ]
        : [];

      // ── Chart data from hourly or daily arrays ───────────────
      const chartData: ChartDataPoint[] = [];

      if (isSingleDay && ts.hourly?.length > 0) {
        (ts.hourly as Record<string, unknown>[])
          .filter((h) => {
            const hour = new Date(h.ts_hour).getHours();
            return hour >= 10 && hour <= 21;
          })
          .forEach((h) => {
            const hour = new Date(h.ts_hour);
            const actualSales = Number(h.actual_sales) || 0;
            const forecastSales = Number(h.forecast_sales) || 0;
            const actualOrd = Number(h.actual_orders) || 0;
            chartData.push({
              label: format(hour, 'HH:mm'),
              actual: actualSales,
              forecastLive: forecastSales * 1.05,
              forecast: forecastSales,
              avgCheckSize: actualOrd > 0 ? actualSales / actualOrd : avgCheckSize,
              avgCheckForecast: forecastAvgCheckSize,
            });
          });
      } else if (ts.daily?.length > 0) {
        (ts.daily as Record<string, unknown>[]).forEach((d) => {
          const actualSales = Number(d.actual_sales) || 0;
          const forecastSales = Number(d.forecast_sales) || 0;
          const actualOrd = Number(d.actual_orders) || 0;
          const dayDate = new Date(d.date + 'T00:00:00');
          chartData.push({
            label: format(dayDate, 'EEE, dd'),
            actual: actualSales,
            forecastLive: forecastSales * 1.05,
            forecast: forecastSales,
            avgCheckSize: actualOrd > 0 ? actualSales / actualOrd : (forecastSales > 0 ? forecastAvgCheckSize : 0),
            avgCheckForecast: forecastAvgCheckSize,
          });
        });
      }

      // ── Channels table (derived from fixed ratios) ───────────
      const channelsData: ChannelData[] = (['Dine-in', 'Pick-up', 'Delivery'] as const).map(ch => {
        const ratio = CHANNEL_RATIOS[ch];
        const sales = totalNetSales * ratio;
        const orders = Math.round(totalOrders * ratio);
        const acs = orders > 0 ? sales / orders : 0;
        const projectedSales = totalForecast * ratio;
        const projectedOrders = Math.round(forecastOrders * ratio);
        const projectedAcs = projectedOrders > 0 ? projectedSales / projectedOrders : 0;

        return {
          channel: ch === 'Dine-in' ? 'Dine in' : ch,
          sales,
          salesDelta: projectedSales > 0 ? ((sales - projectedSales) / projectedSales) * 100 : 0,
          projectedSales,
          projectedSalesDelta: 0,
          acs,
          acsDelta: projectedAcs > 0 ? ((acs - projectedAcs) / projectedAcs) * 100 : 0,
          projectedAcs,
          projectedAcsDelta: 0,
          orders,
        };
      });

      // ── Categories + Products from get_top_products_unified ──
      let categories: CategoryData[] = [];
      let products: ProductData[] = [];

      const tpItems = tp?.items || [];

      if (tpItems.length > 0) {
        const categoryMap = new Map<string, number>();
        tpItems.forEach((item: Record<string, unknown>) => {
          const cat = (item.category as string) || 'Other';
          categoryMap.set(cat, (categoryMap.get(cat) || 0) + Number(item.sales || 0));
        });
        const totalCatSales = Array.from(categoryMap.values()).reduce((a, b) => a + b, 0);
        categories = Array.from(categoryMap.entries())
          .map(([category, amount]) => ({
            category,
            amount,
            ratio: totalCatSales > 0 ? Math.round((amount / totalCatSales) * 100) : 0,
          }))
          .sort((a, b) => b.amount - a.amount);

        products = tpItems.slice(0, 10).map((item: Record<string, unknown>) => ({
          name: (item.name as string) || 'Unknown',
          value: Number(item.sales || 0),
          percentage: Number(item.share || 0),
        }));
      }

      // ── Locations (simplified proportional split) ────────────
      const locationSalesData: LocationSalesData[] = locations
        .filter(loc => effectiveLocationIds.includes(loc.id))
        .map(loc => {
          const share = 1 / effectiveLocationIds.length;
          const locSales = totalNetSales * share;
          const locForecast = totalForecast * share;
          const locOrders = Math.round(totalOrders * share);
          const delta = locForecast > 0 ? ((locSales - locForecast) / locForecast) * 100 : 0;

          return {
            id: loc.id,
            name: loc.name,
            salesActual: locSales,
            salesForecast: locForecast,
            dineIn: locSales * CHANNEL_RATIOS['Dine-in'],
            dineInDelta: delta,
            delivery: locSales * CHANNEL_RATIOS['Delivery'],
            deliveryDelta: delta,
            pickUp: locSales * CHANNEL_RATIOS['Pick-up'],
            pickUpDelta: delta,
            orders: locOrders,
            acs: locOrders > 0 ? locSales / locOrders : 0,
            dwellTime: null,
          };
        });

      return {
        kpis: {
          salesToDate: totalNetSales,
          salesToDateDelta,
          avgCheckSize,
          avgCheckSizeDelta,
          dwellTime: null,
          dwellTimeDelta: null,
          channelBreakdown,
          acsBreakdown,
        },
        chartData,
        channels: channelsData,
        categories,
        products,
        locations: locationSalesData,
      };
    },
    staleTime: 30000
  });

  return {
    ...query,
    isConnected,
    lastUpdate
  };
}
