import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { buildQueryContext, getSalesTimeseriesRpc, getTopProductsRpc } from '@/data';
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
  const validLocationIds = locationIds.filter(id => id != null);
  const effectiveLocationIds = validLocationIds.length > 0 ? validLocationIds : locations.map(l => l.id);
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

      // Call both unified RPCs in parallel via data layer
      const ctx = buildQueryContext(orgId, effectiveLocationIds, 'pos');
      const range = { from: fromStr, to: toStr };

      const [ts, tp] = await Promise.all([
        getSalesTimeseriesRpc(ctx, range),
        getTopProductsRpc(ctx, range, 20),
      ]);

      if (!ts || !ts.kpis) return emptyData();

      // ── Hourly → daily fallback ──────────────────────────────
      // When pos_daily_finance has no data for the resolved data_source
      // (common in demo mode), aggregate hourly (facts_sales_15m) into
      // daily buckets so the chart and KPIs still work.
      const hourlyRows = (ts.hourly || []) as Record<string, unknown>[];
      let dailyRows = (ts.daily || []) as Record<string, unknown>[];

      const rpcKpisEmpty =
        (Number(ts.kpis.actual_sales) || 0) === 0 &&
        (Number(ts.kpis.actual_orders) || 0) === 0;

      if (dailyRows.length === 0 && hourlyRows.length > 0) {
        // Aggregate hourly into daily buckets
        const buckets = new Map<string, { actual_sales: number; actual_orders: number; forecast_sales: number; forecast_orders: number }>();
        hourlyRows.forEach((h) => {
          const d = new Date(h.ts_hour as string);
          const dayKey = format(d, 'yyyy-MM-dd');
          const prev = buckets.get(dayKey) || { actual_sales: 0, actual_orders: 0, forecast_sales: 0, forecast_orders: 0 };
          prev.actual_sales += Number(h.actual_sales) || 0;
          prev.actual_orders += Number(h.actual_orders) || 0;
          prev.forecast_sales += Number(h.forecast_sales) || 0;
          prev.forecast_orders += Number(h.forecast_orders) || 0;
          buckets.set(dayKey, prev);
        });
        dailyRows = Array.from(buckets.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, v]) => ({ date, ...v }));
      }

      // ── KPIs from timeseries RPC (or re-computed from aggregated daily) ──
      let totalNetSales: number;
      let totalForecast: number;
      let totalOrders: number;
      let forecastOrders: number;

      if (rpcKpisEmpty && dailyRows.length > 0) {
        // RPC KPIs came back empty — compute from daily (which may have
        // been derived from hourly above)
        totalNetSales = dailyRows.reduce((s, d) => s + (Number(d.actual_sales) || 0), 0);
        totalForecast = dailyRows.reduce((s, d) => s + (Number(d.forecast_sales) || 0), 0);
        totalOrders   = dailyRows.reduce((s, d) => s + (Number(d.actual_orders) || 0), 0);
        forecastOrders = dailyRows.reduce((s, d) => s + (Number(d.forecast_orders) || 0), 0);
      } else {
        const kpis = ts.kpis;
        totalNetSales = Number(kpis.actual_sales) || 0;
        totalForecast = Number(kpis.forecast_sales) || 0;
        totalOrders = Number(kpis.actual_orders) || 0;
        forecastOrders = Number(kpis.forecast_orders) || 0;
      }

      const avgCheckSize = totalOrders > 0 ? totalNetSales / totalOrders : 0;
      const forecastAvgCheckSize = forecastOrders > 0
        ? totalForecast / forecastOrders
        : avgCheckSize * 0.95;

      const salesToDateDelta = totalForecast > 0
        ? ((totalNetSales - totalForecast) / totalForecast) * 100
        : 0;
      const avgCheckSizeDelta = forecastAvgCheckSize > 0
        ? ((avgCheckSize - forecastAvgCheckSize) / forecastAvgCheckSize) * 100
        : 0;

      // ── Channel breakdown — requires POS channel data (not available) ──
      const channelBreakdown: { channel: string; value: number; percentage: number }[] = [];
      const acsBreakdown: { channel: string; value: number }[] = [];

      // ── Chart data from hourly or daily arrays ───────────────
      const chartData: ChartDataPoint[] = [];

      if (isSingleDay && hourlyRows.length > 0) {
        hourlyRows
          .filter((h) => {
            const hour = new Date(h.ts_hour as string).getHours();
            return hour >= 10 && hour <= 21;
          })
          .forEach((h) => {
            const hour = new Date(h.ts_hour as string);
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
      } else if (dailyRows.length > 0) {
        dailyRows.forEach((d) => {
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

      // ── Channels table — requires POS channel tracking ─────
      const channelsData: ChannelData[] = [];

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
            dineIn: 0,
            dineInDelta: 0,
            delivery: 0,
            deliveryDelta: 0,
            pickUp: 0,
            pickUpDelta: 0,
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
