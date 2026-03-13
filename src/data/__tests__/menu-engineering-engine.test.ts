/**
 * Menu Engineering Engine — Canonical Tests
 *
 * Uses the exact "Vegetarian Mains" fixture from the specification.
 * Tests all canonical formulas against known correct values.
 *
 * Run: npx vitest run src/data/__tests__/menu-engineering-engine.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  computeIdealAveragePopularity,
  computeUnitGrossProfit,
  computeAverageGrossProfit,
  computePopularityPct,
  classifyItem,
  buildClassificationReason,
  analyzeCategory,
  normalizeToExVat,
  getDataConfidence,
  type MenuEngineeringInput,
  type Classification,
} from '@/lib/menu-engineering-engine';

// ─── Canonical Fixture: Vegetarian Mains ────────────────────────────────────

const VEGETARIAN_MAINS: MenuEngineeringInput[] = [
  { item_name: 'Root Vegetables',                category: 'Vegetarian mains', unit_food_cost: 4.80,  selling_price_ex_vat: 16.00, units_sold: 210, cost_source: 'recipe_actual' },
  { item_name: 'Warm Asparagus Salad',           category: 'Vegetarian mains', unit_food_cost: 5.00,  selling_price_ex_vat: 17.00, units_sold: 120, cost_source: 'recipe_actual' },
  { item_name: 'Roasted Eggplant',               category: 'Vegetarian mains', unit_food_cost: 4.00,  selling_price_ex_vat: 17.00, units_sold: 220, cost_source: 'recipe_actual' },
  { item_name: 'Cauliflower Steak',              category: 'Vegetarian mains', unit_food_cost: 6.00,  selling_price_ex_vat: 18.00, units_sold:  95, cost_source: 'recipe_actual' },
  { item_name: 'Wild Mushroom Truffle Risotto',  category: 'Vegetarian mains', unit_food_cost: 7.50,  selling_price_ex_vat: 21.00, units_sold: 190, cost_source: 'recipe_actual' },
];

// Expected values from specification
const EXPECTED = {
  total_units: 835,
  item_count: 5,
  ideal_average_popularity: 14.00, // (100 / 5) * 70 = 1400 / 100 = 14.00
  unit_gross_profits: {
    'Root Vegetables': 11.20,
    'Warm Asparagus Salad': 12.00,
    'Roasted Eggplant': 13.00,
    'Cauliflower Steak': 12.00,
    'Wild Mushroom Truffle Risotto': 13.50,
  },
  // average_gross_profit = (11.2*210 + 12*120 + 13*220 + 12*95 + 13.5*190) / 835
  // = (2352 + 1440 + 2860 + 1140 + 2565) / 835 = 10357 / 835 = 12.40
  average_gross_profit: 12.40,
  classifications: {
    'Root Vegetables': 'plow_horse' as Classification,           // pop 25.15% >= 14%, GP 11.20 < 12.40
    'Warm Asparagus Salad': 'plow_horse' as Classification,      // pop 14.37% >= 14%, GP 12.00 < 12.40
    'Roasted Eggplant': 'star' as Classification,                // pop 26.35% >= 14%, GP 13.00 >= 12.40
    'Cauliflower Steak': 'dog' as Classification,                // pop 11.38% <  14%, GP 12.00 < 12.40
    'Wild Mushroom Truffle Risotto': 'star' as Classification,   // pop 22.75% >= 14%, GP 13.50 >= 12.40
  },
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Menu Engineering Engine — Canonical Formulas', () => {

  // ── Popularity Threshold (70% Rule) ───────────────────────────────────────

  describe('computeIdealAveragePopularity', () => {
    it('computes (100 / N) × 70 for 5 items → 14.00', () => {
      expect(computeIdealAveragePopularity(5)).toBe(14.00);
    });

    it('computes (100 / 10) × 70 for 10 items → 7.00', () => {
      expect(computeIdealAveragePopularity(10)).toBe(7.00);
    });

    it('returns 0 for 0 items', () => {
      expect(computeIdealAveragePopularity(0)).toBe(0);
    });

    it('computes (100 / 3) × 70 for 3 items → 23.33', () => {
      expect(computeIdealAveragePopularity(3)).toBe(23.33);
    });
  });

  // ── Unit Gross Profit ─────────────────────────────────────────────────────

  describe('computeUnitGrossProfit', () => {
    it.each([
      ['Root Vegetables', 16.00, 4.80, 11.20],
      ['Warm Asparagus Salad', 17.00, 5.00, 12.00],
      ['Roasted Eggplant', 17.00, 4.00, 13.00],
      ['Cauliflower Steak', 18.00, 6.00, 12.00],
      ['Wild Mushroom Truffle Risotto', 21.00, 7.50, 13.50],
    ])('%s: €%s - €%s = €%s', (_name, price, cost, expected) => {
      expect(computeUnitGrossProfit(price, cost)).toBe(expected);
    });
  });

  // ── Average Gross Profit ──────────────────────────────────────────────────

  describe('computeAverageGrossProfit', () => {
    it('computes 12.40 for Vegetarian Mains fixture', () => {
      const result = computeAverageGrossProfit(VEGETARIAN_MAINS);
      expect(result).toBeCloseTo(EXPECTED.average_gross_profit, 1);
    });

    it('returns 0 for empty items', () => {
      expect(computeAverageGrossProfit([])).toBe(0);
    });

    it('returns 0 if all units_sold are 0', () => {
      const zeroItems = VEGETARIAN_MAINS.map(i => ({ ...i, units_sold: 0 }));
      expect(computeAverageGrossProfit(zeroItems)).toBe(0);
    });
  });

  // ── Popularity Percentage ─────────────────────────────────────────────────

  describe('computePopularityPct', () => {
    it('Root Vegetables: 210/835 = 25.15%', () => {
      expect(computePopularityPct(210, 835)).toBeCloseTo(25.15, 1);
    });

    it('Warm Asparagus Salad: 120/835 = 14.37%', () => {
      expect(computePopularityPct(120, 835)).toBeCloseTo(14.37, 1);
    });

    it('Cauliflower Steak: 95/835 = 11.38%', () => {
      expect(computePopularityPct(95, 835)).toBeCloseTo(11.38, 1);
    });

    it('returns 0 for 0 total units', () => {
      expect(computePopularityPct(100, 0)).toBe(0);
    });
  });

  // ── Classification ────────────────────────────────────────────────────────

  describe('classifyItem', () => {
    it('Star: high pop + high profit', () => {
      const result = classifyItem(26.35, 14.00, 13.00, 12.40);
      expect(result.classification).toBe('star');
      expect(result.popularityClass).toBe('high');
      expect(result.profitabilityClass).toBe('high');
    });

    it('Plow Horse: high pop + low profit', () => {
      const result = classifyItem(25.15, 14.00, 11.20, 12.40);
      expect(result.classification).toBe('plow_horse');
    });

    it('Puzzle: low pop + high profit', () => {
      const result = classifyItem(5.0, 14.00, 15.00, 12.40);
      expect(result.classification).toBe('puzzle');
    });

    it('Dog: low pop + low profit', () => {
      const result = classifyItem(11.38, 14.00, 12.00, 12.40);
      expect(result.classification).toBe('dog');
    });

    it('boundary: equals threshold = high (both axes)', () => {
      const result = classifyItem(14.00, 14.00, 12.40, 12.40);
      expect(result.classification).toBe('star');
    });
  });

  // ── Full Category Analysis ────────────────────────────────────────────────

  describe('analyzeCategory — Vegetarian Mains fixture', () => {
    const results = analyzeCategory(VEGETARIAN_MAINS);

    it('returns 5 items', () => {
      expect(results).toHaveLength(5);
    });

    it('all items have idealAveragePopularity = 14.00', () => {
      results.forEach(r => {
        expect(r.ideal_average_popularity).toBe(14.00);
      });
    });

    it('all items have averageGrossProfit ≈ 12.40', () => {
      results.forEach(r => {
        expect(r.average_gross_profit).toBeCloseTo(12.40, 1);
      });
    });

    it.each(Object.entries(EXPECTED.classifications))('%s → %s', (name, expectedClass) => {
      const item = results.find(r => r.item_name === name);
      expect(item).toBeDefined();
      expect(item!.classification).toBe(expectedClass);
    });

    it('unit_gross_profit values match specification', () => {
      for (const [name, expected] of Object.entries(EXPECTED.unit_gross_profits)) {
        const item = results.find(r => r.item_name === name);
        expect(item).toBeDefined();
        expect(item!.unit_gross_profit).toBe(expected);
      }
    });

    it('total_gross_profit = unit_gross_profit × units_sold', () => {
      results.forEach(r => {
        expect(r.total_gross_profit).toBeCloseTo(r.unit_gross_profit * r.units_sold, 0);
      });
    });

    it('all items have classification_reason string', () => {
      results.forEach(r => {
        expect(r.classification_reason).toBeTruthy();
        expect(r.classification_reason).toContain('Pop');
        expect(r.classification_reason).toContain('GP');
      });
    });

    it('all items have cost_source = recipe_actual', () => {
      results.forEach(r => {
        expect(r.cost_source).toBe('recipe_actual');
        expect(r.data_confidence).toBe('high');
      });
    });
  });

  // ── Category Isolation ────────────────────────────────────────────────────

  describe('category isolation', () => {
    it('thresholds change when category composition changes', () => {
      const subset = VEGETARIAN_MAINS.slice(0, 3);
      const fullResults = analyzeCategory(VEGETARIAN_MAINS);
      const subsetResults = analyzeCategory(subset);

      // Different N → different popularity threshold
      expect(subsetResults[0].ideal_average_popularity).not.toBe(fullResults[0].ideal_average_popularity);
      // Different mix → different average gross profit
      expect(subsetResults[0].average_gross_profit).not.toBeCloseTo(fullResults[0].average_gross_profit, 1);
    });
  });

  // ── VAT Normalization ─────────────────────────────────────────────────────

  describe('normalizeToExVat', () => {
    it('€11 gross at 10% → €10.00 ex VAT', () => {
      expect(normalizeToExVat(11.00, 0.10)).toBe(10.00);
    });

    it('€12.10 gross at 10% → €11.00 ex VAT', () => {
      expect(normalizeToExVat(12.10, 0.10)).toBe(11.00);
    });

    it('€100 gross at 21% → €82.64 ex VAT', () => {
      expect(normalizeToExVat(100.00, 0.21)).toBe(82.64);
    });
  });

  // ── Data Confidence ───────────────────────────────────────────────────────

  describe('getDataConfidence', () => {
    it('recipe_actual → high', () => expect(getDataConfidence('recipe_actual')).toBe('high'));
    it('manual_override → high', () => expect(getDataConfidence('manual_override')).toBe('high'));
    it('recipe_estimated → medium', () => expect(getDataConfidence('recipe_estimated')).toBe('medium'));
    it('fallback_average → medium', () => expect(getDataConfidence('fallback_average')).toBe('medium'));
    it('unknown → low', () => expect(getDataConfidence('unknown')).toBe('low'));
  });

  // ── Missing / Estimated Cost Handling ─────────────────────────────────────

  describe('missing cost handling', () => {
    it('items with cost_source=unknown get data_confidence=low', () => {
      const items: MenuEngineeringInput[] = [
        { item_name: 'Mystery Dish', category: 'Test', selling_price_ex_vat: 15.00, unit_food_cost: 0, units_sold: 100, cost_source: 'unknown' },
        { item_name: 'Known Dish', category: 'Test', selling_price_ex_vat: 15.00, unit_food_cost: 5.00, units_sold: 100, cost_source: 'recipe_actual' },
      ];
      const results = analyzeCategory(items);
      expect(results[0].data_confidence).toBe('low');
      expect(results[1].data_confidence).toBe('high');
    });

    it('zero food cost still classifies (GP = selling price)', () => {
      const items: MenuEngineeringInput[] = [
        { item_name: 'Free Cost Item', category: 'Test', selling_price_ex_vat: 15.00, unit_food_cost: 0, units_sold: 100 },
      ];
      const results = analyzeCategory(items);
      expect(results[0].unit_gross_profit).toBe(15.00);
      expect(results[0].classification).toBe('star'); // Only item → always star
    });
  });

  // ── Classification Reason ─────────────────────────────────────────────────

  describe('buildClassificationReason', () => {
    it('formats high/high correctly', () => {
      const reason = buildClassificationReason(25.15, 14.00, 13.50, 12.40);
      expect(reason).toContain('≥');
      expect(reason).toContain('Pop 25.1%'); // toFixed(1) rounds 25.15 → 25.1 (IEEE 754)
      expect(reason).toContain('GP €13.50');
    });

    it('formats low/low correctly', () => {
      const reason = buildClassificationReason(11.38, 14.00, 12.00, 12.40);
      expect(reason).toContain('<');
    });
  });
});
