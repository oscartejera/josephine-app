import { useMemo } from 'react';
import type { MenuEngineeringItem, MenuEngineeringStats } from './useMenuEngineeringData';

// ---------------------------------------------------------------------------
// Pavesic CMAM (Cost-Margin Analysis Model) — Pavesic, D. (1985)
//
// Adds FC% as a safety guardrail to Kasavana-Smith's CM-only model.
// A dish can have a high CM but an unsustainable FC% — Pavesic catches that.
//
// Axes: Weighted Contribution Margin  vs  Food Cost %
//   High WCM + Low FC%  → PRIME        (best dish on the menu)
//   High WCM + High FC% → STANDARD     (profitable but watch costs)
//   Low WCM  + Low FC%  → SLEEPER      (efficient but not selling)
//   Low WCM  + High FC% → PROBLEM      (worst: expensive and unpopular)
// ---------------------------------------------------------------------------

export type PavesicClassification = 'prime' | 'standard' | 'sleeper' | 'problem';

export interface PavesicItem {
  product_id: string;
  name: string;
  category: string;
  // Original Kasavana-Smith
  kasavana_classification: string;
  // Pavesic metrics
  weighted_cm: number;
  food_cost_pct: number;
  // Pavesic classification
  pavesic_classification: PavesicClassification;
  // Does Pavesic disagree with Kasavana-Smith?
  has_disagreement: boolean;
  // Original item data for display
  selling_price: number;
  unit_food_cost: number;
  unit_gross_profit: number;
  units_sold: number;
}

export interface PavesicAnalysisResult {
  items: PavesicItem[];
  // Thresholds
  avg_weighted_cm: number;
  avg_food_cost_pct: number;
  // Counts
  primes: number;
  standards: number;
  sleepers: number;
  problems: number;
  // Disagreements
  disagreement_count: number;
  disagreement_items: PavesicItem[];
}

/**
 * Kasavana says "good" (star/puzzle has high CM) but Pavesic says "bad"
 * (standard/problem has high FC%). This is the key insight Pavesic adds.
 */
function hasDisagreement(
  kasavana: string,
  pavesic: PavesicClassification,
): boolean {
  // Kasavana says profitable (star/puzzle) but Pavesic flags cost risk
  if ((kasavana === 'star' || kasavana === 'puzzle') && (pavesic === 'standard' || pavesic === 'problem')) {
    return true;
  }
  // Kasavana says unprofitable (dog) but Pavesic sees efficiency
  if (kasavana === 'dog' && pavesic === 'sleeper') {
    return true;
  }
  return false;
}

export function usePavesicAnalysis(
  items: MenuEngineeringItem[],
  stats: MenuEngineeringStats | null,
): PavesicAnalysisResult | null {
  return useMemo(() => {
    if (!stats || items.length === 0) return null;

    const totalUnits = stats.totalUnits;
    if (totalUnits === 0) return null;

    // Step 1: Calculate Weighted CM and FC% for each item
    const withMetrics = items.map((item) => {
      const weighted_cm = (item.unit_gross_profit * item.units_sold) / totalUnits;
      const food_cost_pct = item.selling_price_ex_vat > 0
        ? (item.unit_food_cost / item.selling_price_ex_vat) * 100
        : 0;
      return { ...item, weighted_cm, food_cost_pct };
    });

    // Step 2: Average thresholds (weighted)
    const avg_weighted_cm = withMetrics.reduce((s, i) => s + i.weighted_cm, 0) / withMetrics.length;
    const totalCost = items.reduce((s, i) => s + i.unit_food_cost * i.units_sold, 0);
    const totalRevenue = items.reduce((s, i) => s + i.selling_price_ex_vat * i.units_sold, 0);
    const avg_food_cost_pct = totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0;

    // Step 3: Classify
    const pavesicItems: PavesicItem[] = withMetrics.map((item) => {
      const highWCM = item.weighted_cm >= avg_weighted_cm;
      const lowFC = item.food_cost_pct <= avg_food_cost_pct;

      let pavesic_classification: PavesicClassification;
      if (highWCM && lowFC) pavesic_classification = 'prime';
      else if (highWCM && !lowFC) pavesic_classification = 'standard';
      else if (!highWCM && lowFC) pavesic_classification = 'sleeper';
      else pavesic_classification = 'problem';

      const disagreement = hasDisagreement(item.classification, pavesic_classification);

      return {
        product_id: item.product_id,
        name: item.name,
        category: item.category,
        kasavana_classification: item.classification,
        weighted_cm: item.weighted_cm,
        food_cost_pct: item.food_cost_pct,
        pavesic_classification,
        has_disagreement: disagreement,
        selling_price: item.selling_price_ex_vat,
        unit_food_cost: item.unit_food_cost,
        unit_gross_profit: item.unit_gross_profit,
        units_sold: item.units_sold,
      };
    });

    const disagreement_items = pavesicItems.filter((i) => i.has_disagreement);

    return {
      items: pavesicItems,
      avg_weighted_cm,
      avg_food_cost_pct,
      primes: pavesicItems.filter((i) => i.pavesic_classification === 'prime').length,
      standards: pavesicItems.filter((i) => i.pavesic_classification === 'standard').length,
      sleepers: pavesicItems.filter((i) => i.pavesic_classification === 'sleeper').length,
      problems: pavesicItems.filter((i) => i.pavesic_classification === 'problem').length,
      disagreement_count: disagreement_items.length,
      disagreement_items,
    };
  }, [items, stats]);
}
