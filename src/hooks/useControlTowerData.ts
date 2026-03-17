/**
 * useControlTowerData - Fetches real-time KPIs for the Insights landing page.
 * Reuses getSalesTimeseriesRpc + getTopProductsRpc from data layer.
 */
import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { buildQueryContext, getSalesTimeseriesRpc, getTopProductsRpc } from '@/data';
import { format, subDays, startOfMonth } from 'date-fns';

export interface ControlTowerKPIs {
  salesToday: number;
  salesYesterday: number;
  salesDeltaPct: number;
  salesMTD: number;
  ordersToday: number;
  avgCheck: number;
  topProductName: string | null;
  topProductSales: number;
  activeModules: number;
}

const emptyKPIs: ControlTowerKPIs = {
  salesToday: 0,
  salesYesterday: 0,
  salesDeltaPct: 0,
  salesMTD: 0,
  ordersToday: 0,
  avgCheck: 0,
  topProductName: null,
  topProductSales: 0,
  activeModules: 8,
};

export function useControlTowerData() {
  const { locations, group, dataSource } = useApp();
  const { session } = useAuth();
  const orgId = group?.id;
  const locationIds = locations.map(l => l.id);

  return useQuery({
    queryKey: ['control-tower', orgId, locationIds],
    enabled: !!orgId && locationIds.length > 0 && !!session,
    staleTime: 60000,
    queryFn: async (): Promise<ControlTowerKPIs> => {
      const ctx = buildQueryContext(orgId, locationIds, dataSource);
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd');
      const mtdStartStr = format(startOfMonth(today), 'yyyy-MM-dd');

      // Fire today + yesterday + MTD + top products in parallel
      const [todayRes, yesterdayRes, mtdRes, topRes] = await Promise.all([
        getSalesTimeseriesRpc(ctx, { from: todayStr, to: todayStr }),
        getSalesTimeseriesRpc(ctx, { from: yesterdayStr, to: yesterdayStr }),
        getSalesTimeseriesRpc(ctx, { from: mtdStartStr, to: todayStr }),
        getTopProductsRpc(ctx, { from: mtdStartStr, to: todayStr }, 1),
      ]);

      const salesToday = Number(todayRes?.kpis?.actual_sales) || 0;
      const salesYesterday = Number(yesterdayRes?.kpis?.actual_sales) || 0;
      const salesMTD = Number(mtdRes?.kpis?.actual_sales) || 0;
      const ordersToday = Number(todayRes?.kpis?.actual_orders) || 0;
      const avgCheck = Number(todayRes?.kpis?.avg_check_actual) || 0;
      const salesDeltaPct = salesYesterday > 0
        ? ((salesToday - salesYesterday) / salesYesterday) * 100
        : 0;

      const topItem = topRes?.items?.[0];

      return {
        salesToday,
        salesYesterday,
        salesDeltaPct,
        salesMTD,
        ordersToday,
        avgCheck,
        topProductName: topItem?.name || null,
        topProductSales: Number(topItem?.sales) || 0,
        activeModules: 8,
      };
    },
  });
}
