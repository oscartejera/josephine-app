/**
 * Shared constants and types for Procurement module
 * Centralized to avoid duplication across components and hooks
 */

// ============= Types =============

export interface CategorySettings {
  wasteFactor: number;
  safetyStockPct: number;
  yieldFactor: number;
}

export interface ProcurementCategorySettings {
  [category: string]: CategorySettings;
}

export interface Supplier {
  id: string;
  name: string;
  logo?: string;
  deliveryDays: number[]; // 0=Sun, 1=Mon, etc.
  cutoffHour: number;
  cutoffMinute: number;
  leadTimeDays: number;
  minOrder: number;
  deliveryFee: number;
}

export interface RecommendationSettings {
  horizon: 7 | 14 | 30;
  includeSafetyStock: boolean;
  roundToPacks: boolean;
}

export interface RecommendationBreakdown {
  forecastUsage: number;
  adjustedForecast: number;
  safetyStock: number;
  onHand: number;
  onOrder: number;
  netNeeded: number;
  recommendedUnits: number;
  recommendedPacks: number;
  wasteFactor: number;
  yieldFactor: number;
  safetyStockPct: number;
}

// ============= Constants =============

/**
 * Default category settings for waste, safety stock, and yield factors
 * Used for recommendation calculations and category-level adjustments
 */
export const DEFAULT_CATEGORY_SETTINGS: ProcurementCategorySettings = {
  'Produce': { wasteFactor: 0.06, safetyStockPct: 0.15, yieldFactor: 1.0 },
  'Proteins': { wasteFactor: 0.05, safetyStockPct: 0.15, yieldFactor: 1.0 },
  'Dairy': { wasteFactor: 0.03, safetyStockPct: 0.15, yieldFactor: 1.0 },
  'Dry Goods': { wasteFactor: 0.01, safetyStockPct: 0.10, yieldFactor: 1.0 },
  'Beverages': { wasteFactor: 0.01, safetyStockPct: 0.10, yieldFactor: 1.0 },
  'Bakery': { wasteFactor: 0.04, safetyStockPct: 0.20, yieldFactor: 1.0 },
  'Condiments': { wasteFactor: 0.02, safetyStockPct: 0.10, yieldFactor: 1.0 },
};

/**
 * Fallback suppliers when database has no supplier data
 * These provide demo functionality and structure
 */
export const FALLBACK_SUPPLIERS: Supplier[] = [
  {
    id: 'macro',
    name: 'Macro',
    logo: 'M',
    deliveryDays: [1, 2, 3, 4, 5, 6],
    cutoffHour: 17,
    cutoffMinute: 0,
    leadTimeDays: 1,
    minOrder: 150,
    deliveryFee: 12,
  },
  {
    id: 'sysco',
    name: 'Sysco',
    logo: 'S',
    deliveryDays: [1, 3, 5],
    cutoffHour: 14,
    cutoffMinute: 0,
    leadTimeDays: 2,
    minOrder: 200,
    deliveryFee: 15,
  },
  {
    id: 'bidfood',
    name: 'Bidfood',
    logo: 'B',
    deliveryDays: [2, 4],
    cutoffHour: 12,
    cutoffMinute: 0,
    leadTimeDays: 2,
    minOrder: 100,
    deliveryFee: 10,
  },
];

// Sample data for settings preview
export const SAMPLE_SKUS_FOR_PREVIEW: Record<string, { name: string; forecastUsage: number; onHand: number; packSize: number }> = {
  'Produce': { name: 'Tomatoes Vine', forecastUsage: 35, onHand: 4, packSize: 5 },
  'Proteins': { name: 'Chicken Breast', forecastUsage: 28, onHand: 8, packSize: 5 },
  'Dairy': { name: 'Whole Milk', forecastUsage: 42, onHand: 18, packSize: 12 },
  'Dry Goods': { name: 'Pasta Penne', forecastUsage: 20, onHand: 6, packSize: 5 },
  'Beverages': { name: 'Coca-Cola', forecastUsage: 60, onHand: 48, packSize: 24 },
  'Bakery': { name: 'Burger Buns', forecastUsage: 64, onHand: 32, packSize: 48 },
  'Condiments': { name: 'Mayonnaise', forecastUsage: 8, onHand: 3, packSize: 5 },
};

// ============= Utility Functions =============

/**
 * Get waste factor for a category, with fallback
 */
export function getCategoryWasteFactor(category: string): number {
  const settings = DEFAULT_CATEGORY_SETTINGS[category];
  return settings?.wasteFactor ?? 0.03;
}

/**
 * Get full category settings with fallbacks
 */
export function getCategorySettings(category: string): CategorySettings {
  return DEFAULT_CATEGORY_SETTINGS[category] ?? {
    wasteFactor: 0.03,
    safetyStockPct: 0.15,
    yieldFactor: 1.0,
  };
}

/**
 * Unified recommendation calculation
 * Used by both the main hook and the settings preview
 */
export function calculateRecommendation(
  forecastUsage: number,
  onHand: number,
  onOrder: number,
  packSizeUnits: number,
  settings: CategorySettings,
  includeSafetyStock: boolean = true
): RecommendationBreakdown {
  // Adjusted forecast = (ForecastUsage * (1 + WasteFactor)) / YieldFactor
  const adjustedForecast = (forecastUsage * (1 + settings.wasteFactor)) / settings.yieldFactor;
  
  // Safety stock = percentage of forecast (if enabled)
  const safetyStock = includeSafetyStock ? forecastUsage * settings.safetyStockPct : 0;
  
  // Net needed = Adjusted + Safety - (OnHand + OnOrder)
  const netNeeded = Math.max(0, adjustedForecast + safetyStock - (onHand + onOrder));
  const recommendedUnits = netNeeded;
  const recommendedPacks = Math.ceil(recommendedUnits / packSizeUnits);

  return {
    forecastUsage,
    adjustedForecast,
    safetyStock,
    onHand,
    onOrder,
    netNeeded,
    recommendedUnits,
    recommendedPacks: Math.max(0, recommendedPacks),
    wasteFactor: settings.wasteFactor,
    yieldFactor: settings.yieldFactor,
    safetyStockPct: settings.safetyStockPct,
  };
}

/**
 * Map database category names to procurement categories
 */
export function mapDbCategoryToProcurement(category: string | null): string {
  if (!category) return 'Dry Goods';
  const lowerCategory = category.toLowerCase();

  if (lowerCategory.includes('meat') || lowerCategory.includes('protein') || lowerCategory.includes('chicken') || lowerCategory.includes('fish') || lowerCategory.includes('seafood')) {
    return 'Proteins';
  }
  if (lowerCategory.includes('dairy') || lowerCategory.includes('milk') || lowerCategory.includes('cheese') || lowerCategory.includes('cream')) {
    return 'Dairy';
  }
  if (lowerCategory.includes('produce') || lowerCategory.includes('vegetable') || lowerCategory.includes('fruit') || lowerCategory.includes('fresh')) {
    return 'Produce';
  }
  if (lowerCategory.includes('beverage') || lowerCategory.includes('drink')) {
    return 'Beverages';
  }
  if (lowerCategory.includes('bakery') || lowerCategory.includes('bread')) {
    return 'Bakery';
  }
  if (lowerCategory.includes('condiment') || lowerCategory.includes('sauce')) {
    return 'Condiments';
  }
  if (lowerCategory === 'food') {
    return 'Dry Goods';
  }
  return category.charAt(0).toUpperCase() + category.slice(1);
}
