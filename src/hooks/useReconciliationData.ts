import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { buildQueryContext } from '@/data/client';
import { getReconciliationSummary, EMPTY_RECONCILIATION_SUMMARY } from '@/data/reconciliation';
import { format } from 'date-fns';
import type { DateRangeValue } from '@/components/bi/DateRangePickerNoryLike';
import type { ReconciliationLineRpc, ReconciliationTotalsRpc } from '@/data/reconciliation';

export interface ReconciliationLine {
  id: string;
  itemId: string;
  itemName: string;
  unit: string;
  openingQty: number;
  deliveriesQty: number;
  transfersNetQty: number;
  closingQty: number;
  usedQty: number;
  salesQty: number;
  varianceQty: number;
  batchBalance: number;
}

interface ReconciliationTotals {
  openingQty: number;
  deliveriesQty: number;
  transfersNetQty: number;
  closingQty: number;
  usedQty: number;
  salesQty: number;
  varianceQty: number;
  batchBalance: number;
}

const defaultTotals: ReconciliationTotals = {
  openingQty: 0,
  deliveriesQty: 0,
  transfersNetQty: 0,
  closingQty: 0,
  usedQty: 0,
  salesQty: 0,
  varianceQty: 0,
  batchBalance: 0
};

function mapRpcLine(line: ReconciliationLineRpc, idx: number): ReconciliationLine {
  return {
    id: `${line.inventory_item_id}-${idx}`,
    itemId: line.inventory_item_id,
    itemName: line.item_name,
    unit: line.unit || 'kg',
    openingQty: line.opening_qty || 0,
    deliveriesQty: line.deliveries_qty || 0,
    transfersNetQty: line.transfers_net_qty || 0,
    closingQty: line.closing_qty || 0,
    usedQty: line.used_qty || 0,
    salesQty: line.sales_qty || 0,
    varianceQty: line.variance_qty || 0,
    batchBalance: line.batch_balance || 0,
  };
}

function mapRpcTotals(totals: ReconciliationTotalsRpc): ReconciliationTotals {
  return {
    openingQty: totals.opening_qty || 0,
    deliveriesQty: totals.deliveries_qty || 0,
    transfersNetQty: totals.transfers_net_qty || 0,
    closingQty: totals.closing_qty || 0,
    usedQty: totals.used_qty || 0,
    salesQty: totals.sales_qty || 0,
    varianceQty: totals.variance_qty || 0,
    batchBalance: totals.batch_balance || 0,
  };
}

export function useReconciliationData(
  dateRange: DateRangeValue,
  selectedLocations: string[],
  stockStatus: 'counted' | 'uncounted' | 'all'
) {
  const { profile } = useAuth();
  const { locations, dataSource } = useApp();

  const orgId = profile?.group_id || null;

  const locationIds = useMemo(() => {
    if (selectedLocations.length === 0) {
      return locations.map(l => l.id);
    }
    return selectedLocations;
  }, [selectedLocations, locations]);

  const fromStr = dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : '';
  const toStr = dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : '';

  const ctx = useMemo(
    () => orgId ? buildQueryContext(orgId, locationIds, dataSource) : null,
    [orgId, locationIds, dataSource]
  );

  const statusParam = stockStatus === 'all' ? undefined : stockStatus;

  const { data, isLoading } = useQuery({
    queryKey: ['reconciliation-summary', orgId, locationIds, fromStr, toStr, stockStatus],
    queryFn: () =>
      getReconciliationSummary(
        ctx!,
        { from: fromStr, to: toStr },
        statusParam
      ),
    enabled: !!ctx && !!fromStr && !!toStr && locationIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const lines = useMemo(
    () => (data?.lines || []).map(mapRpcLine),
    [data?.lines]
  );

  const totals = useMemo(
    () => data?.totals ? mapRpcTotals(data.totals) : defaultTotals,
    [data?.totals]
  );

  const lastUpdated = data ? new Date() : null;

  return {
    isLoading,
    lastUpdated,
    lines,
    totals,
  };
}
