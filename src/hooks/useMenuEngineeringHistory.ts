import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { MenuEngineeringItem, MenuEngineeringStats } from './useMenuEngineeringData';
import type { PavesicItem } from './usePavesicAnalysis';

// ---------------------------------------------------------------------------
// Historical Trend — saves snapshots of ME classifications per period
// so we can show quadrant migration over time.
// ---------------------------------------------------------------------------

export interface SnapshotRow {
  product_id: string;
  product_name: string;
  category: string;
  period_start: string;
  period_end: string;
  classification: string;
  pavesic_classification: string | null;
  selling_price: number;
  unit_gross_profit: number;
  food_cost_pct: number;
  units_sold: number;
}

export interface ClassificationChange {
  product_id: string;
  product_name: string;
  category: string;
  previous_classification: string;
  current_classification: string;
  previous_period: string;
  current_period: string;
}

export function useMenuEngineeringHistory() {
  const { profile } = useAuth();
  const orgId = profile?.group_id;
  const [saving, setSaving] = useState(false);
  const [timeline, setTimeline] = useState<SnapshotRow[]>([]);
  const [changes, setChanges] = useState<ClassificationChange[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  /**
   * Save a snapshot of current classifications.
   * Uses upsert so calling twice for the same period is safe.
   */
  const saveSnapshot = useCallback(async (
    items: MenuEngineeringItem[],
    pavesicItems: PavesicItem[] | null,
    locationId: string | null,
    dateFrom: string,
    dateTo: string,
  ) => {
    if (!orgId || items.length === 0) return;

    setSaving(true);
    try {
      const pavesicMap = new Map(
        (pavesicItems ?? []).map((p) => [p.product_id, p.pavesic_classification]),
      );

      const rows = items.map((item) => ({
        organization_id: orgId,
        location_id: locationId,
        product_id: item.product_id,
        product_name: item.name,
        category: item.category,
        period_start: dateFrom,
        period_end: dateTo,
        classification: item.classification,
        selling_price: item.selling_price_ex_vat,
        unit_food_cost: item.unit_food_cost,
        unit_gross_profit: item.unit_gross_profit,
        units_sold: item.units_sold,
        popularity_pct: item.popularity_pct,
        food_cost_pct: item.selling_price_ex_vat > 0
          ? (item.unit_food_cost / item.selling_price_ex_vat) * 100
          : 0,
        pavesic_classification: pavesicMap.get(item.product_id) ?? null,
      }));

      // Upsert — if same org+location+product+period exists, update
      const { error } = await (supabase as any)
        .from('menu_engineering_snapshots')
        .upsert(rows, {
          onConflict: 'organization_id,location_id,product_id,period_start,period_end',
        });

      if (error) {
        console.warn('[ME History] Failed to save snapshot:', error.message);
      }
    } catch (err) {
      console.warn('[ME History] Snapshot error:', err);
    } finally {
      setSaving(false);
    }
  }, [orgId]);

  /**
   * Fetch timeline of snapshots and compute classification changes.
   */
  const fetchTimeline = useCallback(async (
    locationId: string | null,
    limit = 6,
  ) => {
    if (!orgId) return;

    setTimelineLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc('get_menu_engineering_timeline', {
        p_organization_id: orgId,
        p_location_id: locationId,
        p_limit: limit,
      });

      if (error) {
        console.warn('[ME History] Timeline fetch error:', error.message);
        setTimeline([]);
        setChanges([]);
        return;
      }

      const rows = (data ?? []) as SnapshotRow[];
      setTimeline(rows);

      // Detect classification changes between consecutive periods
      const byProduct = new Map<string, SnapshotRow[]>();
      rows.forEach((r) => {
        const existing = byProduct.get(r.product_id) ?? [];
        existing.push(r);
        byProduct.set(r.product_id, existing);
      });

      const detectedChanges: ClassificationChange[] = [];
      byProduct.forEach((pRows) => {
        // Sort by period ascending
        pRows.sort((a, b) => a.period_start.localeCompare(b.period_start));
        for (let i = 1; i < pRows.length; i++) {
          if (pRows[i].classification !== pRows[i - 1].classification) {
            detectedChanges.push({
              product_id: pRows[i].product_id,
              product_name: pRows[i].product_name,
              category: pRows[i].category ?? '',
              previous_classification: pRows[i - 1].classification,
              current_classification: pRows[i].classification,
              previous_period: pRows[i - 1].period_start,
              current_period: pRows[i].period_start,
            });
          }
        }
      });

      setChanges(detectedChanges);
    } catch (err) {
      console.warn('[ME History] Timeline error:', err);
    } finally {
      setTimelineLoading(false);
    }
  }, [orgId]);

  return {
    saveSnapshot,
    saving,
    fetchTimeline,
    timeline,
    changes,
    timelineLoading,
  };
}
