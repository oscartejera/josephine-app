/**
 * useWasteEndOfDay — End-of-Day Batch Waste Entry
 * Learns which products typically have waste at close,
 * pre-fills a batch form for 1-click logging of all leftover items.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { useWasteEntry } from '@/hooks/useWasteEntry';

// ── Types ──

export interface EODItem {
  id: string;
  name: string;
  unit: string;
  lastCost: number;
  category: string;
  avgWasteQty: number;      // historical average waste qty
  suggestedQty: number;     // pre-filled qty (can be 0)
  historicalCount: number;   // times this item appeared at EOD
}

export interface EODBatchEntry {
  itemId: string;
  quantity: number;
}

export interface EODResult {
  items: EODItem[];
  isLoading: boolean;
  submitBatch: (entries: EODBatchEntry[]) => Promise<number>;
  isSubmitting: boolean;
  lastBatchCount: number | null;
}

// ── Constants ──

const EOD_HISTORY_KEY = 'josephine_eod_history';

function getEODHistory(): Record<string, { count: number; totalQty: number }> {
  try {
    const stored = localStorage.getItem(EOD_HISTORY_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch { return {}; }
}

function updateEODHistory(itemId: string, qty: number) {
  const history = getEODHistory();
  const entry = history[itemId] || { count: 0, totalQty: 0 };
  entry.count += 1;
  entry.totalQty += qty;
  history[itemId] = entry;
  localStorage.setItem(EOD_HISTORY_KEY, JSON.stringify(history));
}

// ── Hook ──

export function useWasteEndOfDay(locationIdOverride?: string): EODResult {
  const { locations } = useApp();
  const { logWaste } = useWasteEntry();
  const [allItems, setAllItems] = useState<EODItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastBatchCount, setLastBatchCount] = useState<number | null>(null);

  const defaultLocationId = locationIdOverride || locations[0]?.id || '';

  // Load items + EOD history
  useEffect(() => {
    async function fetch() {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, name, unit, last_cost, category_name')
        .order('name');

      if (error || !data) {
        setAllItems([]);
        setIsLoading(false);
        return;
      }

      const eodHistory = getEODHistory();
      
      const items: EODItem[] = data.map(item => {
        const history = eodHistory[item.id];
        const avgQty = history ? history.totalQty / history.count : 0;
        const historicalCount = history?.count || 0;
        
        return {
          id: item.id,
          name: item.name || 'Sin nombre',
          unit: item.unit || 'ud',
          lastCost: item.last_cost || 0,
          category: item.category_name || 'Otros',
          avgWasteQty: avgQty,
          suggestedQty: historicalCount >= 3 ? Math.round(avgQty * 10) / 10 : 0,
          historicalCount,
        };
      });

      // Sort: items with EOD history first (by frequency), then alphabetic
      items.sort((a, b) => {
        if (a.historicalCount > 0 && b.historicalCount === 0) return -1;
        if (a.historicalCount === 0 && b.historicalCount > 0) return 1;
        return b.historicalCount - a.historicalCount || a.name.localeCompare(b.name);
      });

      setAllItems(items);
      setIsLoading(false);
    }
    fetch();
  }, []);

  // Submit batch
  const submitBatch = useCallback(async (entries: EODBatchEntry[]): Promise<number> => {
    if (!defaultLocationId) return 0;
    setIsSubmitting(true);
    let successCount = 0;

    try {
      for (const entry of entries) {
        if (entry.quantity <= 0) continue;
        try {
          await logWaste.mutateAsync({
            item_id: entry.itemId,
            location_id: defaultLocationId,
            reason: 'end_of_day',
            quantity: entry.quantity,
          });
          updateEODHistory(entry.itemId, entry.quantity);
          successCount++;
        } catch (err) {
          console.warn(`[EOD] Failed to log waste for item ${entry.itemId}:`, err);
        }
      }
      setLastBatchCount(successCount);
      setTimeout(() => setLastBatchCount(null), 5000);
      return successCount;
    } finally {
      setIsSubmitting(false);
    }
  }, [defaultLocationId, logWaste]);

  return {
    items: allItems,
    isLoading,
    submitBatch,
    isSubmitting,
    lastBatchCount,
  };
}
