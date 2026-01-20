import { useState, useMemo, useCallback, useEffect } from 'react';
import { addDays, format, isAfter, isBefore, getDay, setHours, setMinutes } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

// Types
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

export interface IngredientSku {
  id: string;
  supplierId: string;
  name: string;
  category: string;
  packSize: string;
  packSizeUnits: number;
  unit: string;
  unitPrice: number;
  onHandUnits: number;
  parLevelUnits: number;
  onOrderUnits: number;
  forecastDailyUsage: number[];
  paused: boolean;
  pauseReason?: string;
  wasteFactor: number; // e.g., 0.05 for 5%
  yieldFactor: number; // e.g., 0.95 for 95% yield
  safetyStockPct: number; // e.g., 0.15 for 15%
  // Link to real inventory
  inventoryItemId?: string;
  isRealData?: boolean;
}

export interface CartItem {
  skuId: string;
  packs: number;
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

export interface OrderSummary {
  supplierId: string;
  supplierName: string;
  deliveryDate: Date;
  coverageEndDate: Date;
  items: { sku: IngredientSku; packs: number }[];
  subtotal: number;
  deliveryFee: number;
  tax: number;
  total: number;
  minOrder: number;
  minOrderProgress: number;
}

export interface RecommendationSettings {
  horizon: 7 | 14 | 30;
  includeSafetyStock: boolean;
  roundToPacks: boolean;
}

export interface CategorySettingsMap {
  [category: string]: {
    wasteFactor: number;
    safetyStockPct: number;
    yieldFactor: number;
  };
}

// Default waste factors by category
const CATEGORY_WASTE_FACTORS: Record<string, number> = {
  'Produce': 0.06,
  'Proteins': 0.05,
  'Dairy': 0.03,
  'Dry Goods': 0.01,
  'Beverages': 0.01,
  'Bakery': 0.04,
  'Condiments': 0.02,
  'food': 0.04,
  'beverage': 0.02,
};

// Seed data - Suppliers
const SEED_SUPPLIERS: Supplier[] = [
  {
    id: 'macro',
    name: 'Macro',
    logo: 'M',
    deliveryDays: [1, 2, 3, 4, 5, 6], // Mon-Sat
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
    deliveryDays: [1, 3, 5], // Mon, Wed, Fri
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
    deliveryDays: [2, 4], // Tue, Thu
    cutoffHour: 12,
    cutoffMinute: 0,
    leadTimeDays: 2,
    minOrder: 100,
    deliveryFee: 10,
  },
];

// Fallback SKUs when no real inventory data available
const SEED_SKUS: Omit<IngredientSku, 'forecastDailyUsage' | 'wasteFactor' | 'yieldFactor' | 'safetyStockPct'>[] = [
  // Proteins
  { id: 'sku-001', supplierId: 'macro', name: 'Chicken Breast', category: 'Proteins', packSize: '1×5kg', packSizeUnits: 5, unit: 'kg', unitPrice: 42.50, onHandUnits: 8, parLevelUnits: 25, onOrderUnits: 0, paused: false },
  { id: 'sku-002', supplierId: 'macro', name: 'Beef Mince 80/20', category: 'Proteins', packSize: '1×3kg', packSizeUnits: 3, unit: 'kg', unitPrice: 28.90, onHandUnits: 4, parLevelUnits: 15, onOrderUnits: 0, paused: false },
  { id: 'sku-003', supplierId: 'macro', name: 'Salmon Fillet', category: 'Proteins', packSize: '1×2kg', packSizeUnits: 2, unit: 'kg', unitPrice: 38.00, onHandUnits: 2, parLevelUnits: 10, onOrderUnits: 0, paused: false },
  { id: 'sku-004', supplierId: 'macro', name: 'Pork Loin', category: 'Proteins', packSize: '1×4kg', packSizeUnits: 4, unit: 'kg', unitPrice: 35.20, onHandUnits: 6, parLevelUnits: 16, onOrderUnits: 0, paused: false },
  { id: 'sku-005', supplierId: 'sysco', name: 'Lamb Leg Boneless', category: 'Proteins', packSize: '1×3kg', packSizeUnits: 3, unit: 'kg', unitPrice: 52.00, onHandUnits: 3, parLevelUnits: 9, onOrderUnits: 0, paused: false },
  { id: 'sku-006', supplierId: 'macro', name: 'Duck Breast', category: 'Proteins', packSize: '4×200g', packSizeUnits: 0.8, unit: 'kg', unitPrice: 24.50, onHandUnits: 1.2, parLevelUnits: 4, onOrderUnits: 0, paused: false },
  { id: 'sku-007', supplierId: 'bidfood', name: 'Prawns Tiger 16/20', category: 'Proteins', packSize: '1×1kg', packSizeUnits: 1, unit: 'kg', unitPrice: 18.90, onHandUnits: 2, parLevelUnits: 6, onOrderUnits: 0, paused: false },
  { id: 'sku-008', supplierId: 'macro', name: 'Bacon Rashers', category: 'Proteins', packSize: '1×2.5kg', packSizeUnits: 2.5, unit: 'kg', unitPrice: 22.00, onHandUnits: 3, parLevelUnits: 10, onOrderUnits: 0, paused: false },
  
  // Dairy
  { id: 'sku-010', supplierId: 'macro', name: 'Whole Milk', category: 'Dairy', packSize: '12×1L', packSizeUnits: 12, unit: 'L', unitPrice: 14.40, onHandUnits: 18, parLevelUnits: 48, onOrderUnits: 0, paused: false },
  { id: 'sku-011', supplierId: 'macro', name: 'Double Cream', category: 'Dairy', packSize: '6×1L', packSizeUnits: 6, unit: 'L', unitPrice: 18.00, onHandUnits: 4, parLevelUnits: 18, onOrderUnits: 0, paused: false },
  { id: 'sku-012', supplierId: 'macro', name: 'Butter Unsalted', category: 'Dairy', packSize: '10×250g', packSizeUnits: 2.5, unit: 'kg', unitPrice: 21.50, onHandUnits: 1.5, parLevelUnits: 7.5, onOrderUnits: 0, paused: false },
  { id: 'sku-013', supplierId: 'sysco', name: 'Mozzarella Block', category: 'Dairy', packSize: '1×2.5kg', packSizeUnits: 2.5, unit: 'kg', unitPrice: 19.50, onHandUnits: 3, parLevelUnits: 10, onOrderUnits: 0, paused: false },
  { id: 'sku-014', supplierId: 'macro', name: 'Parmesan Wedge', category: 'Dairy', packSize: '1×1kg', packSizeUnits: 1, unit: 'kg', unitPrice: 22.00, onHandUnits: 0.8, parLevelUnits: 3, onOrderUnits: 0, paused: false },
  { id: 'sku-015', supplierId: 'macro', name: 'Eggs Free Range', category: 'Dairy', packSize: '180 eggs', packSizeUnits: 180, unit: 'eggs', unitPrice: 32.00, onHandUnits: 90, parLevelUnits: 360, onOrderUnits: 0, paused: false },
  { id: 'sku-016', supplierId: 'bidfood', name: 'Greek Yogurt', category: 'Dairy', packSize: '4×1kg', packSizeUnits: 4, unit: 'kg', unitPrice: 12.80, onHandUnits: 6, parLevelUnits: 16, onOrderUnits: 0, paused: false },
  
  // Produce
  { id: 'sku-020', supplierId: 'macro', name: 'Onions Brown', category: 'Produce', packSize: '1×10kg', packSizeUnits: 10, unit: 'kg', unitPrice: 8.50, onHandUnits: 12, parLevelUnits: 40, onOrderUnits: 0, paused: false },
  { id: 'sku-021', supplierId: 'macro', name: 'Tomatoes Vine', category: 'Produce', packSize: '1×5kg', packSizeUnits: 5, unit: 'kg', unitPrice: 12.00, onHandUnits: 4, parLevelUnits: 20, onOrderUnits: 0, paused: false },
  { id: 'sku-022', supplierId: 'macro', name: 'Potatoes Maris Piper', category: 'Produce', packSize: '1×25kg', packSizeUnits: 25, unit: 'kg', unitPrice: 18.00, onHandUnits: 20, parLevelUnits: 75, onOrderUnits: 0, paused: false },
  { id: 'sku-023', supplierId: 'macro', name: 'Carrots', category: 'Produce', packSize: '1×10kg', packSizeUnits: 10, unit: 'kg', unitPrice: 7.50, onHandUnits: 8, parLevelUnits: 30, onOrderUnits: 0, paused: false },
  { id: 'sku-024', supplierId: 'sysco', name: 'Lettuce Romaine', category: 'Produce', packSize: '6 heads', packSizeUnits: 6, unit: 'heads', unitPrice: 9.00, onHandUnits: 4, parLevelUnits: 18, onOrderUnits: 0, paused: false },
  { id: 'sku-025', supplierId: 'macro', name: 'Garlic Bulbs', category: 'Produce', packSize: '1×1kg', packSizeUnits: 1, unit: 'kg', unitPrice: 8.00, onHandUnits: 0.5, parLevelUnits: 3, onOrderUnits: 0, paused: false },
  { id: 'sku-026', supplierId: 'macro', name: 'Lemons', category: 'Produce', packSize: '50 units', packSizeUnits: 50, unit: 'units', unitPrice: 15.00, onHandUnits: 30, parLevelUnits: 100, onOrderUnits: 0, paused: false },
  { id: 'sku-027', supplierId: 'bidfood', name: 'Avocados Hass', category: 'Produce', packSize: '20 units', packSizeUnits: 20, unit: 'units', unitPrice: 24.00, onHandUnits: 12, parLevelUnits: 40, onOrderUnits: 0, paused: false },
  { id: 'sku-028', supplierId: 'macro', name: 'Mushrooms Button', category: 'Produce', packSize: '1×3kg', packSizeUnits: 3, unit: 'kg', unitPrice: 11.00, onHandUnits: 2, parLevelUnits: 9, onOrderUnits: 0, paused: false },
  { id: 'sku-029', supplierId: 'macro', name: 'Spinach Baby', category: 'Produce', packSize: '1×1kg', packSizeUnits: 1, unit: 'kg', unitPrice: 8.50, onHandUnits: 1, parLevelUnits: 4, onOrderUnits: 0, paused: false },
  
  // Dry Goods
  { id: 'sku-030', supplierId: 'macro', name: 'Pasta Penne', category: 'Dry Goods', packSize: '1×5kg', packSizeUnits: 5, unit: 'kg', unitPrice: 8.00, onHandUnits: 6, parLevelUnits: 20, onOrderUnits: 0, paused: false },
  { id: 'sku-031', supplierId: 'macro', name: 'Rice Basmati', category: 'Dry Goods', packSize: '1×10kg', packSizeUnits: 10, unit: 'kg', unitPrice: 22.00, onHandUnits: 8, parLevelUnits: 30, onOrderUnits: 0, paused: false },
  { id: 'sku-032', supplierId: 'sysco', name: 'Flour Plain', category: 'Dry Goods', packSize: '1×16kg', packSizeUnits: 16, unit: 'kg', unitPrice: 14.00, onHandUnits: 10, parLevelUnits: 48, onOrderUnits: 0, paused: false },
  { id: 'sku-033', supplierId: 'macro', name: 'Olive Oil Extra Virgin', category: 'Dry Goods', packSize: '1×5L', packSizeUnits: 5, unit: 'L', unitPrice: 35.00, onHandUnits: 3, parLevelUnits: 15, onOrderUnits: 0, paused: false },
  { id: 'sku-034', supplierId: 'macro', name: 'Vegetable Oil', category: 'Dry Goods', packSize: '1×10L', packSizeUnits: 10, unit: 'L', unitPrice: 18.00, onHandUnits: 8, parLevelUnits: 30, onOrderUnits: 0, paused: false },
  { id: 'sku-035', supplierId: 'macro', name: 'Tomato Passata', category: 'Dry Goods', packSize: '6×700g', packSizeUnits: 4.2, unit: 'kg', unitPrice: 9.50, onHandUnits: 5, parLevelUnits: 16.8, onOrderUnits: 0, paused: false },
  { id: 'sku-036', supplierId: 'bidfood', name: 'Chickpeas Tinned', category: 'Dry Goods', packSize: '6×400g', packSizeUnits: 2.4, unit: 'kg', unitPrice: 6.00, onHandUnits: 3, parLevelUnits: 9.6, onOrderUnits: 0, paused: false },
  { id: 'sku-037', supplierId: 'macro', name: 'Sugar Caster', category: 'Dry Goods', packSize: '1×5kg', packSizeUnits: 5, unit: 'kg', unitPrice: 6.50, onHandUnits: 4, parLevelUnits: 15, onOrderUnits: 0, paused: false },
  
  // Beverages
  { id: 'sku-040', supplierId: 'macro', name: 'Coca-Cola Classic', category: 'Beverages', packSize: '24×330ml', packSizeUnits: 24, unit: 'cans', unitPrice: 16.80, onHandUnits: 48, parLevelUnits: 120, onOrderUnits: 0, paused: false },
  { id: 'sku-041', supplierId: 'macro', name: 'Sprite', category: 'Beverages', packSize: '24×330ml', packSizeUnits: 24, unit: 'cans', unitPrice: 16.80, onHandUnits: 36, parLevelUnits: 96, onOrderUnits: 0, paused: false },
  { id: 'sku-042', supplierId: 'sysco', name: 'San Pellegrino', category: 'Beverages', packSize: '24×500ml', packSizeUnits: 24, unit: 'bottles', unitPrice: 24.00, onHandUnits: 24, parLevelUnits: 72, onOrderUnits: 0, paused: false },
  { id: 'sku-043', supplierId: 'macro', name: 'Orange Juice Fresh', category: 'Beverages', packSize: '6×1L', packSizeUnits: 6, unit: 'L', unitPrice: 15.00, onHandUnits: 8, parLevelUnits: 24, onOrderUnits: 0, paused: false },
  { id: 'sku-044', supplierId: 'macro', name: 'Tonic Water', category: 'Beverages', packSize: '24×200ml', packSizeUnits: 24, unit: 'bottles', unitPrice: 18.00, onHandUnits: 20, parLevelUnits: 72, onOrderUnits: 0, paused: false },
  { id: 'sku-045', supplierId: 'bidfood', name: 'Ginger Beer', category: 'Beverages', packSize: '12×330ml', packSizeUnits: 12, unit: 'cans', unitPrice: 14.00, onHandUnits: 12, parLevelUnits: 48, onOrderUnits: 0, paused: false },
  
  // Bakery
  { id: 'sku-050', supplierId: 'macro', name: 'Burger Buns', category: 'Bakery', packSize: '48 units', packSizeUnits: 48, unit: 'units', unitPrice: 12.00, onHandUnits: 32, parLevelUnits: 96, onOrderUnits: 0, paused: false },
  { id: 'sku-051', supplierId: 'macro', name: 'Sourdough Loaf', category: 'Bakery', packSize: '6 loaves', packSizeUnits: 6, unit: 'loaves', unitPrice: 15.00, onHandUnits: 4, parLevelUnits: 18, onOrderUnits: 0, paused: false },
  { id: 'sku-052', supplierId: 'sysco', name: 'Croissants Frozen', category: 'Bakery', packSize: '30 units', packSizeUnits: 30, unit: 'units', unitPrice: 18.00, onHandUnits: 20, parLevelUnits: 60, onOrderUnits: 0, paused: false },
  { id: 'sku-053', supplierId: 'macro', name: 'Tortilla Wraps 12"', category: 'Bakery', packSize: '18 units', packSizeUnits: 18, unit: 'units', unitPrice: 8.50, onHandUnits: 12, parLevelUnits: 36, onOrderUnits: 0, paused: false },
  
  // Condiments & Sauces
  { id: 'sku-060', supplierId: 'macro', name: 'Mayonnaise', category: 'Condiments', packSize: '1×5L', packSizeUnits: 5, unit: 'L', unitPrice: 12.00, onHandUnits: 3, parLevelUnits: 10, onOrderUnits: 0, paused: false },
  { id: 'sku-061', supplierId: 'macro', name: 'Ketchup', category: 'Condiments', packSize: '1×4.5kg', packSizeUnits: 4.5, unit: 'kg', unitPrice: 10.00, onHandUnits: 2, parLevelUnits: 9, onOrderUnits: 0, paused: false },
  { id: 'sku-062', supplierId: 'bidfood', name: 'Soy Sauce', category: 'Condiments', packSize: '1×1.8L', packSizeUnits: 1.8, unit: 'L', unitPrice: 8.50, onHandUnits: 1, parLevelUnits: 5.4, onOrderUnits: 0, paused: false },
  { id: 'sku-063', supplierId: 'macro', name: 'Balsamic Vinegar', category: 'Condiments', packSize: '1×1L', packSizeUnits: 1, unit: 'L', unitPrice: 14.00, onHandUnits: 0.5, parLevelUnits: 3, onOrderUnits: 0, paused: false },
  { id: 'sku-064', supplierId: 'macro', name: 'Dijon Mustard', category: 'Condiments', packSize: '1×2kg', packSizeUnits: 2, unit: 'kg', unitPrice: 11.00, onHandUnits: 1, parLevelUnits: 4, onOrderUnits: 0, paused: true, pauseReason: 'Seasonal item - out of stock until March' },
];

// Generate realistic forecast data based on horizon
const generateForecastUsage = (days: number = 30): number[] => {
  const baseUsage = Math.floor(Math.random() * 6) + 2;
  return Array.from({ length: days }, () => {
    const variance = (Math.random() - 0.5) * 4;
    return Math.max(1, Math.round(baseUsage + variance));
  });
};

// Utility functions
function getNextDeliveryDate(supplier: Supplier, orderDate: Date): Date {
  const cutoffTime = setMinutes(setHours(orderDate, supplier.cutoffHour), supplier.cutoffMinute);
  let checkDate = isAfter(orderDate, cutoffTime) 
    ? addDays(orderDate, supplier.leadTimeDays + 1)
    : addDays(orderDate, supplier.leadTimeDays);
  
  for (let i = 0; i < 14; i++) {
    const dayOfWeek = getDay(checkDate);
    if (supplier.deliveryDays.includes(dayOfWeek)) {
      return checkDate;
    }
    checkDate = addDays(checkDate, 1);
  }
  return checkDate;
}

// Calculate recommendation with full breakdown
export function calculateRecommendation(
  sku: IngredientSku,
  horizonDays: number,
  settings: RecommendationSettings
): RecommendationBreakdown {
  // Sum forecast for the horizon
  const forecastUsage = sku.forecastDailyUsage
    .slice(0, horizonDays)
    .reduce((sum, usage) => sum + usage, 0);
  
  // Adjusted forecast = (ForecastUsage * (1 + WasteFactor)) / YieldFactor
  const adjustedForecast = (forecastUsage * (1 + sku.wasteFactor)) / sku.yieldFactor;
  
  // Safety stock = 15% of forecast (if enabled)
  const safetyStock = settings.includeSafetyStock 
    ? forecastUsage * sku.safetyStockPct 
    : 0;
  
  // Net needed = Adjusted + Safety - (OnHand + OnOrder)
  const netNeeded = adjustedForecast + safetyStock - (sku.onHandUnits + sku.onOrderUnits);
  const recommendedUnits = Math.max(0, netNeeded);
  
  // Round to packs if enabled
  let recommendedPacks: number;
  if (settings.roundToPacks) {
    recommendedPacks = Math.ceil(recommendedUnits / sku.packSizeUnits);
  } else {
    recommendedPacks = recommendedUnits / sku.packSizeUnits;
  }
  
  return {
    forecastUsage,
    adjustedForecast,
    safetyStock,
    onHand: sku.onHandUnits,
    onOrder: sku.onOrderUnits,
    netNeeded: Math.max(0, netNeeded),
    recommendedUnits,
    recommendedPacks: Math.max(0, recommendedPacks),
    wasteFactor: sku.wasteFactor,
    yieldFactor: sku.yieldFactor,
    safetyStockPct: sku.safetyStockPct,
  };
}

function calculateRecommendedPacks(
  sku: IngredientSku,
  horizonDays: number,
  settings: RecommendationSettings
): number {
  const breakdown = calculateRecommendation(sku, horizonDays, settings);
  return breakdown.recommendedPacks;
}

function getCoverageEndDate(
  cart: Map<string, number>,
  skus: IngredientSku[],
  orderDate: Date
): Date {
  if (cart.size === 0) return orderDate;
  
  let minCoverageDays = 30;
  
  cart.forEach((packs, skuId) => {
    const sku = skus.find(s => s.id === skuId);
    if (!sku || packs === 0) return;
    
    const totalUnits = sku.onHandUnits + sku.onOrderUnits + (packs * sku.packSizeUnits);
    let remainingUnits = totalUnits;
    let coverageDays = 0;
    
    for (const dailyUsage of sku.forecastDailyUsage) {
      if (remainingUnits >= dailyUsage) {
        remainingUnits -= dailyUsage;
        coverageDays++;
      } else {
        break;
      }
    }
    
    minCoverageDays = Math.min(minCoverageDays, coverageDays);
  });
  
  return addDays(orderDate, minCoverageDays);
}

// Default category settings
const DEFAULT_CATEGORY_SETTINGS: CategorySettingsMap = {
  'Produce': { wasteFactor: 0.06, safetyStockPct: 0.15, yieldFactor: 1.0 },
  'Proteins': { wasteFactor: 0.05, safetyStockPct: 0.15, yieldFactor: 1.0 },
  'Dairy': { wasteFactor: 0.03, safetyStockPct: 0.15, yieldFactor: 1.0 },
  'Dry Goods': { wasteFactor: 0.01, safetyStockPct: 0.10, yieldFactor: 1.0 },
  'Beverages': { wasteFactor: 0.01, safetyStockPct: 0.10, yieldFactor: 1.0 },
  'Bakery': { wasteFactor: 0.04, safetyStockPct: 0.20, yieldFactor: 1.0 },
  'Condiments': { wasteFactor: 0.02, safetyStockPct: 0.10, yieldFactor: 1.0 },
  'food': { wasteFactor: 0.04, safetyStockPct: 0.15, yieldFactor: 1.0 },
  'beverage': { wasteFactor: 0.02, safetyStockPct: 0.10, yieldFactor: 1.0 },
};

// Map database category to procurement category
function mapDbCategoryToProcurement(category: string | null): string {
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
  // For "food" or other generic categories
  if (lowerCategory === 'food') {
    return 'Dry Goods';
  }
  return category.charAt(0).toUpperCase() + category.slice(1);
}

// Main hook
export function useProcurementData() {
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('macro');
  const [orderDate, setOrderDate] = useState<Date>(new Date());
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [isCalculating, setIsCalculating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasRealData, setHasRealData] = useState(false);
  const [recommendationSettings, setRecommendationSettings] = useState<RecommendationSettings>({
    horizon: 7,
    includeSafetyStock: true,
    roundToPacks: true,
  });
  const [categorySettings, setCategorySettings] = useState<CategorySettingsMap>(DEFAULT_CATEGORY_SETTINGS);
  
  // State for real inventory data from Supabase
  const [realInventoryItems, setRealInventoryItems] = useState<IngredientSku[]>([]);

  const suppliers = SEED_SUPPLIERS;

  // Fetch real inventory data from Supabase
  useEffect(() => {
    async function fetchInventoryData() {
      setIsLoading(true);
      try {
        // Fetch inventory items
        const { data: inventoryData, error: inventoryError } = await supabase
          .from('inventory_items')
          .select('*')
          .order('name');

        if (inventoryError) {
          console.error('Error fetching inventory items:', inventoryError);
          setHasRealData(false);
          setIsLoading(false);
          return;
        }

        if (!inventoryData || inventoryData.length === 0) {
          console.log('No inventory data found, using demo data');
          setHasRealData(false);
          setIsLoading(false);
          return;
        }

        // Fetch pending purchase order lines to calculate on-order quantities
        const { data: poData } = await supabase
          .from('purchase_orders')
          .select(`
            id,
            status,
            purchase_order_lines (
              inventory_item_id,
              quantity
            )
          `)
          .in('status', ['draft', 'sent']);

        // Calculate on-order quantities per inventory item
        const onOrderMap = new Map<string, number>();
        if (poData) {
          poData.forEach(po => {
            if (po.purchase_order_lines) {
              po.purchase_order_lines.forEach((line: { inventory_item_id: string; quantity: number }) => {
                const current = onOrderMap.get(line.inventory_item_id) || 0;
                onOrderMap.set(line.inventory_item_id, current + (line.quantity || 0));
              });
            }
          });
        }

        // Convert inventory items to IngredientSku format
        const skusFromDb: IngredientSku[] = inventoryData.map((item, index) => {
          const category = mapDbCategoryToProcurement(item.category);
          const wasteFactor = CATEGORY_WASTE_FACTORS[category] || CATEGORY_WASTE_FACTORS[item.category || ''] || 0.03;
          // Assign to different suppliers for variety
          const supplierIndex = index % suppliers.length;
          const supplier = suppliers[supplierIndex];
          
          // Generate realistic pack size based on unit
          const unit = item.unit || 'kg';
          let packSizeUnits = 1;
          let packSize = `1×1${unit}`;
          
          if (unit === 'kg' || unit === 'L') {
            packSizeUnits = 5;
            packSize = `1×5${unit}`;
          } else if (unit === 'units' || unit === 'ea') {
            packSizeUnits = 12;
            packSize = `12 units`;
          }

          // Calculate price based on last_cost or generate realistic one
          const basePrice = item.last_cost || (Math.random() * 30 + 5);
          const unitPrice = Number((basePrice * packSizeUnits).toFixed(2));
          
          return {
            id: `db-${item.id}`,
            inventoryItemId: item.id,
            supplierId: supplier.id,
            name: item.name,
            category,
            packSize,
            packSizeUnits,
            unit,
            unitPrice,
            onHandUnits: item.current_stock || 0,
            parLevelUnits: item.par_level || packSizeUnits * 5,
            onOrderUnits: onOrderMap.get(item.id) || 0,
            forecastDailyUsage: generateForecastUsage(30),
            paused: false,
            wasteFactor,
            yieldFactor: 1.0,
            safetyStockPct: 0.15,
            isRealData: true,
          };
        });

        setRealInventoryItems(skusFromDb);
        setHasRealData(true);
        console.log(`Loaded ${skusFromDb.length} inventory items from database`);
      } catch (error) {
        console.error('Error in fetchInventoryData:', error);
        setHasRealData(false);
      }
      setIsLoading(false);
    }

    fetchInventoryData();
  }, [suppliers]);

  // Combine real data with seed data (prioritize real data)
  const allSkus = useMemo(() => {
    if (hasRealData && realInventoryItems.length > 0) {
      // Use real data primarily, but keep seed data for suppliers without real inventory
      const seedSkusWithForecast: IngredientSku[] = SEED_SKUS.map(sku => ({
        ...sku,
        forecastDailyUsage: generateForecastUsage(30),
        wasteFactor: CATEGORY_WASTE_FACTORS[sku.category] || 0.02,
        yieldFactor: 1.0,
        safetyStockPct: 0.15,
        isRealData: false,
      }));
      
      // Combine: real items first, then seed items (for variety in demo)
      return [...realInventoryItems, ...seedSkusWithForecast];
    }
    
    // Fallback to seed data
    return SEED_SKUS.map(sku => ({
      ...sku,
      forecastDailyUsage: generateForecastUsage(30),
      paused: sku.id === 'sku-064',
      wasteFactor: CATEGORY_WASTE_FACTORS[sku.category] || 0.02,
      yieldFactor: 1.0,
      safetyStockPct: 0.15,
      isRealData: false,
    }));
  }, [hasRealData, realInventoryItems]);

  const selectedSupplier = useMemo(
    () => suppliers.find(s => s.id === selectedSupplierId) || suppliers[0],
    [selectedSupplierId]
  );

  const deliveryDate = useMemo(
    () => getNextDeliveryDate(selectedSupplier, orderDate),
    [selectedSupplier, orderDate]
  );

  // Compute SKUs with applied category settings
  const skusWithCategorySettings = useMemo(() => {
    return allSkus.map(sku => {
      const catSettings = categorySettings[sku.category];
      if (catSettings) {
        return {
          ...sku,
          wasteFactor: catSettings.wasteFactor,
          safetyStockPct: catSettings.safetyStockPct,
          yieldFactor: catSettings.yieldFactor,
        };
      }
      return sku;
    });
  }, [allSkus, categorySettings]);

  const filteredSkus = useMemo(() => {
    const supplierSkus = skusWithCategorySettings.filter(sku => sku.supplierId === selectedSupplierId);
    if (!searchQuery.trim()) return supplierSkus;
    const query = searchQuery.toLowerCase();
    return supplierSkus.filter(sku => 
      sku.name.toLowerCase().includes(query) ||
      sku.category.toLowerCase().includes(query)
    );
  }, [selectedSupplierId, searchQuery, skusWithCategorySettings]);

  const categories = useMemo(() => {
    const cats = new Set(filteredSkus.map(s => s.category));
    return Array.from(cats).sort();
  }, [filteredSkus]);

  // AI Recommend function with loading state
  const aiRecommend = useCallback(async () => {
    setIsCalculating(true);
    
    // Simulate AI calculation delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const newCart = new Map<string, number>();
    const supplierSkus = skusWithCategorySettings.filter(sku => sku.supplierId === selectedSupplierId);
    
    supplierSkus.forEach(sku => {
      if (sku.paused) return;
      const recommended = calculateRecommendedPacks(sku, recommendationSettings.horizon, recommendationSettings);
      if (recommended > 0) {
        newCart.set(sku.id, recommended);
      }
    });
    
    setCart(newCart);
    setIsCalculating(false);
  }, [selectedSupplierId, recommendationSettings, skusWithCategorySettings]);

  // Legacy autofill (quick, no delay)
  const autofillCart = useCallback(() => {
    const newCart = new Map<string, number>();
    const supplierSkus = skusWithCategorySettings.filter(sku => sku.supplierId === selectedSupplierId);
    
    supplierSkus.forEach(sku => {
      if (sku.paused) return;
      const recommended = calculateRecommendedPacks(sku, recommendationSettings.horizon, recommendationSettings);
      if (recommended > 0) {
        newCart.set(sku.id, recommended);
      }
    });
    
    setCart(newCart);
  }, [selectedSupplierId, recommendationSettings, skusWithCategorySettings]);

  const updateCartItem = useCallback((skuId: string, packs: number) => {
    setCart(prev => {
      const newCart = new Map(prev);
      if (packs <= 0) {
        newCart.delete(skuId);
      } else {
        newCart.set(skuId, packs);
      }
      return newCart;
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart(new Map());
  }, []);

  const getRecommendedPacks = useCallback((sku: IngredientSku) => {
    return calculateRecommendedPacks(sku, recommendationSettings.horizon, recommendationSettings);
  }, [recommendationSettings]);

  const getRecommendationBreakdown = useCallback((sku: IngredientSku) => {
    return calculateRecommendation(sku, recommendationSettings.horizon, recommendationSettings);
  }, [recommendationSettings]);

  const orderSummary = useMemo((): OrderSummary => {
    const items: { sku: IngredientSku; packs: number }[] = [];
    let subtotal = 0;
    
    cart.forEach((packs, skuId) => {
      const sku = allSkus.find(s => s.id === skuId);
      if (sku && packs > 0) {
        items.push({ sku, packs });
        subtotal += packs * sku.unitPrice;
      }
    });
    
    const meetsMinOrder = subtotal >= selectedSupplier.minOrder;
    const deliveryFee = meetsMinOrder ? 0 : selectedSupplier.deliveryFee;
    const tax = subtotal * 0.21;
    const total = subtotal + deliveryFee + tax;
    const coverageEndDate = getCoverageEndDate(cart, allSkus, orderDate);
    const minOrderProgress = Math.min(100, (subtotal / selectedSupplier.minOrder) * 100);
    
    return {
      supplierId: selectedSupplier.id,
      supplierName: selectedSupplier.name,
      deliveryDate,
      coverageEndDate,
      items,
      subtotal,
      deliveryFee,
      tax,
      total,
      minOrder: selectedSupplier.minOrder,
      minOrderProgress,
    };
  }, [cart, allSkus, selectedSupplier, deliveryDate, orderDate]);

  const dayLabels = useMemo(() => {
    const labels: string[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(orderDate, i);
      labels.push(i === 0 ? 'Today' : format(date, 'EEE'));
    }
    return labels;
  }, [orderDate]);

  const cutoffInfo = useMemo(() => {
    const cutoffTime = setMinutes(setHours(orderDate, selectedSupplier.cutoffHour), selectedSupplier.cutoffMinute);
    const isBeforeCutoff = isBefore(new Date(), cutoffTime);
    const cutoffDay = format(orderDate, 'EEEE (d MMMM)');
    return {
      isBeforeCutoff,
      cutoffTimeStr: format(cutoffTime, 'HH:mm'),
      cutoffDay,
      deliveryDateStr: format(deliveryDate, 'd MMMM'),
    };
  }, [selectedSupplier, orderDate, deliveryDate]);

  const deliveryDaysLabel = useMemo(() => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return selectedSupplier.deliveryDays.map(d => dayNames[d]).join(', ');
  }, [selectedSupplier]);

  return {
    // Data
    suppliers,
    selectedSupplier,
    selectedSupplierId,
    setSelectedSupplierId,
    filteredSkus,
    categories,
    allSkus: skusWithCategorySettings,
    
    // Date & delivery
    orderDate,
    setOrderDate,
    deliveryDate,
    cutoffInfo,
    deliveryDaysLabel,
    dayLabels,
    
    // Cart
    cart,
    updateCartItem,
    clearCart,
    autofillCart,
    aiRecommend,
    getRecommendedPacks,
    getRecommendationBreakdown,
    orderSummary,
    
    // AI Recommendation
    isCalculating,
    recommendationSettings,
    setRecommendationSettings,
    
    // Category settings
    categorySettings,
    setCategorySettings,
    
    // Search
    searchQuery,
    setSearchQuery,
    
    // Loading state
    isLoading,
    hasRealData,
  };
}
