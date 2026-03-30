/**
 * useWasteQuickLog — Optimized for mobile quick-entry
 * - Tracks frequent products (localStorage)
 * - Auto-suggests reason based on time of day
 * - Provides recent items for 2-tap logging
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { useWasteEntry } from '@/hooks/useWasteEntry';
import type { WasteReasonCode } from '@/hooks/useWasteEntry';

// ── Types ──

export interface QuickLogItem {
  id: string;
  name: string;
  unit: string;
  lastCost: number;
  category: string;
  frequency: number;       // how often this item is wasted
  isFrequent: boolean;
}

export interface QuickLogState {
  items: QuickLogItem[];
  frequentItems: QuickLogItem[];
  allItems: QuickLogItem[];
  suggestedReason: WasteReasonCode;
  suggestedReasonLabel: string;
  isLoadingItems: boolean;
  defaultLocationId: string;
  submitQuickLog: (itemId: string, quantity: number, reason?: WasteReasonCode) => Promise<void>;
  isSubmitting: boolean;
  lastLoggedItem: string | null;
}

// ── Constants ──

const FREQUENCY_STORAGE_KEY = 'josephine_waste_freq';

const TIME_BASED_REASONS: { hours: [number, number]; reason: WasteReasonCode; label: string }[] = [
  { hours: [6, 11],  reason: 'expiry',          label: 'Caducidad'       },
  { hours: [11, 16], reason: 'kitchen_error',    label: 'Error cocina'    },
  { hours: [16, 22], reason: 'plate_waste',      label: 'Resto de plato'  },
  { hours: [22, 6],  reason: 'end_of_day',       label: 'Fin de día'      },
];

function getAutoReason(): { reason: WasteReasonCode; label: string } {
  const hour = new Date().getHours();
  for (const { hours, reason, label } of TIME_BASED_REASONS) {
    if (hours[0] < hours[1]) {
      if (hour >= hours[0] && hour < hours[1]) return { reason, label };
    } else {
      // Wraps midnight
      if (hour >= hours[0] || hour < hours[1]) return { reason, label };
    }
  }
  return { reason: 'other', label: 'Otros' };
}

function getFrequencyMap(): Record<string, number> {
  try {
    const stored = localStorage.getItem(FREQUENCY_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch { return {}; }
}

function bumpFrequency(itemId: string) {
  const map = getFrequencyMap();
  map[itemId] = (map[itemId] || 0) + 1;
  localStorage.setItem(FREQUENCY_STORAGE_KEY, JSON.stringify(map));
}

/** Extract unit from item name like "Pollo (kg)" → { displayName: "Pollo", unit: "kg" } */
function parseNameUnit(name: string, dbUnit: string | null): { displayName: string; unit: string } {
  const match = name.match(/^(.+?)\s*\(([^)]+)\)$/);
  if (match) {
    return { displayName: match[1].trim(), unit: dbUnit || match[2].trim() };
  }
  return { displayName: name, unit: dbUnit || 'ud' };
}

// ── Hook ──

export function useWasteQuickLog(locationIdOverride?: string): QuickLogState {
  const { locations } = useApp();
  const { logWaste } = useWasteEntry();
  const [allItems, setAllItems] = useState<QuickLogItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastLoggedItem, setLastLoggedItem] = useState<string | null>(null);

  const defaultLocationId = locationIdOverride || locations[0]?.id || '';
  const { reason: suggestedReason, label: suggestedReasonLabel } = useMemo(getAutoReason, []);

  // Fetch inventory items
  useEffect(() => {
    async function fetch() {
      setIsLoadingItems(true);
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, name, unit, last_cost, category_name')
        .order('name');

      if (error || !data) {
        setAllItems([]);
        setIsLoadingItems(false);
        return;
      }

      const freqMap = getFrequencyMap();
      const items: QuickLogItem[] = data.map(item => {
        const { displayName, unit } = parseNameUnit(item.name || 'Sin nombre', item.unit);
        return {
          id: item.id,
          name: `${displayName} (${unit})`,
          unit,
          lastCost: item.last_cost || 0,
          category: item.category_name || 'Otros',
          frequency: freqMap[item.id] || 0,
          isFrequent: (freqMap[item.id] || 0) >= 1,
        };
      });

      setAllItems(items);
      setIsLoadingItems(false);
    }
    fetch();
  }, []);

  // Frequent items sorted by frequency
  const frequentItems = useMemo(() => {
    return allItems
      .filter(i => i.isFrequent)
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 8);
  }, [allItems]);

  // Submit quick log
  const submitQuickLog = useCallback(async (
    itemId: string,
    quantity: number,
    reason?: WasteReasonCode,
  ) => {
    if (!defaultLocationId) return;
    setIsSubmitting(true);
    try {
      await logWaste.mutateAsync({
        item_id: itemId,
        location_id: defaultLocationId,
        reason: reason || suggestedReason,
        quantity,
      });
      bumpFrequency(itemId);
      const item = allItems.find(i => i.id === itemId);
      setLastLoggedItem(item?.name || null);
      // Reset after 3s
      setTimeout(() => setLastLoggedItem(null), 3000);
    } finally {
      setIsSubmitting(false);
    }
  }, [defaultLocationId, suggestedReason, logWaste, allItems]);

  return {
    items: allItems,
    frequentItems,
    allItems,
    suggestedReason,
    suggestedReasonLabel,
    isLoadingItems,
    defaultLocationId,
    submitQuickLog,
    isSubmitting,
    lastLoggedItem,
  };
}
