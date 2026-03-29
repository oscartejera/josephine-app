/**
 * useWasteAnnualReport — Annual/YTD Waste Intelligence Report
 * Aggregates waste data across the full year (or YTD)
 * for executive summary and ROI justification.
 */

import { useMemo } from 'react';

// ── Types ──

export interface MonthlyWasteData {
  month: string;            // 'Ene', 'Feb', etc.
  monthNum: number;
  wasteAmount: number;
  wastePercent: number;     // vs that month's sales estimate
  eventCount: number;
  bestDay: string;          // day with least waste
  worstDay: string;         // day with most waste
  topReason: string;
  topReasonLabel: string;
}

export interface AnnualReportResult {
  monthlyData: MonthlyWasteData[];
  ytdTotalWaste: number;
  ytdTotalEvents: number;
  ytdAveragePercent: number;
  ytdBestMonth: string | null;
  ytdWorstMonth: string | null;
  trendDirection: 'improving' | 'worsening' | 'stable';
  trendPercent: number;                 // % change first half vs second half
  projectedAnnualWaste: number;
  projectedSaving: number;             // vs industry avg 3%
  isAvailable: boolean;
}

// ── Constants ──

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const REASON_LABELS: Record<string, string> = {
  spillage: 'Derrame', expiry: 'Caducidad', kitchen_error: 'Error cocina',
  courtesy: 'Cortesía', broken: 'Rotura', end_of_day: 'Fin de día',
  over_production: 'Sobreproducción', plate_waste: 'Resto de plato',
  expired: 'Producto vencido', theft: 'Robo/Consumo', other: 'Otros',
};
const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// ── Hook ──

interface WasteEvent {
  waste_value: number;
  reason: string | null;
  created_at: string;
}

export function useWasteAnnualReport(
  wasteEvents: WasteEvent[],
  totalSales: number,
  periodDays: number = 30,
): AnnualReportResult {
  return useMemo(() => {
    if (wasteEvents.length < 10 || totalSales <= 0) {
      return {
        monthlyData: [],
        ytdTotalWaste: 0,
        ytdTotalEvents: 0,
        ytdAveragePercent: 0,
        ytdBestMonth: null,
        ytdWorstMonth: null,
        trendDirection: 'stable',
        trendPercent: 0,
        projectedAnnualWaste: 0,
        projectedSaving: 0,
        isAvailable: false,
      };
    }

    // Group events by month
    const monthMap = new Map<number, {
      events: WasteEvent[];
      total: number;
      reasons: Map<string, number>;
      dailyBreakdown: Map<number, number>; // day of week => total
    }>();

    wasteEvents.forEach(event => {
      const d = new Date(event.created_at);
      const monthNum = d.getMonth();
      const existing = monthMap.get(monthNum) || {
        events: [],
        total: 0,
        reasons: new Map(),
        dailyBreakdown: new Map(),
      };

      existing.events.push(event);
      existing.total += event.waste_value || 0;

      const reason = event.reason || 'other';
      existing.reasons.set(reason, (existing.reasons.get(reason) || 0) + (event.waste_value || 0));

      const dow = d.getDay();
      existing.dailyBreakdown.set(dow, (existing.dailyBreakdown.get(dow) || 0) + (event.waste_value || 0));

      monthMap.set(monthNum, existing);
    });

    // Estimate monthly sales (proportional to period)
    const dailySales = totalSales / periodDays;

    const monthlyData: MonthlyWasteData[] = [];
    let ytdTotal = 0;
    let ytdEvents = 0;

    monthMap.forEach((data, monthNum) => {
      const daysInMonth = data.events.length > 0 ?
        new Set(data.events.map(e => new Date(e.created_at).getDate())).size :
        30;
      const monthSalesEstimate = dailySales * daysInMonth;
      const wastePercent = monthSalesEstimate > 0 ? (data.total / monthSalesEstimate) * 100 : 0;

      // Find top reason
      let topReason = 'other';
      let maxReasonVal = 0;
      data.reasons.forEach((val, reason) => {
        if (val > maxReasonVal) { maxReasonVal = val; topReason = reason; }
      });

      // Find best/worst day
      let bestDow = 0, worstDow = 0;
      let minDayVal = Infinity, maxDayVal = 0;
      data.dailyBreakdown.forEach((val, dow) => {
        if (val < minDayVal) { minDayVal = val; bestDow = dow; }
        if (val > maxDayVal) { maxDayVal = val; worstDow = dow; }
      });

      monthlyData.push({
        month: MONTH_NAMES[monthNum],
        monthNum,
        wasteAmount: data.total,
        wastePercent,
        eventCount: data.events.length,
        bestDay: DAY_NAMES[bestDow],
        worstDay: DAY_NAMES[worstDow],
        topReason,
        topReasonLabel: REASON_LABELS[topReason] || topReason,
      });

      ytdTotal += data.total;
      ytdEvents += data.events.length;
    });

    // Sort by month
    monthlyData.sort((a, b) => a.monthNum - b.monthNum);

    // Best/worst months
    let bestMonth: MonthlyWasteData | null = null;
    let worstMonth: MonthlyWasteData | null = null;
    monthlyData.forEach(m => {
      if (!bestMonth || m.wastePercent < bestMonth.wastePercent) bestMonth = m;
      if (!worstMonth || m.wastePercent > worstMonth.wastePercent) worstMonth = m;
    });

    // Trend: first half vs second half
    const mid = Math.floor(monthlyData.length / 2);
    const firstHalf = monthlyData.slice(0, mid).reduce((s, m) => s + m.wastePercent, 0) / Math.max(1, mid);
    const secondHalf = monthlyData.slice(mid).reduce((s, m) => s + m.wastePercent, 0) / Math.max(1, monthlyData.length - mid);
    const trendPercent = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;

    let trendDirection: AnnualReportResult['trendDirection'] = 'stable';
    if (trendPercent < -5) trendDirection = 'improving';
    else if (trendPercent > 5) trendDirection = 'worsening';

    // Projections
    const avgWastePercent = monthlyData.length > 0
      ? monthlyData.reduce((s, m) => s + m.wastePercent, 0) / monthlyData.length
      : 0;
    const annualSalesEstimate = dailySales * 365;
    const projectedAnnualWaste = annualSalesEstimate * (avgWastePercent / 100);
    const projectedSaving = annualSalesEstimate * Math.max(0, avgWastePercent - 3) / 100;

    return {
      monthlyData,
      ytdTotalWaste: ytdTotal,
      ytdTotalEvents: ytdEvents,
      ytdAveragePercent: avgWastePercent,
      ytdBestMonth: bestMonth?.month || null,
      ytdWorstMonth: worstMonth?.month || null,
      trendDirection,
      trendPercent,
      projectedAnnualWaste,
      projectedSaving,
      isAvailable: monthlyData.length >= 1,
    };
  }, [wasteEvents, totalSales, periodDays]);
}
