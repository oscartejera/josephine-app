/**
 * useWasteSupplierScore — analyzes waste by supplier to detect
 * which suppliers have higher spoilage, breakage, or expiry rates.
 */

import { useMemo } from 'react';
import { REASON_LABELS } from './useWasteData';
import type { WasteReason } from './useWasteData';

// ── Types ──

export interface SupplierScore {
  supplierName: string;
  totalWaste: number;
  totalCount: number;
  expiryValue: number;
  brokenValue: number;
  spillageValue: number;
  otherValue: number;
  expiryPct: number;   // % of this supplier's waste that is expiry
  brokenPct: number;
  itemCount: number;    // unique items from this supplier
  topItem: string;      // item with most waste from this supplier
  score: number;        // 0-100 (100 = best, 0 = worst)
  grade: 'A' | 'B' | 'C' | 'D';
}

export interface SupplierScoreResult {
  suppliers: SupplierScore[];
  avgScore: number;
  worstSupplier: string | null;
  bestSupplier: string | null;
  isReliable: boolean;
}

// ── Quality-degrading reasons ──
const QUALITY_REASONS: WasteReason[] = ['expiry', 'expired', 'broken', 'spillage'];

// ── Hook ──

interface WasteEvent {
  waste_value: number;
  reason: string | null;
  created_at: string;
  inventory_item_id?: string;
  inventory_items?: {
    name?: string;
    category_name?: string;
    supplier_name?: string;
  } | null;
}

export function useWasteSupplierScore(wasteEvents: WasteEvent[]): SupplierScoreResult {
  return useMemo(() => {
    if (wasteEvents.length < 5) {
      return { suppliers: [], avgScore: 0, worstSupplier: null, bestSupplier: null, isReliable: false };
    }

    // Step 1: Group by supplier
    const supplierMap = new Map<string, {
      totalWaste: number;
      totalCount: number;
      expiryValue: number;
      brokenValue: number;
      spillageValue: number;
      otherValue: number;
      items: Set<string>;
      itemWaste: Map<string, { name: string; value: number }>;
    }>();

    wasteEvents.forEach(event => {
      const supplier = event.inventory_items?.supplier_name;
      if (!supplier) return;

      const val = event.waste_value || 0;
      const reason = (event.reason || 'other').toLowerCase();
      const itemId = event.inventory_item_id || 'unknown';
      const itemName = event.inventory_items?.name || 'Desconocido';

      const existing = supplierMap.get(supplier) || {
        totalWaste: 0,
        totalCount: 0,
        expiryValue: 0,
        brokenValue: 0,
        spillageValue: 0,
        otherValue: 0,
        items: new Set<string>(),
        itemWaste: new Map(),
      };

      existing.totalWaste += val;
      existing.totalCount += 1;
      existing.items.add(itemId);

      // Track per-item waste
      const itemEntry = existing.itemWaste.get(itemId) || { name: itemName, value: 0 };
      itemEntry.value += val;
      existing.itemWaste.set(itemId, itemEntry);

      // Categorize by reason
      if (reason.includes('expir') || reason === 'expired') {
        existing.expiryValue += val;
      } else if (reason === 'broken') {
        existing.brokenValue += val;
      } else if (reason === 'spillage') {
        existing.spillageValue += val;
      } else {
        existing.otherValue += val;
      }

      supplierMap.set(supplier, existing);
    });

    if (supplierMap.size === 0) {
      return { suppliers: [], avgScore: 0, worstSupplier: null, bestSupplier: null, isReliable: false };
    }

    // Step 2: Calculate scores
    // Score = 100 - penalty
    // Penalty based on: quality-related waste ratio, absolute total, consistency
    const maxWaste = Math.max(...Array.from(supplierMap.values()).map(s => s.totalWaste));

    const suppliers: SupplierScore[] = [];

    supplierMap.forEach((data, supplierName) => {
      const qualityWaste = data.expiryValue + data.brokenValue + data.spillageValue;
      const qualityRatio = data.totalWaste > 0 ? qualityWaste / data.totalWaste : 0;
      const volumePenalty = maxWaste > 0 ? (data.totalWaste / maxWaste) * 40 : 0;
      const qualityPenalty = qualityRatio * 40;
      const frequencyPenalty = Math.min(data.totalCount / 20, 1) * 20;

      const rawScore = Math.max(0, 100 - volumePenalty - qualityPenalty - frequencyPenalty);
      const score = Math.round(rawScore);

      const grade: SupplierScore['grade'] =
        score >= 75 ? 'A' :
        score >= 50 ? 'B' :
        score >= 25 ? 'C' : 'D';

      // Find top item
      let topItem = 'N/A';
      let topItemValue = 0;
      data.itemWaste.forEach((item) => {
        if (item.value > topItemValue) {
          topItemValue = item.value;
          topItem = item.name;
        }
      });

      suppliers.push({
        supplierName,
        totalWaste: data.totalWaste,
        totalCount: data.totalCount,
        expiryValue: data.expiryValue,
        brokenValue: data.brokenValue,
        spillageValue: data.spillageValue,
        otherValue: data.otherValue,
        expiryPct: data.totalWaste > 0 ? (data.expiryValue / data.totalWaste) * 100 : 0,
        brokenPct: data.totalWaste > 0 ? (data.brokenValue / data.totalWaste) * 100 : 0,
        itemCount: data.items.size,
        topItem,
        score,
        grade,
      });
    });

    // Sort by score ascending (worst first)
    suppliers.sort((a, b) => a.score - b.score);

    const avgScore = suppliers.length > 0
      ? Math.round(suppliers.reduce((s, sup) => s + sup.score, 0) / suppliers.length)
      : 0;

    return {
      suppliers,
      avgScore,
      worstSupplier: suppliers.length > 0 ? suppliers[0].supplierName : null,
      bestSupplier: suppliers.length > 0 ? suppliers[suppliers.length - 1].supplierName : null,
      isReliable: wasteEvents.length >= 20 && supplierMap.size >= 2,
    };
  }, [wasteEvents]);
}
