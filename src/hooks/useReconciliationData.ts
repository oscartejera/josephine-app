import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { format } from 'date-fns';
import { getDemoGenerator } from '@/lib/demoDataGenerator';
import type { DateRangeValue } from '@/components/bi/DateRangePickerNoryLike';

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

export function useReconciliationData(
  dateRange: DateRangeValue,
  selectedLocations: string[],
  stockStatus: 'counted' | 'uncounted' | 'all'
) {
  const { locations, loading: appLoading } = useApp();
  const [isLoading, setIsLoading] = useState(true);
  const [lines, setLines] = useState<ReconciliationLine[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Prevent duplicate fetches
  const fetchedRef = useRef<string>('');
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Create stable cache key
  const cacheKey = useMemo(() => {
    const fromStr = dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : '';
    const toStr = dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : '';
    const locsStr = selectedLocations.sort().join(',');
    return `${fromStr}-${toStr}-${locsStr}-${stockStatus}`;
  }, [dateRange.from, dateRange.to, selectedLocations, stockStatus]);

  const locationIds = useMemo(() => {
    if (selectedLocations.length === 0) {
      return locations.map(l => l.id);
    }
    return selectedLocations;
  }, [selectedLocations, locations]);

  const fetchData = useCallback(async () => {
    // Guard against duplicate fetches
    if (fetchedRef.current === cacheKey) {
      return;
    }

    // Guard: Need valid date range
    if (!dateRange.from || !dateRange.to) {
      return;
    }

    fetchedRef.current = cacheKey;
    setIsLoading(true);

    try {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      // Try fetching real data first
      let stockCountsQuery = supabase
        .from('stock_counts')
        .select(`
          id, location_id, status,
          stock_count_lines(
            id, inventory_item_id, opening_qty, deliveries_qty, 
            transfers_net_qty, closing_qty, used_qty, 
            sales_qty, variance_qty, batch_balance
          )
        `)
        .gte('start_date', fromDate)
        .lte('end_date', toDate);

      if (locationIds.length > 0 && locationIds.length < locations.length) {
        stockCountsQuery = stockCountsQuery.in('location_id', locationIds);
      }

      if (stockStatus !== 'all') {
        stockCountsQuery = stockCountsQuery.eq('status', stockStatus);
      }

      const { data: stockCounts } = await stockCountsQuery;

      // Fetch inventory items
      const { data: inventoryItems } = await supabase
        .from('inventory_items')
        .select('id, name, unit');

      const itemsMap = new Map((inventoryItems || []).map(item => [item.id, item]));

      // Aggregate lines
      const linesMap = new Map<string, ReconciliationLine>();

      (stockCounts || []).forEach((sc: any) => {
        (sc.stock_count_lines || []).forEach((line: any) => {
          const item = itemsMap.get(line.inventory_item_id);
          if (!item) return;

          const existing = linesMap.get(line.inventory_item_id);
          if (existing) {
            existing.openingQty += line.opening_qty || 0;
            existing.deliveriesQty += line.deliveries_qty || 0;
            existing.transfersNetQty += line.transfers_net_qty || 0;
            existing.closingQty += line.closing_qty || 0;
            existing.usedQty += line.used_qty || 0;
            existing.salesQty += line.sales_qty || 0;
            existing.varianceQty += line.variance_qty || 0;
            existing.batchBalance += line.batch_balance || 0;
          } else {
            linesMap.set(line.inventory_item_id, {
              id: line.id,
              itemId: line.inventory_item_id,
              itemName: item.name,
              unit: item.unit || 'kg',
              openingQty: line.opening_qty || 0,
              deliveriesQty: line.deliveries_qty || 0,
              transfersNetQty: line.transfers_net_qty || 0,
              closingQty: line.closing_qty || 0,
              usedQty: line.used_qty || 0,
              salesQty: line.sales_qty || 0,
              varianceQty: line.variance_qty || 0,
              batchBalance: line.batch_balance || 0
            });
          }
        });
      });

      if (isMountedRef.current) {
        const realLines = Array.from(linesMap.values());
        // No demo fallback - show empty state when no real stock count data
        setLines(realLines);
        setLastUpdated(realLines.length > 0 ? new Date() : null);
      }
    } catch (error) {
      console.error('Error fetching reconciliation data:', error);
      if (isMountedRef.current) {
        setLines([]);
        setLastUpdated(null);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [cacheKey, dateRange.from, dateRange.to, locationIds, locations.length, stockStatus]);

  // Trigger fetch when dependencies change
  useEffect(() => {
    // Don't fetch while app context is still loading
    if (appLoading) {
      return;
    }
    
    fetchData();
  }, [fetchData, appLoading]);

  // Calculate totals - memoized
  const totals = useMemo((): ReconciliationTotals => {
    if (lines.length === 0) return defaultTotals;
    
    return lines.reduce((acc, line) => ({
      openingQty: acc.openingQty + line.openingQty,
      deliveriesQty: acc.deliveriesQty + line.deliveriesQty,
      transfersNetQty: acc.transfersNetQty + line.transfersNetQty,
      closingQty: acc.closingQty + line.closingQty,
      usedQty: acc.usedQty + line.usedQty,
      salesQty: acc.salesQty + line.salesQty,
      varianceQty: acc.varianceQty + line.varianceQty,
      batchBalance: acc.batchBalance + line.batchBalance
    }), defaultTotals);
  }, [lines]);

  return {
    isLoading,
    lastUpdated,
    lines,
    totals
  };
}
