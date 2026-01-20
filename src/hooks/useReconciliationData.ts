import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { format } from 'date-fns';
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

export function useReconciliationData(
  dateRange: DateRangeValue,
  selectedLocations: string[],
  stockStatus: 'counted' | 'uncounted' | 'all'
) {
  const { locations, group } = useApp();
  const [isLoading, setIsLoading] = useState(true);
  const [lines, setLines] = useState<ReconciliationLine[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const locationIds = useMemo(() => {
    if (selectedLocations.length === 0) {
      return locations.map(l => l.id);
    }
    return selectedLocations;
  }, [selectedLocations, locations]);

  useEffect(() => {
    fetchData();
  }, [dateRange, locationIds, stockStatus]);

  const fetchData = async () => {
    setIsLoading(true);

    try {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      // Fetch stock counts for the period
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

      setLines(Array.from(linesMap.values()));
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching reconciliation data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate demo data if empty
  useEffect(() => {
    if (!isLoading && lines.length === 0) {
      const demoItems = [
        { name: 'Tomatoes', unit: 'kg' },
        { name: 'Chicken Breast', unit: 'kg' },
        { name: 'Olive Oil', unit: 'L' },
        { name: 'Pasta', unit: 'kg' },
        { name: 'Mozzarella', unit: 'kg' },
        { name: 'Beef Sirloin', unit: 'kg' },
        { name: 'White Wine', unit: 'L' },
        { name: 'Flour', unit: 'kg' },
        { name: 'Butter', unit: 'kg' },
        { name: 'Eggs', unit: 'units' }
      ];

      const demoLines: ReconciliationLine[] = demoItems.map((item, i) => {
        const openingQty = 20 + Math.random() * 30;
        const deliveriesQty = 10 + Math.random() * 20;
        const transfersNetQty = (Math.random() - 0.5) * 5;
        const salesQty = 15 + Math.random() * 25;
        const closingQty = openingQty + deliveriesQty + transfersNetQty - salesQty - Math.random() * 3;
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
  }, [isLoading, lines.length]);

  // Calculate totals
  const totals = useMemo(() => {
    return lines.reduce((acc, line) => ({
      openingQty: acc.openingQty + line.openingQty,
      deliveriesQty: acc.deliveriesQty + line.deliveriesQty,
      transfersNetQty: acc.transfersNetQty + line.transfersNetQty,
      closingQty: acc.closingQty + line.closingQty,
      usedQty: acc.usedQty + line.usedQty,
      salesQty: acc.salesQty + line.salesQty,
      varianceQty: acc.varianceQty + line.varianceQty,
      batchBalance: acc.batchBalance + line.batchBalance
    }), {
      openingQty: 0,
      deliveriesQty: 0,
      transfersNetQty: 0,
      closingQty: 0,
      usedQty: 0,
      salesQty: 0,
      varianceQty: 0,
      batchBalance: 0
    });
  }, [lines]);

  return {
    isLoading,
    lastUpdated,
    lines,
    totals
  };
}
