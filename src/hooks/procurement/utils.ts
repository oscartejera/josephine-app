// Procurement module — utility functions and fallback data

import { addDays, isAfter, getDay, setHours, setMinutes } from 'date-fns';
import {
    Supplier,
    RecommendationSettings,
    RecommendationBreakdown,
    calculateRecommendation as calculateRecommendationBase,
} from '@/lib/procurementConstants';
import type { IngredientSku } from './types';

// ============= Fallback SKUs (for demo mode only) =============

export const FALLBACK_SKUS: Omit<IngredientSku, 'forecastDailyUsage' | 'wasteFactor' | 'yieldFactor' | 'safetyStockPct'>[] = [
    // Proteins
    { id: 'sku-001', supplierId: 'macro', name: 'Chicken Breast', category: 'Proteins', packSize: '1×5kg', packSizeUnits: 5, unit: 'kg', unitPrice: 42.50, onHandUnits: 8, parLevelUnits: 25, onOrderUnits: 0, paused: false },
    { id: 'sku-002', supplierId: 'macro', name: 'Beef Mince 80/20', category: 'Proteins', packSize: '1×3kg', packSizeUnits: 3, unit: 'kg', unitPrice: 28.90, onHandUnits: 4, parLevelUnits: 15, onOrderUnits: 0, paused: false },
    { id: 'sku-003', supplierId: 'macro', name: 'Salmon Fillet', category: 'Proteins', packSize: '1×2kg', packSizeUnits: 2, unit: 'kg', unitPrice: 38.00, onHandUnits: 2, parLevelUnits: 10, onOrderUnits: 0, paused: false },
    { id: 'sku-005', supplierId: 'sysco', name: 'Lamb Leg Boneless', category: 'Proteins', packSize: '1×3kg', packSizeUnits: 3, unit: 'kg', unitPrice: 52.00, onHandUnits: 3, parLevelUnits: 9, onOrderUnits: 0, paused: false },
    { id: 'sku-007', supplierId: 'bidfood', name: 'Prawns Tiger 16/20', category: 'Proteins', packSize: '1×1kg', packSizeUnits: 1, unit: 'kg', unitPrice: 18.90, onHandUnits: 2, parLevelUnits: 6, onOrderUnits: 0, paused: false },
    // Dairy
    { id: 'sku-010', supplierId: 'macro', name: 'Whole Milk', category: 'Dairy', packSize: '12×1L', packSizeUnits: 12, unit: 'L', unitPrice: 14.40, onHandUnits: 18, parLevelUnits: 48, onOrderUnits: 0, paused: false },
    { id: 'sku-011', supplierId: 'macro', name: 'Double Cream', category: 'Dairy', packSize: '6×1L', packSizeUnits: 6, unit: 'L', unitPrice: 18.00, onHandUnits: 4, parLevelUnits: 18, onOrderUnits: 0, paused: false },
    { id: 'sku-013', supplierId: 'sysco', name: 'Mozzarella Block', category: 'Dairy', packSize: '1×2.5kg', packSizeUnits: 2.5, unit: 'kg', unitPrice: 19.50, onHandUnits: 3, parLevelUnits: 10, onOrderUnits: 0, paused: false },
    { id: 'sku-016', supplierId: 'bidfood', name: 'Greek Yogurt', category: 'Dairy', packSize: '4×1kg', packSizeUnits: 4, unit: 'kg', unitPrice: 12.80, onHandUnits: 6, parLevelUnits: 16, onOrderUnits: 0, paused: false },
    // Produce
    { id: 'sku-020', supplierId: 'macro', name: 'Onions Brown', category: 'Produce', packSize: '1×10kg', packSizeUnits: 10, unit: 'kg', unitPrice: 8.50, onHandUnits: 12, parLevelUnits: 40, onOrderUnits: 0, paused: false },
    { id: 'sku-021', supplierId: 'macro', name: 'Tomatoes Vine', category: 'Produce', packSize: '1×5kg', packSizeUnits: 5, unit: 'kg', unitPrice: 12.00, onHandUnits: 4, parLevelUnits: 20, onOrderUnits: 0, paused: false },
    { id: 'sku-024', supplierId: 'sysco', name: 'Lettuce Romaine', category: 'Produce', packSize: '6 heads', packSizeUnits: 6, unit: 'heads', unitPrice: 9.00, onHandUnits: 4, parLevelUnits: 18, onOrderUnits: 0, paused: false },
    { id: 'sku-027', supplierId: 'bidfood', name: 'Avocados Hass', category: 'Produce', packSize: '20 units', packSizeUnits: 20, unit: 'units', unitPrice: 24.00, onHandUnits: 12, parLevelUnits: 40, onOrderUnits: 0, paused: false },
    // Dry Goods
    { id: 'sku-030', supplierId: 'macro', name: 'Pasta Penne', category: 'Dry Goods', packSize: '1×5kg', packSizeUnits: 5, unit: 'kg', unitPrice: 8.00, onHandUnits: 6, parLevelUnits: 20, onOrderUnits: 0, paused: false },
    { id: 'sku-031', supplierId: 'macro', name: 'Rice Basmati', category: 'Dry Goods', packSize: '1×10kg', packSizeUnits: 10, unit: 'kg', unitPrice: 22.00, onHandUnits: 8, parLevelUnits: 30, onOrderUnits: 0, paused: false },
    { id: 'sku-032', supplierId: 'sysco', name: 'Flour Plain', category: 'Dry Goods', packSize: '1×16kg', packSizeUnits: 16, unit: 'kg', unitPrice: 14.00, onHandUnits: 10, parLevelUnits: 48, onOrderUnits: 0, paused: false },
    { id: 'sku-036', supplierId: 'bidfood', name: 'Chickpeas Tinned', category: 'Dry Goods', packSize: '6×400g', packSizeUnits: 2.4, unit: 'kg', unitPrice: 6.00, onHandUnits: 3, parLevelUnits: 9.6, onOrderUnits: 0, paused: false },
    // Beverages
    { id: 'sku-040', supplierId: 'macro', name: 'Coca-Cola Classic', category: 'Beverages', packSize: '24×330ml', packSizeUnits: 24, unit: 'cans', unitPrice: 16.80, onHandUnits: 48, parLevelUnits: 120, onOrderUnits: 0, paused: false },
    { id: 'sku-042', supplierId: 'sysco', name: 'San Pellegrino', category: 'Beverages', packSize: '24×500ml', packSizeUnits: 24, unit: 'bottles', unitPrice: 24.00, onHandUnits: 24, parLevelUnits: 72, onOrderUnits: 0, paused: false },
    { id: 'sku-045', supplierId: 'bidfood', name: 'Ginger Beer', category: 'Beverages', packSize: '12×330ml', packSizeUnits: 12, unit: 'cans', unitPrice: 14.00, onHandUnits: 12, parLevelUnits: 48, onOrderUnits: 0, paused: false },
    // Bakery
    { id: 'sku-050', supplierId: 'macro', name: 'Burger Buns', category: 'Bakery', packSize: '48 units', packSizeUnits: 48, unit: 'units', unitPrice: 12.00, onHandUnits: 32, parLevelUnits: 96, onOrderUnits: 0, paused: false },
    { id: 'sku-052', supplierId: 'sysco', name: 'Croissants Frozen', category: 'Bakery', packSize: '30 units', packSizeUnits: 30, unit: 'units', unitPrice: 18.00, onHandUnits: 20, parLevelUnits: 60, onOrderUnits: 0, paused: false },
    // Condiments
    { id: 'sku-060', supplierId: 'macro', name: 'Mayonnaise', category: 'Condiments', packSize: '1×5L', packSizeUnits: 5, unit: 'L', unitPrice: 12.00, onHandUnits: 3, parLevelUnits: 10, onOrderUnits: 0, paused: false },
    { id: 'sku-062', supplierId: 'bidfood', name: 'Soy Sauce', category: 'Condiments', packSize: '1×1.8L', packSizeUnits: 1.8, unit: 'L', unitPrice: 8.50, onHandUnits: 1, parLevelUnits: 5.4, onOrderUnits: 0, paused: false },
];

// ============= Utility Functions =============

export function generateForecastUsage(days: number = 30, seed: string = ''): number[] {
    // Deterministic forecast based on seed — no Math.random
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
    const baseUsage = 2 + ((h >>> 0) % 6);
    return Array.from({ length: days }, (_, i) => {
        const v = Math.sin(h + i * 0.7) * 2;
        return Math.max(1, Math.round(baseUsage + v));
    });
}

export function getNextDeliveryDate(supplier: Supplier, orderDate: Date): Date {
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

/**
 * Calculate recommendation with full breakdown for a SKU
 * Uses the shared calculateRecommendation from procurementConstants
 */
export function calculateSkuRecommendation(
    sku: IngredientSku,
    horizonDays: number,
    settings: RecommendationSettings
): RecommendationBreakdown {
    const forecastUsage = sku.forecastDailyUsage
        .slice(0, horizonDays)
        .reduce((sum, usage) => sum + usage, 0);

    return calculateRecommendationBase(
        forecastUsage,
        sku.onHandUnits,
        sku.onOrderUnits,
        sku.packSizeUnits,
        { wasteFactor: sku.wasteFactor, safetyStockPct: sku.safetyStockPct, yieldFactor: sku.yieldFactor },
        settings.includeSafetyStock
    );
}

export function calculateRecommendedPacks(
    sku: IngredientSku,
    horizonDays: number,
    settings: RecommendationSettings
): number {
    const breakdown = calculateSkuRecommendation(sku, horizonDays, settings);
    return settings.roundToPacks ? breakdown.recommendedPacks : Math.ceil(breakdown.recommendedUnits / sku.packSizeUnits);
}

export function getCoverageEndDate(
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

/**
 * Convert database supplier to Supplier format
 */
export function dbSupplierToSupplier(dbSupplier: { id: string; name: string }, index: number): Supplier {
    // Generate reasonable defaults based on index for variety
    const deliveryConfigs = [
        { deliveryDays: [1, 2, 3, 4, 5, 6], cutoffHour: 17, leadTimeDays: 1 },
        { deliveryDays: [1, 3, 5], cutoffHour: 14, leadTimeDays: 2 },
        { deliveryDays: [2, 4], cutoffHour: 12, leadTimeDays: 2 },
        { deliveryDays: [1, 2, 3, 4, 5], cutoffHour: 16, leadTimeDays: 1 },
    ];
    const config = deliveryConfigs[index % deliveryConfigs.length];

    return {
        id: dbSupplier.id,
        name: dbSupplier.name,
        logo: dbSupplier.name.charAt(0).toUpperCase(),
        deliveryDays: config.deliveryDays,
        cutoffHour: config.cutoffHour,
        cutoffMinute: 0,
        leadTimeDays: config.leadTimeDays,
        minOrder: 100 + (index * 25),
        deliveryFee: 10 + (index * 2),
    };
}
