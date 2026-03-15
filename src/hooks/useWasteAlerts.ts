/**
 * useWasteAlerts — spike detection hook for waste metrics.
 *
 * Compares the current period's waste against a rolling average
 * and fires alerts when thresholds are exceeded.
 */

import { useMemo } from 'react';
import type { WasteMetrics, WasteByReason, WasteItem } from './useWasteData';

export interface WasteAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  metric?: string;
  value?: number;
  threshold?: number;
}

interface UseWasteAlertsParams {
  metrics: WasteMetrics | null | undefined;
  byReason: WasteByReason[] | null | undefined;
  topItems: WasteItem[] | null | undefined;
  /** Historical average waste % (default: 2.0%) */
  avgWastePercent?: number;
  /** Critical threshold multiplier (default: 2x) */
  criticalMultiplier?: number;
  /** Warning threshold multiplier (default: 1.5x) */
  warningMultiplier?: number;
}

export function useWasteAlerts({
  metrics,
  byReason,
  topItems,
  avgWastePercent = 2.0,
  criticalMultiplier = 2.0,
  warningMultiplier = 1.5,
}: UseWasteAlertsParams): WasteAlert[] {
  return useMemo(() => {
    if (!metrics) return [];

    const alerts: WasteAlert[] = [];
    const currentPct = metrics.wastePercentOfSales;

    // ── Overall waste spike ────────────────────────────
    const criticalThreshold = avgWastePercent * criticalMultiplier;
    const warningThreshold = avgWastePercent * warningMultiplier;

    if (currentPct >= criticalThreshold) {
      alerts.push({
        id: 'waste-spike-critical',
        severity: 'critical',
        title: 'Waste Spike Detected',
        message: `Waste is at ${currentPct.toFixed(1)}% of sales — ${(currentPct / avgWastePercent).toFixed(1)}× above the ${avgWastePercent}% average. Immediate review recommended.`,
        metric: 'waste_pct',
        value: currentPct,
        threshold: criticalThreshold,
      });
    } else if (currentPct >= warningThreshold) {
      alerts.push({
        id: 'waste-spike-warning',
        severity: 'warning',
        title: 'Waste Above Average',
        message: `Waste is at ${currentPct.toFixed(1)}% of sales, above the ${avgWastePercent}% target. Monitor closely.`,
        metric: 'waste_pct',
        value: currentPct,
        threshold: warningThreshold,
      });
    }

    // ── High-value single item ─────────────────────────
    if (topItems?.length) {
      const worstItem = topItems[0];
      if (worstItem.percentOfSales >= 0.5) {
        alerts.push({
          id: `item-spike-${worstItem.itemId}`,
          severity: worstItem.percentOfSales >= 1.0 ? 'critical' : 'warning',
          title: `${worstItem.itemName} — High Waste`,
          message: `€${worstItem.value.toFixed(0)} wasted (${worstItem.percentOfSales.toFixed(1)}% of sales). Top reason: ${worstItem.topReason}.`,
          metric: 'item_waste',
          value: worstItem.value,
        });
      }
    }

    // ── Theft reason spike ─────────────────────────────
    if (byReason?.length) {
      const theft = byReason.find(r => r.reason === 'theft');
      if (theft && theft.value > 50) {
        alerts.push({
          id: 'theft-alert',
          severity: 'critical',
          title: 'Theft Reports',
          message: `${theft.count} theft event(s) totalling €${theft.value.toFixed(0)}. Review security footage.`,
          metric: 'theft_value',
          value: theft.value,
        });
      }
    }

    // ── Expired items spike ────────────────────────────
    if (byReason?.length) {
      const expired = byReason.find(r => r.reason === 'expired');
      if (expired && expired.count >= 5) {
        alerts.push({
          id: 'expired-alert',
          severity: 'warning',
          title: 'High Expiration Count',
          message: `${expired.count} items expired (€${expired.value.toFixed(0)}). Review FIFO procedures and par levels.`,
          metric: 'expired_count',
          value: expired.count,
        });
      }
    }

    // ── End-of-day overproduction ──────────────────────
    if (byReason?.length) {
      const eod = byReason.find(r => r.reason === 'end_of_day');
      const totalValue = metrics.totalAccountedWaste;
      if (eod && totalValue > 0 && (eod.value / totalValue) > 0.5) {
        alerts.push({
          id: 'overproduction-alert',
          severity: 'info',
          title: 'Overproduction Pattern',
          message: `${Math.round((eod.value / totalValue) * 100)}% of waste is end-of-day. Consider reducing batch sizes or adjusting prep schedules.`,
          metric: 'eod_ratio',
          value: eod.value / totalValue,
        });
      }
    }

    return alerts;
  }, [metrics, byReason, topItems, avgWastePercent, criticalMultiplier, warningMultiplier]);
}
