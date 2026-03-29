/**
 * useWasteVariance — Automatic Variance Analysis
 * Compares theoretical food cost (from escandallos/recipes)
 * with actual food cost (theoretical + waste) per category
 * to identify where waste has the most financial impact.
 */

import { useMemo } from 'react';

// ── Types ──

export interface VarianceRow {
  category: string;
  theoreticalCost: number;     // € from recipes
  wasteCost: number;           // € from waste_events
  actualCost: number;          // theoretical + waste
  varianceAmount: number;      // wasteCost
  variancePercent: number;     // waste as % of theoretical
  salesPercent: number;        // waste as % of total sales
  impact: 'critical' | 'warning' | 'acceptable';
  topWasteReason: string;
  topWasteReasonLabel: string;
}

export interface VarianceResult {
  rows: VarianceRow[];
  totalTheoretical: number;
  totalActual: number;
  totalVariance: number;
  totalVariancePercent: number;
  potentialSaving: number;      // if we reduce variance to best-category level
  isAvailable: boolean;
}

// ── Constants ──

const REASON_LABELS: Record<string, string> = {
  spillage: 'Derrame',
  expiry: 'Caducidad',
  kitchen_error: 'Error cocina',
  courtesy: 'Cortesía',
  broken: 'Rotura',
  end_of_day: 'Fin de día',
  over_production: 'Sobreproducción',
  plate_waste: 'Resto de plato',
  expired: 'Producto vencido',
  theft: 'Robo/Consumo',
  other: 'Otros',
};

// Approximate theoretical cost ratios by category (from industry data)
// These will be overridden by actual recipe data when available
const CATEGORY_COGS_RATIO: Record<string, number> = {
  'Proteínas': 0.35,
  'Proteinas': 0.35,
  'Verduras': 0.25,
  'Lácteos': 0.28,
  'Lacteos': 0.28,
  'Secos': 0.20,
  'Bebidas': 0.22,
  'Postres': 0.25,
  'Mariscos': 0.38,
};

// ── Hook ──

interface WasteEvent {
  waste_value: number;
  reason: string | null;
  inventory_items?: { name?: string; category_name?: string } | null;
}

export function useWasteVariance(
  wasteEvents: WasteEvent[],
  totalSales: number,
): VarianceResult {
  return useMemo(() => {
    if (wasteEvents.length < 5 || totalSales <= 0) {
      return {
        rows: [],
        totalTheoretical: 0,
        totalActual: 0,
        totalVariance: 0,
        totalVariancePercent: 0,
        potentialSaving: 0,
        isAvailable: false,
      };
    }

    // Group waste by category
    const catMap = new Map<string, {
      wasteCost: number;
      reasons: Map<string, number>;
    }>();

    wasteEvents.forEach(event => {
      const category = (event.inventory_items as any)?.category_name || 'Otros';
      const value = event.waste_value || 0;
      const reason = event.reason || 'other';

      const existing = catMap.get(category) || {
        wasteCost: 0,
        reasons: new Map(),
      };
      existing.wasteCost += value;
      existing.reasons.set(reason, (existing.reasons.get(reason) || 0) + value);
      catMap.set(category, existing);
    });

    // Build variance rows
    const rows: VarianceRow[] = [];
    let totalTheoretical = 0;
    let totalActual = 0;
    let totalVariance = 0;

    catMap.forEach((data, category) => {
      // Estimate theoretical cost for this category
      const cogsRatio = CATEGORY_COGS_RATIO[category] || 0.30;
      // Approximate category sales as proportional allocation
      const catSalesShare = data.wasteCost / wasteEvents.reduce((s, e) => s + (e.waste_value || 0), 0);
      const catSales = totalSales * catSalesShare;
      const theoreticalCost = catSales * cogsRatio;

      const actualCost = theoreticalCost + data.wasteCost;
      const variancePercent = theoreticalCost > 0
        ? (data.wasteCost / theoreticalCost) * 100
        : 0;
      const salesPercent = totalSales > 0
        ? (data.wasteCost / totalSales) * 100
        : 0;

      // Find top waste reason
      let topReason = 'other';
      let maxReasonVal = 0;
      data.reasons.forEach((val, reason) => {
        if (val > maxReasonVal) {
          maxReasonVal = val;
          topReason = reason;
        }
      });

      // Impact classification
      let impact: VarianceRow['impact'] = 'acceptable';
      if (variancePercent > 15) impact = 'critical';
      else if (variancePercent > 8) impact = 'warning';

      rows.push({
        category,
        theoreticalCost,
        wasteCost: data.wasteCost,
        actualCost,
        varianceAmount: data.wasteCost,
        variancePercent,
        salesPercent,
        impact,
        topWasteReason: topReason,
        topWasteReasonLabel: REASON_LABELS[topReason] || topReason,
      });

      totalTheoretical += theoreticalCost;
      totalActual += actualCost;
      totalVariance += data.wasteCost;
    });

    // Sort by variance amount descending
    rows.sort((a, b) => b.varianceAmount - a.varianceAmount);

    // Calculate potential saving (if all categories match the best performer)
    const bestVariancePct = rows.length > 0
      ? Math.min(...rows.filter(r => r.variancePercent > 0).map(r => r.variancePercent))
      : 0;
    const potentialSaving = rows.reduce((sum, r) => {
      const excessVariance = r.variancePercent - bestVariancePct;
      if (excessVariance <= 0) return sum;
      return sum + (r.theoreticalCost * excessVariance / 100);
    }, 0);

    return {
      rows,
      totalTheoretical,
      totalActual,
      totalVariance,
      totalVariancePercent: totalTheoretical > 0 ? (totalVariance / totalTheoretical) * 100 : 0,
      potentialSaving,
      isAvailable: rows.length >= 2,
    };
  }, [wasteEvents, totalSales]);
}
