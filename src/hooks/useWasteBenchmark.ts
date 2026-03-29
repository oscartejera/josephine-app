/**
 * useWasteBenchmark — compares waste metrics across locations
 * to identify outliers and best practices.
 */

import { useMemo } from 'react';

// ── Types ──

export interface LocationBenchmark {
  locationId: string;
  locationName: string;
  totalWaste: number;
  wasteCount: number;
  wastePercent: number;     // vs total sales (approximated)
  vsAverage: number;        // % difference vs mean across locations
  topReason: string;
  topReasonLabel: string;
  trend: 'improving' | 'stable' | 'worsening';
  rank: number;
}

export interface BenchmarkResult {
  locations: LocationBenchmark[];
  overallAvgWaste: number;
  bestLocation: string | null;
  worstLocation: string | null;
  isAvailable: boolean; // ≥2 locations
}

// ── Hook ──

interface WasteEvent {
  waste_value: number;
  reason: string | null;
  created_at: string;
  location_id: string;
}

interface LocationInfo {
  id: string;
  name: string;
}

const REASON_LABELS: Record<string, string> = {
  spillage: 'Derrame',
  expiry: 'Caducidad',
  kitchen_error: 'Error de cocina',
  courtesy: 'Cortesía',
  broken: 'Rotura',
  end_of_day: 'Fin de día',
  over_production: 'Sobreproducción',
  plate_waste: 'Resto de plato',
  expired: 'Producto vencido',
  theft: 'Robo/Consumo',
  other: 'Otros',
};

export function useWasteBenchmark(
  wasteEvents: WasteEvent[],
  locations: LocationInfo[],
): BenchmarkResult {
  return useMemo(() => {
    if (locations.length < 2 || wasteEvents.length < 5) {
      return {
        locations: [],
        overallAvgWaste: 0,
        bestLocation: null,
        worstLocation: null,
        isAvailable: false,
      };
    }

    // Group by location
    const locMap = new Map<string, {
      totalWaste: number;
      count: number;
      reasons: Map<string, number>;
      recentValue: number;
      olderValue: number;
    }>();

    const now = new Date();
    const midpoint = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);

    wasteEvents.forEach(event => {
      const locId = event.location_id;
      const val = event.waste_value || 0;
      const reason = event.reason || 'other';

      const existing = locMap.get(locId) || {
        totalWaste: 0,
        count: 0,
        reasons: new Map(),
        recentValue: 0,
        olderValue: 0,
      };

      existing.totalWaste += val;
      existing.count += 1;
      existing.reasons.set(reason, (existing.reasons.get(reason) || 0) + val);

      const eventDate = new Date(event.created_at);
      if (eventDate >= midpoint) {
        existing.recentValue += val;
      } else {
        existing.olderValue += val;
      }

      locMap.set(locId, existing);
    });

    // Calculate averages
    const totalWasteAll = Array.from(locMap.values()).reduce((s, l) => s + l.totalWaste, 0);
    const avgWaste = locMap.size > 0 ? totalWasteAll / locMap.size : 0;

    // Build benchmarks
    const benchmarks: LocationBenchmark[] = [];

    locMap.forEach((data, locId) => {
      const loc = locations.find(l => l.id === locId);
      if (!loc) return;

      // Find top reason
      let topReason = 'other';
      let maxReasonVal = 0;
      data.reasons.forEach((val, reason) => {
        if (val > maxReasonVal) {
          maxReasonVal = val;
          topReason = reason;
        }
      });

      // Trend
      let trend: LocationBenchmark['trend'] = 'stable';
      if (data.olderValue > 0) {
        const change = (data.recentValue - data.olderValue) / data.olderValue;
        if (change < -0.1) trend = 'improving';
        else if (change > 0.1) trend = 'worsening';
      }

      const vsAverage = avgWaste > 0 ? ((data.totalWaste - avgWaste) / avgWaste) * 100 : 0;

      benchmarks.push({
        locationId: locId,
        locationName: loc.name,
        totalWaste: data.totalWaste,
        wasteCount: data.count,
        wastePercent: 0, // Would need sales per location for accurate %
        vsAverage,
        topReason,
        topReasonLabel: REASON_LABELS[topReason] || topReason,
        trend,
        rank: 0,
      });
    });

    // Sort by total waste ascending (best = least waste first)
    benchmarks.sort((a, b) => a.totalWaste - b.totalWaste);
    benchmarks.forEach((b, i) => { b.rank = i + 1; });

    return {
      locations: benchmarks,
      overallAvgWaste: avgWaste,
      bestLocation: benchmarks.length > 0 ? benchmarks[0].locationName : null,
      worstLocation: benchmarks.length > 0 ? benchmarks[benchmarks.length - 1].locationName : null,
      isAvailable: benchmarks.length >= 2,
    };
  }, [wasteEvents, locations]);
}
