// Migrated to sales_daily_unified contract view
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { toLegacyDataSource } from '@/data';
import { format, subDays, differenceInDays } from 'date-fns';
import type { DateRangeValue } from '@/components/bi/DateRangePickerNoryLike';

export interface CashManagementMetrics {
  netSales: number;
  grossSales: number;
  ordersCount: number;
  paymentsCash: number;
  paymentsCard: number;
  paymentsOther: number;
  refundsAmount: number;
  refundsCount: number;
  discountsAmount: number;
  compsAmount: number;
  voidsAmount: number;
  leakage: number;
  leakagePct: number;
  cashPct: number;
  cashExpected: number;
  cashCounted: number | null;
  cashVariance: number | null;
  // Deltas vs previous
  netSalesDelta: number;
  refundsDelta: number;
  leakageDelta: number;
  cashPctDelta: number;
}

export interface CashDailyData {
  date: string;
  discounts: number;
  comps: number;
  voids: number;
  refunds: number;
  leakage: number;
  leakagePct: number;
  netSales: number;
}

export interface CashLocationData {
  locationId: string;
  locationName: string;
  sales: number;
  salesPrevious: number;
  salesDelta: number;
  cashPct: number;
  cashPctPrevious: number;
  cashPctDelta: number;
  leakage: number;
  leakagePrevious: number;
  leakageDelta: number;
  leakagePct: number;
  leakagePctPrevious: number;
  leakagePctDeltaPp: number;
  refunds: number;
  discounts: number;
  voids: number;
  cashVariance: number | null;
}

const defaultMetrics: CashManagementMetrics = {
  netSales: 0,
  grossSales: 0,
  ordersCount: 0,
  paymentsCash: 0,
  paymentsCard: 0,
  paymentsOther: 0,
  refundsAmount: 0,
  refundsCount: 0,
  discountsAmount: 0,
  compsAmount: 0,
  voidsAmount: 0,
  leakage: 0,
  leakagePct: 0,
  cashPct: 0,
  cashExpected: 0,
  cashCounted: null,
  cashVariance: null,
  netSalesDelta: 0,
  refundsDelta: 0,
  leakageDelta: 0,
  cashPctDelta: 0,
};

export function useCashManagementData(
  dateRange: DateRangeValue,
  selectedLocations: string[]
) {
  const { locations, loading: appLoading, dataSource } = useApp();
  const dsLegacy = toLegacyDataSource(dataSource);
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState<CashManagementMetrics>(defaultMetrics);
  const [dailyData, setDailyData] = useState<CashDailyData[]>([]);
  const [locationData, setLocationData] = useState<CashLocationData[]>([]);
  const [hasData, setHasData] = useState(false);

  const effectiveLocationIds = useMemo(() => {
    if (selectedLocations.length > 0) return selectedLocations;
    return locations.map(l => l.id);
  }, [selectedLocations, locations]);

  // Safety: if app finished loading but there are no locations, stop loading
  useEffect(() => {
    if (!appLoading && locations.length === 0) {
      setIsLoading(false);
    }
  }, [appLoading, locations.length]);

  const fetchData = useCallback(async () => {
    if (!dateRange.from || !dateRange.to || appLoading) return;

    setIsLoading(true);

    try {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');
      const daysDiff = differenceInDays(dateRange.to, dateRange.from) + 1;

      // Previous period
      const prevFrom = format(subDays(dateRange.from, daysDiff), 'yyyy-MM-dd');
      const prevTo = format(subDays(dateRange.to, daysDiff), 'yyyy-MM-dd');

      // Fetch current period from unified view
      let query = supabase
        .from('sales_daily_unified' as any)
        .select('date, location_id, net_sales, gross_sales, orders_count, payments_cash, payments_card, payments_other, refunds_amount, refunds_count, discounts_amount, comps_amount, voids_amount')
        .eq('data_source', dsLegacy)
        .gte('date', fromDate)
        .lte('date', toDate);

      if (effectiveLocationIds.length > 0 && effectiveLocationIds.length < locations.length) {
        query = query.in('location_id', effectiveLocationIds);
      }

      const { data: currentData, error } = await query;

      if (error) {
        console.error('Error fetching cash management data:', error);
        setHasData(false);
        setIsLoading(false);
        return;
      }

      // Fetch previous period from unified view
      let prevQuery = supabase
        .from('sales_daily_unified' as any)
        .select('date, location_id, net_sales, gross_sales, orders_count, payments_cash, payments_card, payments_other, refunds_amount, refunds_count, discounts_amount, comps_amount, voids_amount')
        .eq('data_source', dsLegacy)
        .gte('date', prevFrom)
        .lte('date', prevTo);

      if (effectiveLocationIds.length > 0 && effectiveLocationIds.length < locations.length) {
        prevQuery = prevQuery.in('location_id', effectiveLocationIds);
      }

      const { data: previousData } = await prevQuery;

      // Fetch cash counts
      let cashQuery = supabase
        .from('cash_counts_daily')
        .select('*')
        .gte('date', fromDate)
        .lte('date', toDate);

      if (effectiveLocationIds.length > 0 && effectiveLocationIds.length < locations.length) {
        cashQuery = cashQuery.in('location_id', effectiveLocationIds);
      }

      const { data: cashCountsData } = await cashQuery;

      setHasData((currentData && currentData.length > 0) || false);

      if (!currentData || currentData.length === 0) {
        setMetrics(defaultMetrics);
        setDailyData([]);
        setLocationData([]);
        setIsLoading(false);
        return;
      }

      // Aggregate current period
      const current = aggregateFinanceData(currentData);
      const previous = aggregateFinanceData(previousData || []);
      const cashCounted = cashCountsData?.reduce((sum, c) => sum + (c.cash_counted || 0), 0) || null;

      // Calculate metrics
      const leakage = current.refunds + current.discounts + current.comps + current.voids;
      const leakagePct = current.netSales > 0 ? (leakage / current.netSales) * 100 : 0;
      const totalPayments = current.cash + current.card + current.other;
      const cashPct = totalPayments > 0 ? (current.cash / totalPayments) * 100 : 0;

      const prevLeakage = previous.refunds + previous.discounts + previous.comps + previous.voids;
      const prevTotalPayments = previous.cash + previous.card + previous.other;
      const prevCashPct = prevTotalPayments > 0 ? (previous.cash / prevTotalPayments) * 100 : 0;

      setMetrics({
        netSales: current.netSales,
        grossSales: current.grossSales,
        ordersCount: current.ordersCount,
        paymentsCash: current.cash,
        paymentsCard: current.card,
        paymentsOther: current.other,
        refundsAmount: current.refunds,
        refundsCount: current.refundsCount,
        discountsAmount: current.discounts,
        compsAmount: current.comps,
        voidsAmount: current.voids,
        leakage,
        leakagePct,
        cashPct,
        cashExpected: current.cash,
        cashCounted: cashCounted && cashCounted > 0 ? cashCounted : null,
        cashVariance: cashCounted && cashCounted > 0 ? cashCounted - current.cash : null,
        netSalesDelta: calcDelta(current.netSales, previous.netSales),
        refundsDelta: calcDelta(current.refunds, previous.refunds),
        leakageDelta: calcDelta(leakage, prevLeakage),
        cashPctDelta: cashPct - prevCashPct,
      });

      // Daily data for chart
      const dailyMap = new Map<string, CashDailyData>();
      currentData.forEach(row => {
        const existing = dailyMap.get(row.date) || {
          date: row.date,
          discounts: 0,
          comps: 0,
          voids: 0,
          refunds: 0,
          leakage: 0,
          leakagePct: 0,
          netSales: 0,
        };
        existing.discounts += row.discounts_amount || 0;
        existing.comps += row.comps_amount || 0;
        existing.voids += row.voids_amount || 0;
        existing.refunds += row.refunds_amount || 0;
        existing.netSales += row.net_sales || 0;
        existing.leakage = existing.discounts + existing.comps + existing.voids + existing.refunds;
        existing.leakagePct = existing.netSales > 0 ? (existing.leakage / existing.netSales) * 100 : 0;
        dailyMap.set(row.date, existing);
      });
      setDailyData(Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)));

      // Location data
      const locMap = new Map<string, any>();
      const prevLocMap = new Map<string, any>();

      currentData.forEach(row => {
        const existing = locMap.get(row.location_id) || { ...emptyLocAgg() };
        accumulateLocData(existing, row);
        locMap.set(row.location_id, existing);
      });

      (previousData || []).forEach(row => {
        const existing = prevLocMap.get(row.location_id) || { ...emptyLocAgg() };
        accumulateLocData(existing, row);
        prevLocMap.set(row.location_id, existing);
      });

      // Cash counts by location
      const cashByLoc = new Map<string, number>();
      (cashCountsData || []).forEach(c => {
        cashByLoc.set(c.location_id, (cashByLoc.get(c.location_id) || 0) + (c.cash_counted || 0));
      });

      const locDataArray: CashLocationData[] = [];
      locMap.forEach((data, locId) => {
        const loc = locations.find(l => l.id === locId);
        const prev = prevLocMap.get(locId) || emptyLocAgg();
        const leakageVal = data.refunds + data.discounts + data.comps + data.voids;
        const prevLeakageVal = prev.refunds + prev.discounts + prev.comps + prev.voids;
        const totalPay = data.cash + data.card + data.other;
        const prevTotalPay = prev.cash + prev.card + prev.other;
        const cashPctVal = totalPay > 0 ? (data.cash / totalPay) * 100 : 0;
        const prevCashPctVal = prevTotalPay > 0 ? (prev.cash / prevTotalPay) * 100 : 0;
        const leakagePctVal = data.netSales > 0 ? (leakageVal / data.netSales) * 100 : 0;
        const prevLeakagePctVal = prev.netSales > 0 ? (prevLeakageVal / prev.netSales) * 100 : 0;
        const cashCountedLoc = cashByLoc.get(locId);

        locDataArray.push({
          locationId: locId,
          locationName: loc?.name || 'Unknown',
          sales: data.netSales,
          salesPrevious: prev.netSales,
          salesDelta: calcDelta(data.netSales, prev.netSales),
          cashPct: cashPctVal,
          cashPctPrevious: prevCashPctVal,
          cashPctDelta: cashPctVal - prevCashPctVal,
          leakage: leakageVal,
          leakagePrevious: prevLeakageVal,
          leakageDelta: calcDelta(leakageVal, prevLeakageVal),
          leakagePct: leakagePctVal,
          leakagePctPrevious: prevLeakagePctVal,
          leakagePctDeltaPp: leakagePctVal - prevLeakagePctVal,
          refunds: data.refunds,
          discounts: data.discounts,
          voids: data.voids,
          cashVariance: cashCountedLoc ? cashCountedLoc - data.cash : null,
        });
      });

      setLocationData(locDataArray.sort((a, b) => b.leakagePct - a.leakagePct));
    } catch (err) {
      console.error('Error in useCashManagementData:', err);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, effectiveLocationIds, locations, appLoading, dataSource, dsLegacy]);

  useEffect(() => {
    if (!appLoading) {
      fetchData();
    }
  }, [fetchData, appLoading]);

  return { isLoading, metrics, dailyData, locationData, hasData, refetch: fetchData };
}

function aggregateFinanceData(data: any[]) {
  return data.reduce(
    (acc, row) => ({
      netSales: acc.netSales + (row.net_sales || 0),
      grossSales: acc.grossSales + (row.gross_sales || 0),
      ordersCount: acc.ordersCount + (row.orders_count || 0),
      cash: acc.cash + (row.payments_cash || 0),
      card: acc.card + (row.payments_card || 0),
      other: acc.other + (row.payments_other || 0),
      refunds: acc.refunds + (row.refunds_amount || 0),
      refundsCount: acc.refundsCount + (row.refunds_count || 0),
      discounts: acc.discounts + (row.discounts_amount || 0),
      comps: acc.comps + (row.comps_amount || 0),
      voids: acc.voids + (row.voids_amount || 0),
    }),
    {
      netSales: 0,
      grossSales: 0,
      ordersCount: 0,
      cash: 0,
      card: 0,
      other: 0,
      refunds: 0,
      refundsCount: 0,
      discounts: 0,
      comps: 0,
      voids: 0,
    }
  );
}

function emptyLocAgg() {
  return {
    netSales: 0,
    cash: 0,
    card: 0,
    other: 0,
    refunds: 0,
    discounts: 0,
    comps: 0,
    voids: 0,
  };
}

function accumulateLocData(acc: any, row: any) {
  acc.netSales += row.net_sales || 0;
  acc.cash += row.payments_cash || 0;
  acc.card += row.payments_card || 0;
  acc.other += row.payments_other || 0;
  acc.refunds += row.refunds_amount || 0;
  acc.discounts += row.discounts_amount || 0;
  acc.comps += row.comps_amount || 0;
  acc.voids += row.voids_amount || 0;
}

function calcDelta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}
