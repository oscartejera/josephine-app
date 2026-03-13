/**
 * Canonical Menu Engineering Calculation Engine
 *
 * This is the SINGLE SOURCE OF TRUTH for Menu Engineering formulas.
 * The same logic drives:
 *   - The SQL RPC (canonical calculations happen server-side)
 *   - Unit tests (validating correctness offline)
 *   - Frontend display (formatting + explainability)
 *
 * Methodology: Kasavana & Smith (1982) — per-category classification
 *
 * Formulas:
 *   popularity_pct = units_sold / total_units_in_category × 100
 *   ideal_average_popularity = (100 / N) × 70   (the 70% rule)
 *   unit_gross_profit = selling_price_ex_vat − unit_food_cost
 *   total_gross_profit = unit_gross_profit × units_sold
 *   average_gross_profit = Σ(total_gross_profit) / Σ(units_sold)
 *
 * Classification:
 *   Star       = popularity_pct ≥ ideal_avg AND unit_gross_profit ≥ avg_gross_profit
 *   Plow Horse = popularity_pct ≥ ideal_avg AND unit_gross_profit <  avg_gross_profit
 *   Puzzle     = popularity_pct <  ideal_avg AND unit_gross_profit ≥ avg_gross_profit
 *   Dog        = popularity_pct <  ideal_avg AND unit_gross_profit <  avg_gross_profit
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type Classification = 'star' | 'plow_horse' | 'puzzle' | 'dog';
export type PopularityClass = 'high' | 'low';
export type ProfitabilityClass = 'high' | 'low';
export type CostSource = 'recipe_actual' | 'recipe_estimated' | 'fallback_average' | 'manual_override' | 'unknown';
export type DataConfidence = 'high' | 'medium' | 'low';

export interface MenuEngineeringInput {
  item_name: string;
  category: string;
  selling_price_ex_vat: number;
  unit_food_cost: number;
  units_sold: number;
  cost_source?: CostSource;
}

export interface MenuEngineeringResult {
  item_name: string;
  category: string;
  selling_price_ex_vat: number;
  unit_food_cost: number;
  units_sold: number;
  popularity_pct: number;
  ideal_average_popularity: number;
  unit_gross_profit: number;
  total_gross_profit: number;
  average_gross_profit: number;
  popularity_class: PopularityClass;
  profitability_class: ProfitabilityClass;
  classification: Classification;
  classification_reason: string;
  recommended_action: string;
  cost_source: CostSource;
  data_confidence: DataConfidence;
}

export interface CategoryThresholds {
  total_units: number;
  item_count: number;
  ideal_average_popularity: number;
  average_gross_profit: number;
}

// ─── Action Recommendations ─────────────────────────────────────────────────

export const CLASSIFICATION_ACTIONS: Record<Classification, {
  title: string;
  emoji: string;
  actions: string[];
  description: string;
}> = {
  star: {
    title: 'Estrellas',
    emoji: '⭐',
    description: 'Populares y rentables — proteger y mantener visibles',
    actions: [
      'Mantener consistencia en preparación',
      'Mantener visibilidad en carta',
      'Promover como best sellers',
    ],
  },
  plow_horse: {
    title: 'Caballos de batalla',
    emoji: '🐴',
    description: 'Venden mucho pero dejan poco margen',
    actions: [
      'Revisar coste de receta',
      'Controlar porciones',
      'Considerar subida de precio cuidadosa',
    ],
  },
  puzzle: {
    title: 'Joyas ocultas',
    emoji: '💎',
    description: 'Muy rentables pero venden poco',
    actions: [
      'Mejorar ubicación / nombre en la carta',
      'Promover más activamente',
      'Revisar precio con cuidado',
    ],
  },
  dog: {
    title: 'A revisar',
    emoji: '🔍',
    description: 'Ni venden ni dejan margen suficiente',
    actions: [
      'Rediseñar el plato',
      'Reemplazar por alternativa',
      'Retirar si no tiene justificación estratégica',
    ],
  },
};

// ─── Core Calculation Functions ─────────────────────────────────────────────

/**
 * Compute the 70% rule popularity threshold.
 * ideal_average_popularity = (100 / number_of_items) × 0.70
 * Result is a percentage, e.g. for 5 items → 14.00%
 */
export function computeIdealAveragePopularity(itemCount: number): number {
  if (itemCount <= 0) return 0;
  return round((100 / itemCount) * 0.70, 2);
}

/**
 * Compute unit gross profit = selling_price_ex_vat − unit_food_cost
 */
export function computeUnitGrossProfit(sellingPriceExVat: number, unitFoodCost: number): number {
  return round(sellingPriceExVat - unitFoodCost, 2);
}

/**
 * Compute average gross profit for a category.
 * average_gross_profit = Σ(unit_gross_profit × units_sold) / Σ(units_sold)
 */
export function computeAverageGrossProfit(items: MenuEngineeringInput[]): number {
  const totalUnits = items.reduce((sum, i) => sum + i.units_sold, 0);
  if (totalUnits === 0) return 0;
  const totalGrossProfit = items.reduce((sum, i) => {
    const ugp = computeUnitGrossProfit(i.selling_price_ex_vat, i.unit_food_cost);
    return sum + ugp * i.units_sold;
  }, 0);
  return round(totalGrossProfit / totalUnits, 2);
}

/**
 * Compute popularity percentage for one item.
 * popularity_pct = (units_sold / total_units_in_category) × 100
 */
export function computePopularityPct(unitsSold: number, totalUnits: number): number {
  if (totalUnits <= 0) return 0;
  return round((unitsSold / totalUnits) * 100, 2);
}

/**
 * Classify a single item given its metrics and category thresholds.
 */
export function classifyItem(
  popularityPct: number,
  idealAveragePopularity: number,
  unitGrossProfit: number,
  averageGrossProfit: number,
): { classification: Classification; popularityClass: PopularityClass; profitabilityClass: ProfitabilityClass } {
  const popularityClass: PopularityClass = popularityPct >= idealAveragePopularity ? 'high' : 'low';
  const profitabilityClass: ProfitabilityClass = unitGrossProfit >= averageGrossProfit ? 'high' : 'low';

  let classification: Classification;
  if (popularityClass === 'high' && profitabilityClass === 'high') classification = 'star';
  else if (popularityClass === 'high' && profitabilityClass === 'low') classification = 'plow_horse';
  else if (popularityClass === 'low' && profitabilityClass === 'high') classification = 'puzzle';
  else classification = 'dog';

  return { classification, popularityClass, profitabilityClass };
}

/**
 * Build a human-readable classification reason.
 */
export function buildClassificationReason(
  popularityPct: number,
  idealAveragePopularity: number,
  unitGrossProfit: number,
  averageGrossProfit: number,
): string {
  const popOp = popularityPct >= idealAveragePopularity ? '≥' : '<';
  const profOp = unitGrossProfit >= averageGrossProfit ? '≥' : '<';
  return `Pop ${popularityPct.toFixed(1)}% ${popOp} ${idealAveragePopularity.toFixed(1)}% · GP €${unitGrossProfit.toFixed(2)} ${profOp} €${averageGrossProfit.toFixed(2)}`;
}

/**
 * Determine data confidence from cost source.
 */
export function getDataConfidence(costSource: CostSource): DataConfidence {
  switch (costSource) {
    case 'recipe_actual':
    case 'manual_override':
      return 'high';
    case 'recipe_estimated':
    case 'fallback_average':
      return 'medium';
    default:
      return 'low';
  }
}

/**
 * Normalize a VAT-inclusive price to ex-VAT.
 * selling_price_ex_vat = gross_price / (1 + vat_rate)
 */
export function normalizeToExVat(grossPrice: number, vatRate: number = 0.10): number {
  return round(grossPrice / (1 + vatRate), 2);
}

/**
 * Run the full Menu Engineering analysis for a set of items in ONE category.
 */
export function analyzeCategory(items: MenuEngineeringInput[]): MenuEngineeringResult[] {
  if (items.length === 0) return [];

  const totalUnits = items.reduce((sum, i) => sum + i.units_sold, 0);
  const itemCount = items.length;
  const idealAveragePopularity = computeIdealAveragePopularity(itemCount);
  const averageGrossProfit = computeAverageGrossProfit(items);

  return items.map(item => {
    const unitGrossProfit = computeUnitGrossProfit(item.selling_price_ex_vat, item.unit_food_cost);
    const totalGrossProfit = round(unitGrossProfit * item.units_sold, 2);
    const popularityPct = computePopularityPct(item.units_sold, totalUnits);
    const costSource = item.cost_source || 'unknown';
    const dataConfidence = getDataConfidence(costSource);

    const { classification, popularityClass, profitabilityClass } = classifyItem(
      popularityPct,
      idealAveragePopularity,
      unitGrossProfit,
      averageGrossProfit,
    );

    const classificationReason = buildClassificationReason(
      popularityPct,
      idealAveragePopularity,
      unitGrossProfit,
      averageGrossProfit,
    );

    return {
      item_name: item.item_name,
      category: item.category,
      selling_price_ex_vat: item.selling_price_ex_vat,
      unit_food_cost: item.unit_food_cost,
      units_sold: item.units_sold,
      popularity_pct: popularityPct,
      ideal_average_popularity: idealAveragePopularity,
      unit_gross_profit: unitGrossProfit,
      total_gross_profit: totalGrossProfit,
      average_gross_profit: averageGrossProfit,
      popularity_class: popularityClass,
      profitability_class: profitabilityClass,
      classification,
      classification_reason: classificationReason,
      recommended_action: CLASSIFICATION_ACTIONS[classification].actions[0],
      cost_source: costSource,
      data_confidence: dataConfidence,
    };
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ─── AI Contract ────────────────────────────────────────────────────────────
// Downstream AI flows (pricing suggestions, GPT prompts, recommendation
// engines) MUST consume this typed payload. They must NOT recompute
// classification, thresholds, or profitability from raw data.

/**
 * Per-item payload for AI consumers. Every field is pre-computed and final.
 */
export interface MenuEngineeringAIItem {
  /** Product name */
  name: string;
  /** Menu category this item belongs to */
  category: string;
  /** Canonical Kasavana-Smith classification — FINAL, do not reinterpret */
  classification: Classification;
  /** Human-readable explanation of why the item was classified this way */
  classification_reason: string;
  /** Recommended action tag (Mantener / Revisar coste / Promocionar / Evaluar) */
  action_tag: string;
  /** Selling price excluding VAT (€) */
  selling_price_ex_vat: number;
  /** Unit food cost from recipe or fallback (€) */
  unit_food_cost: number;
  /** Unit gross profit = selling_price_ex_vat − unit_food_cost (€) */
  unit_gross_profit: number;
  /** Units sold in the analysis period */
  units_sold: number;
  /** Popularity as percentage of total category units */
  popularity_pct: number;
  /** Where the cost data comes from */
  cost_source: string;
  /** Confidence in the cost data: high / medium / low */
  data_confidence: string;
}

/**
 * Category-level context for AI consumers.
 */
export interface MenuEngineeringAIPayload {
  /** Methodology version — consumers should check this */
  methodology: 'kasavana_smith_1982';
  /** Schema version — bump when payload shape changes */
  schema_version: 1;
  /** Category being analyzed (null = overview, not canonical) */
  category: string | null;
  /** Whether this is a per-category canonical analysis */
  is_canonical: boolean;
  /** VAT rate used for price normalization */
  vat_rate: number;
  /** Category-level thresholds — AI must use these, NOT recompute */
  thresholds: {
    ideal_average_popularity: number;
    average_gross_profit: number;
    total_units: number;
    item_count: number;
  };
  /** Classified items — classification is FINAL */
  items: MenuEngineeringAIItem[];
  /** Summary counts */
  summary: {
    stars: number;
    plow_horses: number;
    puzzles: number;
    dogs: number;
    low_confidence_count: number;
  };
  /** ⚠ AI consumers MUST NOT do any of the following */
  _do_not: readonly string[];
}

/**
 * Convert Menu Engineering items into a frozen AI-consumption payload.
 *
 * Downstream consumers (GPT prompts, pricing engines, recommendation
 * pipelines) should call this function and use the result as-is.
 * They MUST NOT recompute classification, thresholds, or profitability.
 */
export function toAIPayload(
  items: MenuEngineeringResult[],
  category: string | null,
  vatRate: number = 0.10,
): MenuEngineeringAIPayload {
  const firstItem = items[0];
  const thresholds = firstItem
    ? {
        ideal_average_popularity: firstItem.ideal_average_popularity,
        average_gross_profit: firstItem.average_gross_profit,
        total_units: items.reduce((s, i) => s + i.units_sold, 0),
        item_count: items.length,
      }
    : { ideal_average_popularity: 0, average_gross_profit: 0, total_units: 0, item_count: 0 };

  return {
    methodology: 'kasavana_smith_1982',
    schema_version: 1,
    category,
    is_canonical: category !== null,
    vat_rate: vatRate,
    thresholds,
    items: items.map(i => ({
      name: i.item_name,
      category: i.category,
      classification: i.classification,
      classification_reason: i.classification_reason,
      action_tag: CLASSIFICATION_ACTIONS[i.classification].actions[0],
      selling_price_ex_vat: i.selling_price_ex_vat,
      unit_food_cost: i.unit_food_cost,
      unit_gross_profit: i.unit_gross_profit,
      units_sold: i.units_sold,
      popularity_pct: i.popularity_pct,
      cost_source: i.cost_source,
      data_confidence: i.data_confidence,
    })),
    summary: {
      stars: items.filter(i => i.classification === 'star').length,
      plow_horses: items.filter(i => i.classification === 'plow_horse').length,
      puzzles: items.filter(i => i.classification === 'puzzle').length,
      dogs: items.filter(i => i.classification === 'dog').length,
      low_confidence_count: items.filter(i => i.data_confidence === 'low').length,
    },
    _do_not: Object.freeze([
      'Do NOT recompute classification from raw data',
      'Do NOT use margin_pct for profitability — use unit_gross_profit',
      'Do NOT mix items from different categories in one analysis',
      'Do NOT ignore data_confidence when making price recommendations',
      'Do NOT apply OMNES / price range / price spread within classification',
    ]),
  };
}
