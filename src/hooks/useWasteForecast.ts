import { useMemo } from 'react';
import { getDay, format, addDays, startOfWeek, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

// ── Types ──

export interface DayForecast {
  date: Date;
  dayLabel: string;        // "Lun", "Mar", etc.
  dateLabel: string;       // "31 mar"
  predictedValue: number;  // €
  predictedCount: number;  // events
  confidence: 'high' | 'medium' | 'low';
  riskLevel: 'ok' | 'watch' | 'alert';
  topExpectedReason: string;
  historicalAvg: number;   // average for this day-of-week
}

export interface ForecastSummary {
  totalPredictedWaste: number;
  totalPredictedCount: number;
  highestRiskDay: string;
  highestRiskValue: number;
  trend: 'improving' | 'stable' | 'worsening';
  trendPercent: number;       // % change vs recent average
  weeklyTarget: number;       // based on waste target
  projectedVsTarget: number;  // +/- €
}

export interface WasteForecastResult {
  dailyForecasts: DayForecast[];
  summary: ForecastSummary;
  isReliable: boolean;    // enough data for forecasting?
}

// ── Constants ──

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MIN_EVENTS_FOR_FORECAST = 20;

// ── Weighted Moving Average ──
// Recent weeks get more weight: [0.1, 0.2, 0.3, 0.4] for last 4 weeks
function weightedAverage(values: number[]): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];

  // Generate weights: more recent = higher weight
  const weights = values.map((_, i) => (i + 1) / values.length);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const weightedSum = values.reduce((sum, val, i) => sum + val * weights[i], 0);
  return weightedSum / totalWeight;
}

// ── Hook ──

interface WasteEvent {
  waste_value: number;
  reason: string | null;
  created_at: string;
}

export function useWasteForecast(
  wasteEvents: WasteEvent[],
  wasteTarget: number = 3.0,
  monthlySales: number = 0,
) {
  return useMemo<WasteForecastResult>(() => {
    // Guard: not enough data
    if (wasteEvents.length < MIN_EVENTS_FOR_FORECAST) {
      return {
        dailyForecasts: [],
        summary: {
          totalPredictedWaste: 0,
          totalPredictedCount: 0,
          highestRiskDay: '',
          highestRiskValue: 0,
          trend: 'stable',
          trendPercent: 0,
          weeklyTarget: 0,
          projectedVsTarget: 0,
        },
        isReliable: false,
      };
    }

    // ── Step 1: Group events by day-of-week into weekly buckets ──
    // Each bucket = value for that specific day-of-week in each calendar week
    const dayWeeklyValues: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    const dayWeeklyCounts: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    const dayReasons: Record<number, Record<string, number>> = {};

    // Process events into weeks
    const weekBuckets = new Map<string, Record<number, { value: number; count: number }>>();

    wasteEvents.forEach(event => {
      const dt = parseISO(event.created_at);
      const weekStart = format(startOfWeek(dt, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const dow = getDay(dt);
      const val = event.waste_value || 0;

      if (!weekBuckets.has(weekStart)) {
        weekBuckets.set(weekStart, {});
      }
      const week = weekBuckets.get(weekStart)!;
      if (!week[dow]) week[dow] = { value: 0, count: 0 };
      week[dow].value += val;
      week[dow].count += 1;

      // Track reasons per day-of-week
      if (!dayReasons[dow]) dayReasons[dow] = {};
      const reason = event.reason || 'other';
      dayReasons[dow][reason] = (dayReasons[dow][reason] || 0) + val;
    });

    // Convert week buckets to arrays for weighted average
    const sortedWeeks = Array.from(weekBuckets.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    sortedWeeks.forEach(([, weekData]) => {
      for (let d = 0; d < 7; d++) {
        dayWeeklyValues[d].push(weekData[d]?.value || 0);
        dayWeeklyCounts[d].push(weekData[d]?.count || 0);
      }
    });

    // ── Step 2: Calculate predictions for next 7 days ──
    const today = new Date();
    const nextMonday = addDays(startOfWeek(today, { weekStartsOn: 1 }), 7);

    const dailyForecasts: DayForecast[] = [];
    let totalPredicted = 0;
    let totalPredictedCount = 0;
    let highestDay = '';
    let highestValue = 0;

    for (let i = 0; i < 7; i++) {
      const forecastDate = addDays(nextMonday, i);
      const dow = getDay(forecastDate);

      const values = dayWeeklyValues[dow];
      const counts = dayWeeklyCounts[dow];

      const predictedValue = weightedAverage(values);
      const predictedCount = Math.round(weightedAverage(counts));
      const historicalAvg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

      // Confidence based on sample size
      const dataPoints = values.filter(v => v > 0).length;
      const confidence: DayForecast['confidence'] =
        dataPoints >= 4 ? 'high' : dataPoints >= 2 ? 'medium' : 'low';

      // Risk level based on predicted vs global daily average
      const globalDailyAvg = wasteEvents.reduce((s, e) => s + (e.waste_value || 0), 0) / Math.max(sortedWeeks.length * 7, 1);
      const riskLevel: DayForecast['riskLevel'] =
        predictedValue > globalDailyAvg * 1.5 ? 'alert' :
        predictedValue > globalDailyAvg * 1.1 ? 'watch' : 'ok';

      // Top reason for this day-of-week
      const reasons = dayReasons[dow] || {};
      const topExpectedReason = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0]?.[0] || 'other';

      dailyForecasts.push({
        date: forecastDate,
        dayLabel: DAY_LABELS[dow],
        dateLabel: format(forecastDate, 'd MMM', { locale: es }),
        predictedValue,
        predictedCount,
        confidence,
        riskLevel,
        topExpectedReason,
        historicalAvg,
      });

      totalPredicted += predictedValue;
      totalPredictedCount += predictedCount;

      if (predictedValue > highestValue) {
        highestValue = predictedValue;
        highestDay = DAY_LABELS[dow];
      }
    }

    // ── Step 3: Calculate trend ──
    // Compare last 2 weeks vs previous 2 weeks
    const recentWeeks = sortedWeeks.slice(-2);
    const olderWeeks = sortedWeeks.slice(-4, -2);

    const recentTotal = recentWeeks.reduce((sum, [, w]) =>
      sum + Object.values(w).reduce((s, d) => s + d.value, 0), 0);
    const olderTotal = olderWeeks.reduce((sum, [, w]) =>
      sum + Object.values(w).reduce((s, d) => s + d.value, 0), 0);

    const recentAvg = recentWeeks.length > 0 ? recentTotal / recentWeeks.length : 0;
    const olderAvg = olderWeeks.length > 0 ? olderTotal / olderWeeks.length : recentAvg;
    const trendPercent = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;

    const trend: ForecastSummary['trend'] =
      trendPercent < -5 ? 'improving' :
      trendPercent > 5 ? 'worsening' : 'stable';

    // Weekly target based on waste target % and monthly sales
    const weeklyTarget = monthlySales > 0
      ? (wasteTarget / 100) * monthlySales / 4.33
      : totalPredicted * 0.7; // fallback: 30% reduction as target

    return {
      dailyForecasts,
      summary: {
        totalPredictedWaste: totalPredicted,
        totalPredictedCount,
        highestRiskDay: highestDay,
        highestRiskValue: highestValue,
        trend,
        trendPercent,
        weeklyTarget,
        projectedVsTarget: totalPredicted - weeklyTarget,
      },
      isReliable: wasteEvents.length >= MIN_EVENTS_FOR_FORECAST && sortedWeeks.length >= 2,
    };
  }, [wasteEvents, wasteTarget, monthlySales]);
}
