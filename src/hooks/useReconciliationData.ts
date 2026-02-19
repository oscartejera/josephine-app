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

  // Safety: if app finished loading but there are no locations, stop loading
  useEffect(() => {
    if (!appLoading && locations.length === 0) {
      setIsLoading(false);
    }
  }, [appLoading, locations.length]);

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
        
        // Use demo data if no real data found
        if (realLines.length === 0) {
          generateDemoLines();
        } else {
          setLines(realLines);
          setLastUpdated(new Date());
        }
      }
    } catch (error) {
      console.error('Error fetching reconciliation data:', error);
      if (isMountedRef.current) {
        generateDemoLines();
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [cacheKey, dateRange.from, dateRange.to, locationIds, locations.length, stockStatus]);

  // Generate demo data
  const generateDemoLines = useCallback(() => {
    try {
      const generator = getDemoGenerator(dateRange.from || new Date(), dateRange.to || new Date());
      
      // Get demo stock count data for the first selected location
      const locationId = selectedLocations.length > 0 ? selectedLocations[0] : 'loc-west-002';
      const stockData = generator.getStockCountData(locationId);
      
      if (stockData && stockData.length > 0) {
        const demoLines: ReconciliationLine[] = stockData.map((item, i) => ({
          id: `demo-${i}`,
          itemId: `item-${i}`,
          itemName: item.itemName,
          unit: item.unit,
          openingQty: item.openingQty,
          deliveriesQty: item.deliveriesQty,
          transfersNetQty: item.netTransferredQty,
          closingQty: item.closingQty,
          usedQty: item.usedQty,
          salesQty: item.salesQty,
          varianceQty: item.varianceQty,
          batchBalance: item.batchBalance
        }));
        setLines(demoLines);
      } else {
        // Fallback demo items
        const demoItems = [
          { name: 'Tender fillets (fresh)', unit: 'kg' },
          { name: 'Chicken breast', unit: 'kg' },
          { name: 'House sauce', unit: 'L' },
          { name: 'Plain flour', unit: 'kg' },
          { name: 'Spice mix original', unit: 'kg' },
          { name: 'Spice mix hot', unit: 'kg' },
          { name: 'Bread crumbs', unit: 'kg' },
          { name: 'Vegetable oil', unit: 'L' },
          { name: 'Lettuce iceberg', unit: 'kg' },
          { name: 'Tomatoes fresh', unit: 'kg' }
        ];

        const demoLines: ReconciliationLine[] = demoItems.map((item, i) => {
          const openingQty = 20 + Math.random() * 30;
          const deliveriesQty = 10 + Math.random() * 20;
          const transfersNetQty = (Math.random() - 0.5) * 5;
          const salesQty = 15 + Math.random() * 25;
          const closingQty = Math.max(0, openingQty + deliveriesQty + transfersNetQty - salesQty - Math.random() * 3);
          const usedQty = openingQty + deliveriesQty + transfersNetQty - closingQty;
          const varianceQty = usedQty - salesQty;
          const batchBalance = Math.random() * 2 - 1;

          return {
            id: `demo-${i}`,
            itemId: `item-${i}`,
            itemName: item.name,
            unit: item.unit,
            openingQty: Math.round(openingQty * 100) / 100,
            deliveriesQty: Math.round(deliveriesQty * 100) / 100,
            transfersNetQty: Math.round(transfersNetQty * 100) / 100,
            closingQty: Math.round(closingQty * 100) / 100,
            usedQty: Math.round(usedQty * 100) / 100,
            salesQty: Math.round(salesQty * 100) / 100,
            varianceQty: Math.round(varianceQty * 100) / 100,
            batchBalance: Math.round(batchBalance * 100) / 100
          };
        });

        setLines(demoLines);
      }
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error generating demo data:', error);
    }
  }, [dateRange.from, dateRange.to, selectedLocations]);

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
