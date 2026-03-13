/**
 * Canonical Pricing / OMNES Calculation Engine
 *
 * This is the SINGLE SOURCE OF TRUTH for Pricing / OMNES formulas.
 * Completely SEPARATE from Menu Engineering (Kasavana-Smith).
 *
 * Menu Engineering answers: "What is selling and making money?"
 * Pricing / OMNES answers:  "Is the category priced coherently?"
 *
 * Three OMNES rules:
 *   1. Price Range Ratio  = max_price / min_price
 *   2. Price Spread        = 3 equal bands (lower / middle / upper)
 *   3. Category Ratio      = avg_check_per_plate / avg_menu_price
 *
 * This engine does NOT touch classification, popularity, or gross profit.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type PriceRangeState = 'too_narrow' | 'healthy' | 'too_wide';
export type PricingHealthState = 'too_expensive' | 'healthy' | 'underpriced';
export type BandDistributionState =
  | 'balanced'
  | 'too_many_lower'
  | 'too_many_upper'
  | 'weak_middle';
export type PromotionZone = 'lower' | 'middle' | 'upper' | 'none';

export interface PricingOmnesInput {
  item_name: string;
  category: string;
  listed_price: number;           // selling_price_ex_vat (menu price)
  units_sold: number;
  item_revenue: number;           // total revenue for this item
}

export interface PricingOmnesItemResult {
  item_name: string;
  category: string;
  listed_price: number;
  units_sold: number;
  item_revenue: number;
  band: 'lower' | 'middle' | 'upper';
  is_promotion_candidate: boolean;
}

export interface PricingOmnesCategoryResult {
  category: string;
  item_count: number;
  // OMNES 1 — Price Range Ratio
  max_price: number;
  min_price: number;
  price_range_ratio: number;
  price_range_state: PriceRangeState;
  // OMNES 2 — Price Spread
  range_length: number;
  band_width: number;
  lower_band_min: number;
  lower_band_max: number;
  middle_band_min: number;
  middle_band_max: number;
  upper_band_min: number;
  upper_band_max: number;
  lower_band_count: number;
  middle_band_count: number;
  upper_band_count: number;
  lower_band_pct: number;
  middle_band_pct: number;
  upper_band_pct: number;
  band_distribution_state: BandDistributionState;
  // OMNES 3 — Category Ratio
  average_check_per_plate: number;
  average_menu_price: number;
  category_ratio: number;
  pricing_health_state: PricingHealthState;
  // Promotion
  promotion_zone: PromotionZone;
  // Explainability
  pricing_recommendation_reason: string;
  // Items with band assignment
  items: PricingOmnesItemResult[];
}

// ─── OMNES 1: Price Range Ratio ─────────────────────────────────────────────

/**
 * Compute price range ratio = max / min.
 * Interpretation: < 2.5 too narrow, 2.5–3.0 healthy, > 3.0 too wide.
 */
export function computePriceRangeRatio(prices: number[]): {
  max_price: number;
  min_price: number;
  ratio: number;
  state: PriceRangeState;
} {
  if (prices.length === 0) {
    return { max_price: 0, min_price: 0, ratio: 0, state: 'too_narrow' };
  }
  const positives = prices.filter(p => p > 0);
  if (positives.length === 0) {
    return { max_price: 0, min_price: 0, ratio: 0, state: 'too_narrow' };
  }
  const max_price = Math.max(...positives);
  const min_price = Math.min(...positives);
  const ratio = min_price > 0 ? round(max_price / min_price, 2) : 0;
  let state: PriceRangeState;
  if (ratio < 2.5) state = 'too_narrow';
  else if (ratio <= 3.0) state = 'healthy';
  else state = 'too_wide';
  return { max_price, min_price, ratio, state };
}

// ─── OMNES 2: Price Spread (3 Bands) ────────────────────────────────────────

export interface BandResult {
  range_length: number;
  band_width: number;
  lower_band: { min: number; max: number };
  middle_band: { min: number; max: number };
  upper_band: { min: number; max: number };
  lower_count: number;
  middle_count: number;
  upper_count: number;
  lower_pct: number;
  middle_pct: number;
  upper_pct: number;
  state: BandDistributionState;
}

/**
 * Build 3 equal-width price bands and compute item distribution.
 * Target: 25% lower, 50% middle, 25% upper.
 */
export function computePriceSpread(
  prices: number[],
  min_price: number,
  max_price: number,
): BandResult {
  const range_length = round(max_price - min_price, 2);
  const band_width = range_length > 0 ? round(range_length / 3, 2) : 0;

  const lower_band = { min: min_price, max: round(min_price + band_width, 2) };
  const middle_band = { min: round(min_price + band_width, 2), max: round(min_price + 2 * band_width, 2) };
  const upper_band = { min: round(min_price + 2 * band_width, 2), max: max_price };

  let lower_count = 0;
  let middle_count = 0;
  let upper_count = 0;

  for (const p of prices) {
    if (p <= lower_band.max) lower_count++;
    else if (p <= middle_band.max) middle_count++;
    else upper_count++;
  }

  const total = prices.length || 1;
  const lower_pct = round((lower_count / total) * 100, 1);
  const middle_pct = round((middle_count / total) * 100, 1);
  const upper_pct = round((upper_count / total) * 100, 1);

  // Determine distribution state
  let state: BandDistributionState = 'balanced';
  if (middle_pct < 35) state = 'weak_middle';
  else if (lower_pct > 40) state = 'too_many_lower';
  else if (upper_pct > 40) state = 'too_many_upper';

  return {
    range_length,
    band_width,
    lower_band,
    middle_band,
    upper_band,
    lower_count,
    middle_count,
    upper_count,
    lower_pct,
    middle_pct,
    upper_pct,
    state,
  };
}

/**
 * Assign a single price to its band.
 */
export function assignBand(
  price: number,
  lowerMax: number,
  middleMax: number,
): 'lower' | 'middle' | 'upper' {
  if (price <= lowerMax) return 'lower';
  if (price <= middleMax) return 'middle';
  return 'upper';
}

// ─── OMNES 3: Category Ratio ────────────────────────────────────────────────

/**
 * Compute category ratio = avg_check_per_plate / avg_menu_price.
 * < 0.90 → too expensive, 0.90–1.00 → healthy, > 1.00 → underpriced.
 */
export function computeCategoryRatio(
  totalRevenue: number,
  totalUnitsSold: number,
  prices: number[],
): {
  average_check_per_plate: number;
  average_menu_price: number;
  ratio: number;
  state: PricingHealthState;
} {
  const average_check_per_plate = totalUnitsSold > 0
    ? round(totalRevenue / totalUnitsSold, 2)
    : 0;
  const average_menu_price = prices.length > 0
    ? round(prices.reduce((s, p) => s + p, 0) / prices.length, 2)
    : 0;
  const ratio = average_menu_price > 0
    ? round(average_check_per_plate / average_menu_price, 2)
    : 0;

  let state: PricingHealthState;
  if (ratio < 0.90) state = 'too_expensive';
  else if (ratio <= 1.00) state = 'healthy';
  else state = 'underpriced';

  return { average_check_per_plate, average_menu_price, ratio, state };
}

// ─── Full Category Analysis ─────────────────────────────────────────────────

/**
 * Run the full Pricing / OMNES analysis for a set of items in ONE category.
 * Completely independent of Menu Engineering classification.
 */
export function analyzePricingCategory(
  items: PricingOmnesInput[],
): PricingOmnesCategoryResult | null {
  if (items.length === 0) return null;

  const category = items[0].category;
  const prices = items.map(i => i.listed_price).filter(p => p > 0);
  if (prices.length === 0) return null;

  // OMNES 1: Price Range Ratio
  const prr = computePriceRangeRatio(prices);

  // OMNES 2: Price Spread
  const spread = computePriceSpread(prices, prr.min_price, prr.max_price);

  // OMNES 3: Category Ratio
  const totalRevenue = items.reduce((s, i) => s + i.item_revenue, 0);
  const totalUnitsSold = items.reduce((s, i) => s + i.units_sold, 0);
  const cr = computeCategoryRatio(totalRevenue, totalUnitsSold, prices);

  // Promotion zone: recommend middle band items
  const promotionZone: PromotionZone = spread.middle_count > 0 ? 'middle' : 'none';

  // Build item results with band assignments
  const itemResults: PricingOmnesItemResult[] = items.map(item => {
    const band = item.listed_price > 0
      ? assignBand(item.listed_price, spread.lower_band.max, spread.middle_band.max)
      : 'lower';
    return {
      item_name: item.item_name,
      category: item.category,
      listed_price: item.listed_price,
      units_sold: item.units_sold,
      item_revenue: item.item_revenue,
      band,
      is_promotion_candidate: band === 'middle',
    };
  });

  // Build recommendation reason
  const reasons: string[] = [];
  if (prr.state === 'too_narrow') reasons.push('Rango de precios demasiado estrecho (ratio < 2.5). Considerar diversificar.');
  if (prr.state === 'too_wide') reasons.push('Rango de precios demasiado amplio (ratio > 3.0). Riesgo de percepción incoherente.');
  if (spread.state === 'weak_middle') reasons.push('Banda media débil. Mover productos hacia precios intermedios.');
  if (spread.state === 'too_many_lower') reasons.push('Demasiados productos en banda baja. Riesgo de canibalización.');
  if (spread.state === 'too_many_upper') reasons.push('Demasiados productos en banda alta. Puede disuadir a clientes.');
  if (cr.state === 'too_expensive') reasons.push(`Clientes eligen platos más baratos (ratio ${cr.ratio}). Revisar percepción de valor.`);
  if (cr.state === 'underpriced') reasons.push(`Clientes pagan más que la media de carta (ratio ${cr.ratio}). Oportunidad de subida.`);
  if (reasons.length === 0) reasons.push('La estructura de precios es saludable. Mantener equilibrio.');

  return {
    category,
    item_count: items.length,
    // OMNES 1
    max_price: prr.max_price,
    min_price: prr.min_price,
    price_range_ratio: prr.ratio,
    price_range_state: prr.state,
    // OMNES 2
    range_length: spread.range_length,
    band_width: spread.band_width,
    lower_band_min: spread.lower_band.min,
    lower_band_max: spread.lower_band.max,
    middle_band_min: spread.middle_band.min,
    middle_band_max: spread.middle_band.max,
    upper_band_min: spread.upper_band.min,
    upper_band_max: spread.upper_band.max,
    lower_band_count: spread.lower_count,
    middle_band_count: spread.middle_count,
    upper_band_count: spread.upper_count,
    lower_band_pct: spread.lower_pct,
    middle_band_pct: spread.middle_pct,
    upper_band_pct: spread.upper_pct,
    band_distribution_state: spread.state,
    // OMNES 3
    average_check_per_plate: cr.average_check_per_plate,
    average_menu_price: cr.average_menu_price,
    category_ratio: cr.ratio,
    pricing_health_state: cr.state,
    // Promotion
    promotion_zone: promotionZone,
    // Explainability
    pricing_recommendation_reason: reasons.join(' '),
    // Items
    items: itemResults,
  };
}

// ─── Top-3 Pricing Actions ──────────────────────────────────────────────────

export interface PricingAction {
  priority: number;
  title: string;
  description: string;
  source: 'pricing_omnes';
}

/**
 * Generate prioritized pricing actions from OMNES analysis.
 */
export function getTopPricingActions(result: PricingOmnesCategoryResult, n: number = 3): PricingAction[] {
  const actions: PricingAction[] = [];

  // Price range issues
  if (result.price_range_state === 'too_narrow') {
    actions.push({
      priority: 1,
      title: 'Diversificar rango de precios',
      description: `Ratio ${result.price_range_ratio} (< 2.5). Añadir opciones premium o de entrada para ampliar gama.`,
      source: 'pricing_omnes',
    });
  }
  if (result.price_range_state === 'too_wide') {
    actions.push({
      priority: 1,
      title: 'Reducir dispersión de precios',
      description: `Ratio ${result.price_range_ratio} (> 3.0). Rango €${result.min_price}–€${result.max_price} puede parecer incoherente.`,
      source: 'pricing_omnes',
    });
  }

  // Band distribution issues
  if (result.band_distribution_state === 'weak_middle') {
    actions.push({
      priority: 2,
      title: 'Fortalecer banda media',
      description: `Solo ${result.middle_band_pct}% en franja media. Ideal: ~50%. Ajustar precios hacia €${result.middle_band_min}–€${result.middle_band_max}.`,
      source: 'pricing_omnes',
    });
  }
  if (result.band_distribution_state === 'too_many_lower') {
    actions.push({
      priority: 2,
      title: 'Reducir concentración en banda baja',
      description: `${result.lower_band_pct}% de productos en banda baja. Riesgo de canibalización y márgenes bajos.`,
      source: 'pricing_omnes',
    });
  }
  if (result.band_distribution_state === 'too_many_upper') {
    actions.push({
      priority: 2,
      title: 'Reducir concentración en banda alta',
      description: `${result.upper_band_pct}% de productos en banda alta. Puede disuadir a clientes sensibles al precio.`,
      source: 'pricing_omnes',
    });
  }

  // Category ratio issues
  if (result.pricing_health_state === 'too_expensive') {
    actions.push({
      priority: 1,
      title: 'Revisar percepción de precio',
      description: `Ratio ${result.category_ratio} (< 0.90). Los clientes eligen platos más baratos. Revisar propuesta de valor.`,
      source: 'pricing_omnes',
    });
  }
  if (result.pricing_health_state === 'underpriced') {
    actions.push({
      priority: 3,
      title: 'Oportunidad de ajuste al alza',
      description: `Ratio ${result.category_ratio} (> 1.00). Clientes dispuestos a pagar más. Considerar subida selectiva.`,
      source: 'pricing_omnes',
    });
  }

  // Promotion zone
  if (result.promotion_zone === 'middle' && result.middle_band_count > 0) {
    actions.push({
      priority: 3,
      title: 'Promocionar productos de banda media',
      description: `${result.middle_band_count} productos en €${result.middle_band_min}–€${result.middle_band_max}. Mejor equilibrio calidad-precio percibido.`,
      source: 'pricing_omnes',
    });
  }

  // If everything is healthy
  if (actions.length === 0) {
    actions.push({
      priority: 4,
      title: 'Estructura de precios saludable',
      description: 'Mantener el equilibrio actual. Vigilar cambios estacionales.',
      source: 'pricing_omnes',
    });
  }

  return actions.sort((a, b) => a.priority - b.priority).slice(0, n);
}

// ─── AI Contract ────────────────────────────────────────────────────────────

export interface PricingOmnesAIPayload {
  methodology: 'omnes_pricing_analysis';
  schema_version: 1;
  category: string;
  analysis: Omit<PricingOmnesCategoryResult, 'items'>;
  items: PricingOmnesItemResult[];
  top_actions: PricingAction[];
  _do_not: readonly string[];
}

/**
 * Convert OMNES results into a frozen AI-consumption payload.
 */
export function toOmnesAIPayload(result: PricingOmnesCategoryResult): PricingOmnesAIPayload {
  const { items, ...analysis } = result;
  return {
    methodology: 'omnes_pricing_analysis',
    schema_version: 1,
    category: result.category,
    analysis,
    items,
    top_actions: getTopPricingActions(result),
    _do_not: Object.freeze([
      'Do NOT use OMNES data to reclassify Star/Plow Horse/Puzzle/Dog',
      'Do NOT mix price band analysis with gross profit classification',
      'Do NOT use category_ratio for profitability — it measures price perception',
      'Do NOT apply Menu Engineering formulas within this engine',
    ]),
  };
}

// ─── Helper ─────────────────────────────────────────────────────────────────

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
