/**
 * useWastePrepOptimization — analyzes end-of-day and overproduction waste
 * to suggest prep list adjustments.
 *
 * Logic: Items with high end_of_day / over_production waste are being
 * over-prepared. We calculate implied waste ratio and suggest reductions.
 */

import { useMemo } from 'react';
import { REASON_LABELS } from './useWasteData';
import type { WasteReason } from './useWasteData';

// ── Types ──

export interface PrepSuggestion {
  itemId: string;
  itemName: string;
  currentWaste: number;         // € wasted from overproduction/end-of-day
  wasteCount: number;           // number of events
  dominantReason: WasteReason;
  dominantReasonLabel: string;
  suggestedReductionPct: number; // % to reduce prep
  expectedSaving: number;       // € estimated saving
  confidence: 'high' | 'medium' | 'low';
  avgWastePerEvent: number;     // € average per event
  daysWithWaste: number;        // how many distinct days had waste
}

export interface PrepOptimizationResult {
  suggestions: PrepSuggestion[];
  totalPotentialSaving: number;
  itemsAnalyzed: number;
  isReliable: boolean;
}

// ── Overproduction-related reasons ──
const OVERPRODUCTION_REASONS: WasteReason[] = ['end_of_day', 'over_production'];

// ── Hook ──

interface WasteEvent {
  waste_value: number;
  reason: string | null;
  created_at: string;
  inventory_item_id?: string;
  inventory_items?: { name?: string; category_name?: string } | null;
}

export function useWastePrepOptimization(
  wasteEvents: WasteEvent[],
  totalSales: number = 0,
): PrepOptimizationResult {
  return useMemo(() => {
    if (wasteEvents.length < 10) {
      return { suggestions: [], totalPotentialSaving: 0, itemsAnalyzed: 0, isReliable: false };
    }

    // Step 1: Filter overproduction-related events
    const overProdEvents = wasteEvents.filter(e => {
      const reason = (e.reason || '').toLowerCase();
      return OVERPRODUCTION_REASONS.some(r => reason.includes(r)) ||
        reason.includes('end_of_day') ||
        reason.includes('over_production') ||
        reason.includes('sobreproducción') ||
        reason.includes('fin de');
    });

    if (overProdEvents.length < 3) {
      return { suggestions: [], totalPotentialSaving: 0, itemsAnalyzed: 0, isReliable: false };
    }

    // Step 2: Group by item
    const itemMap = new Map<string, {
      name: string;
      totalWaste: number;
      count: number;
      reasons: Map<string, number>;
      uniqueDays: Set<string>;
    }>();

    overProdEvents.forEach(event => {
      const itemId = event.inventory_item_id || 'unknown';
      if (itemId === 'unknown') return;
      const itemName = event.inventory_items?.name || 'Desconocido';
      const reason = event.reason || 'other';
      const dateStr = event.created_at.slice(0, 10);

      const existing = itemMap.get(itemId) || {
        name: itemName,
        totalWaste: 0,
        count: 0,
        reasons: new Map(),
        uniqueDays: new Set(),
      };

      existing.totalWaste += event.waste_value || 0;
      existing.count += 1;
      existing.reasons.set(reason, (existing.reasons.get(reason) || 0) + (event.waste_value || 0));
      existing.uniqueDays.add(dateStr);
      itemMap.set(itemId, existing);
    });

    // Step 3: Generate suggestions for items with significant overproduction
    const suggestions: PrepSuggestion[] = [];

    itemMap.forEach((data, itemId) => {
      // Only suggest for items with meaningful waste (≥3 events or ≥€30)
      if (data.count < 3 && data.totalWaste < 30) return;

      // Find dominant reason
      let dominantReason: WasteReason = 'end_of_day';
      let maxReasonValue = 0;
      data.reasons.forEach((val, reason) => {
        if (val > maxReasonValue) {
          maxReasonValue = val;
          dominantReason = reason as WasteReason;
        }
      });

      const avgWastePerEvent = data.totalWaste / data.count;
      const daysWithWaste = data.uniqueDays.size;

      // Calculate suggested reduction:
      // - High frequency + high value = suggest 20-30% reduction
      // - Medium frequency = suggest 10-20% reduction
      // - Low frequency but notable value = suggest 5-10%
      let suggestedReductionPct: number;
      let confidence: PrepSuggestion['confidence'];

      if (daysWithWaste >= 10 && avgWastePerEvent > 15) {
        suggestedReductionPct = 25;
        confidence = 'high';
      } else if (daysWithWaste >= 5 || data.totalWaste > 100) {
        suggestedReductionPct = 15;
        confidence = 'medium';
      } else {
        suggestedReductionPct = 10;
        confidence = 'low';
      }

      // Expected saving: assume reducing prep by X% reduces overproduction waste by ~60% of that
      const expectedSaving = data.totalWaste * (suggestedReductionPct / 100) * 0.6;

      const dominantReasonLabel = REASON_LABELS[dominantReason] || dominantReason;

      suggestions.push({
        itemId,
        itemName: data.name,
        currentWaste: data.totalWaste,
        wasteCount: data.count,
        dominantReason,
        dominantReasonLabel,
        suggestedReductionPct,
        expectedSaving,
        confidence,
        avgWastePerEvent,
        daysWithWaste,
      });
    });

    // Sort by expected saving descending
    suggestions.sort((a, b) => b.expectedSaving - a.expectedSaving);

    // Take top 8
    const topSuggestions = suggestions.slice(0, 8);
    const totalPotentialSaving = topSuggestions.reduce((s, item) => s + item.expectedSaving, 0);

    return {
      suggestions: topSuggestions,
      totalPotentialSaving,
      itemsAnalyzed: itemMap.size,
      isReliable: overProdEvents.length >= 10,
    };
  }, [wasteEvents, totalSales]);
}
