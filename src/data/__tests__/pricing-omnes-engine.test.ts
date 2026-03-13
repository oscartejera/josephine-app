/**
 * Pricing / OMNES Engine — Canonical Tests
 *
 * Tests all OMNES formulas with restaurant-realistic fixtures.
 *
 * Run: npx vitest run src/data/__tests__/pricing-omnes-engine.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  computePriceRangeRatio,
  computePriceSpread,
  computeCategoryRatio,
  assignBand,
  analyzePricingCategory,
  getTopPricingActions,
  type PricingOmnesInput,
} from '@/lib/pricing-omnes-engine';

// ─── Fixture: Entrantes (Starters) category ─────────────────────────────────

const ENTRANTES: PricingOmnesInput[] = [
  { item_name: 'Ensalada mixta',         category: 'Entrantes', listed_price:  6.50, units_sold: 85, item_revenue:  552.50 },
  { item_name: 'Patatas bravas',         category: 'Entrantes', listed_price:  5.50, units_sold: 120, item_revenue: 660.00 },
  { item_name: 'Croquetas de jamón',     category: 'Entrantes', listed_price:  7.00, units_sold: 110, item_revenue: 770.00 },
  { item_name: 'Gazpacho andaluz',       category: 'Entrantes', listed_price:  5.00, units_sold: 70, item_revenue:  350.00 },
  { item_name: 'Tortilla española',      category: 'Entrantes', listed_price:  8.00, units_sold: 95, item_revenue:  760.00 },
  { item_name: 'Calamares a la romana',  category: 'Entrantes', listed_price: 9.50, units_sold: 65, item_revenue:  617.50 },
  { item_name: 'Jamón ibérico',          category: 'Entrantes', listed_price: 14.00, units_sold: 45, item_revenue: 630.00 },
  { item_name: 'Gambas al ajillo',       category: 'Entrantes', listed_price: 11.00, units_sold: 55, item_revenue: 605.00 },
];

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Pricing / OMNES Engine — Canonical Formulas', () => {

  // ── OMNES 1: Price Range Ratio ──────────────────────────────────────────

  describe('computePriceRangeRatio', () => {
    it('€14/€5 = 2.80 → healthy', () => {
      const prices = ENTRANTES.map(i => i.listed_price);
      const result = computePriceRangeRatio(prices);
      expect(result.max_price).toBe(14.00);
      expect(result.min_price).toBe(5.00);
      expect(result.ratio).toBe(2.80);
      expect(result.state).toBe('healthy');
    });

    it('too narrow: ratio < 2.5', () => {
      const result = computePriceRangeRatio([10, 11, 12]);
      expect(result.ratio).toBe(1.20);
      expect(result.state).toBe('too_narrow');
    });

    it('too wide: ratio > 3.0', () => {
      const result = computePriceRangeRatio([5, 8, 20]);
      expect(result.ratio).toBe(4.00);
      expect(result.state).toBe('too_wide');
    });

    it('exactly 2.5 → healthy boundary', () => {
      const result = computePriceRangeRatio([4, 10]);
      expect(result.ratio).toBe(2.50);
      expect(result.state).toBe('healthy');
    });

    it('exactly 3.0 → healthy boundary', () => {
      const result = computePriceRangeRatio([5, 15]);
      expect(result.ratio).toBe(3.00);
      expect(result.state).toBe('healthy');
    });

    it('empty prices → too narrow, zeros', () => {
      const result = computePriceRangeRatio([]);
      expect(result.ratio).toBe(0);
      expect(result.state).toBe('too_narrow');
    });

    it('single price → ratio 1.00, too narrow', () => {
      const result = computePriceRangeRatio([10]);
      expect(result.ratio).toBe(1.00);
      expect(result.state).toBe('too_narrow');
    });
  });

  // ── OMNES 2: Price Spread (3 Bands) ─────────────────────────────────────

  describe('computePriceSpread', () => {
    it('builds 3 equal bands from Entrantes', () => {
      const result = computePriceSpread(
        ENTRANTES.map(i => i.listed_price),
        5.00,
        14.00,
      );
      // range = 14 - 5 = 9, band_width = 9/3 = 3
      expect(result.range_length).toBe(9.00);
      expect(result.band_width).toBe(3.00);
      // lower: 5.00–8.00, middle: 8.00–11.00, upper: 11.00–14.00
      expect(result.lower_band.min).toBe(5.00);
      expect(result.lower_band.max).toBe(8.00);
      expect(result.middle_band.min).toBe(8.00);
      expect(result.middle_band.max).toBe(11.00);
      expect(result.upper_band.min).toBe(11.00);
      expect(result.upper_band.max).toBe(14.00);
    });

    it('counts items per band', () => {
      const prices = ENTRANTES.map(i => i.listed_price);
      const result = computePriceSpread(prices, 5.00, 14.00);
      // lower (≤8.00): 6.50, 5.50, 7.00, 5.00, 8.00 = 5
      // middle (>8.00, ≤11.00): 9.50, 11.00 = 2
      // upper (>11.00): 14.00 = 1
      expect(result.lower_count).toBe(5);
      expect(result.middle_count).toBe(2);
      expect(result.upper_count).toBe(1);
    });

    it('computes percentages', () => {
      const prices = ENTRANTES.map(i => i.listed_price);
      const result = computePriceSpread(prices, 5.00, 14.00);
      expect(result.lower_pct).toBe(62.5);
      expect(result.middle_pct).toBe(25.0);
      expect(result.upper_pct).toBe(12.5);
    });

    it('identical prices → range 0, all in lower', () => {
      const result = computePriceSpread([10, 10, 10], 10, 10);
      expect(result.range_length).toBe(0);
      expect(result.band_width).toBe(0);
      expect(result.lower_count).toBe(3);
    });
  });

  // ── OMNES 3: Category Ratio ─────────────────────────────────────────────

  describe('computeCategoryRatio', () => {
    it('computes average check and ratio for Entrantes', () => {
      const totalRevenue = ENTRANTES.reduce((s, i) => s + i.item_revenue, 0);
      const totalUnits = ENTRANTES.reduce((s, i) => s + i.units_sold, 0);
      const prices = ENTRANTES.map(i => i.listed_price);
      const result = computeCategoryRatio(totalRevenue, totalUnits, prices);
      // avg_check = 4945 / 645 ≈ 7.67
      // avg_menu_price = (6.5+5.5+7+5+8+9.5+14+11) / 8 = 66.5/8 = 8.3125
      expect(result.average_check_per_plate).toBeCloseTo(7.67, 1);
      expect(result.average_menu_price).toBeCloseTo(8.31, 1);
      // ratio = 7.67 / 8.31 ≈ 0.92 → healthy
      expect(result.ratio).toBeCloseTo(0.92, 1);
      expect(result.state).toBe('healthy');
    });

    it('too expensive: ratio < 0.90', () => {
      const result = computeCategoryRatio(800, 100, [10, 12, 14]);
      // avg_check = 8.00, avg_menu = 12.00, ratio = 0.67
      expect(result.ratio).toBeCloseTo(0.67, 1);
      expect(result.state).toBe('too_expensive');
    });

    it('underpriced: ratio > 1.00', () => {
      const result = computeCategoryRatio(1500, 100, [10, 12, 14]);
      // avg_check = 15.00, avg_menu = 12.00, ratio = 1.25
      expect(result.ratio).toBeCloseTo(1.25, 1);
      expect(result.state).toBe('underpriced');
    });

    it('zero units → zeros', () => {
      const result = computeCategoryRatio(0, 0, [10]);
      expect(result.average_check_per_plate).toBe(0);
      expect(result.ratio).toBe(0);
    });
  });

  // ── Band Assignment ─────────────────────────────────────────────────────

  describe('assignBand', () => {
    it('price ≤ lowerMax → lower', () => {
      expect(assignBand(5.00, 8.00, 11.00)).toBe('lower');
      expect(assignBand(8.00, 8.00, 11.00)).toBe('lower');
    });

    it('price > lowerMax and ≤ middleMax → middle', () => {
      expect(assignBand(9.00, 8.00, 11.00)).toBe('middle');
      expect(assignBand(11.00, 8.00, 11.00)).toBe('middle');
    });

    it('price > middleMax → upper', () => {
      expect(assignBand(12.00, 8.00, 11.00)).toBe('upper');
    });
  });

  // ── Full OMNES Analysis ─────────────────────────────────────────────────

  describe('analyzePricingCategory', () => {
    const result = analyzePricingCategory(ENTRANTES)!;

    it('returns a result for non-empty input', () => {
      expect(result).not.toBeNull();
    });

    it('assigns correct category', () => {
      expect(result.category).toBe('Entrantes');
      expect(result.item_count).toBe(8);
    });

    it('computes price range ratio', () => {
      expect(result.price_range_ratio).toBe(2.80);
      expect(result.price_range_state).toBe('healthy');
    });

    it('computes band distribution', () => {
      expect(result.lower_band_count + result.middle_band_count + result.upper_band_count).toBe(8);
    });

    it('items have band assignments', () => {
      expect(result.items).toHaveLength(8);
      result.items.forEach(item => {
        expect(['lower', 'middle', 'upper']).toContain(item.band);
      });
    });

    it('middle band items are promotion candidates', () => {
      const middleItems = result.items.filter(i => i.band === 'middle');
      middleItems.forEach(i => {
        expect(i.is_promotion_candidate).toBe(true);
      });
    });

    it('non-middle items are NOT promotion candidates', () => {
      const nonMiddle = result.items.filter(i => i.band !== 'middle');
      nonMiddle.forEach(i => {
        expect(i.is_promotion_candidate).toBe(false);
      });
    });

    it('has pricing recommendation reason', () => {
      expect(result.pricing_recommendation_reason).toBeTruthy();
    });

    it('returns null for empty items', () => {
      expect(analyzePricingCategory([])).toBeNull();
    });
  });

  // ── Top Actions ─────────────────────────────────────────────────────────

  describe('getTopPricingActions', () => {
    it('returns at most N actions', () => {
      const result = analyzePricingCategory(ENTRANTES)!;
      const actions = getTopPricingActions(result, 3);
      expect(actions.length).toBeLessThanOrEqual(3);
      expect(actions.length).toBeGreaterThan(0);
    });

    it('actions have required fields', () => {
      const result = analyzePricingCategory(ENTRANTES)!;
      const actions = getTopPricingActions(result);
      actions.forEach(a => {
        expect(a.source).toBe('pricing_omnes');
        expect(a.title).toBeTruthy();
        expect(a.description).toBeTruthy();
        expect(typeof a.priority).toBe('number');
      });
    });

    it('actions are sorted by priority', () => {
      const result = analyzePricingCategory(ENTRANTES)!;
      const actions = getTopPricingActions(result);
      for (let i = 1; i < actions.length; i++) {
        expect(actions[i].priority).toBeGreaterThanOrEqual(actions[i - 1].priority);
      }
    });
  });

  // ── Separation of Concerns ──────────────────────────────────────────────

  describe('separation from Menu Engineering', () => {
    it('does NOT reference classification, popularity, or gross profit', () => {
      const result = analyzePricingCategory(ENTRANTES)!;
      // OMNES result should have NO Menu Engineering fields
      const keys = Object.keys(result);
      expect(keys).not.toContain('classification');
      expect(keys).not.toContain('popularity_pct');
      expect(keys).not.toContain('unit_gross_profit');
      expect(keys).not.toContain('average_gross_profit');
      expect(keys).not.toContain('ideal_average_popularity');
    });

    it('input does NOT require food cost', () => {
      const input: PricingOmnesInput = {
        item_name: 'Test', category: 'Test', listed_price: 10, units_sold: 50, item_revenue: 500,
      };
      // No unit_food_cost required
      expect(Object.keys(input)).not.toContain('unit_food_cost');
    });
  });
});
