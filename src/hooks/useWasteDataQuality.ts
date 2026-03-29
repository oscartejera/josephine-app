/**
 * useWasteDataQuality — Data completeness & logging streak
 * 
 * Analyzes waste logging patterns to show:
 * - Data quality score (% of days with at least 1 log)
 * - Current logging streak (consecutive days)
 * - Missing days (gaps in logging)
 * - Recommendations to improve data quality
 */

import { useMemo } from 'react';
import { format, eachDayOfInterval, isWeekend, differenceInDays, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

// ── Types ──

export interface DataQualityResult {
  /** % of days with at least 1 waste log (0-100) */
  completenessScore: number;
  /** Rating based on score */
  rating: 'excellent' | 'good' | 'needs_improvement' | 'poor' | 'no_data';
  /** Consecutive days with logs ending today (or yesterday) */
  currentStreak: number;
  /** Best streak in the period */
  bestStreak: number;
  /** Total days in period */
  totalDays: number;
  /** Days with at least 1 log */
  daysWithLogs: number;
  /** Days without any log */
  daysWithoutLogs: number;
  /** List of missing dates (formatted) */
  missingDays: string[];
  /** Average logs per day (on days that have logs) */
  avgLogsPerDay: number;
  /** Recommendation text */
  recommendation: string;
  /** Estimated capture rate based on industry benchmarks */
  estimatedCaptureRate: string;
}

// ── Constants ──

const RATING_THRESHOLDS = {
  excellent: 90,
  good: 70,
  needs_improvement: 40,
  poor: 0,
};

function getRating(score: number): DataQualityResult['rating'] {
  if (score >= RATING_THRESHOLDS.excellent) return 'excellent';
  if (score >= RATING_THRESHOLDS.good) return 'good';
  if (score >= RATING_THRESHOLDS.needs_improvement) return 'needs_improvement';
  if (score > 0) return 'poor';
  return 'no_data';
}

function getRecommendation(rating: DataQualityResult['rating'], missingCount: number): string {
  switch (rating) {
    case 'excellent':
      return '¡Excelente! Tu equipo registra merma casi todos los días. Los análisis son fiables.';
    case 'good':
      return `Buen trabajo. Faltan ${missingCount} días de registro. Usa "Cierre de Merma" al final de cada turno para no olvidarlo.`;
    case 'needs_improvement':
      return `Se necesita mejorar. ${missingCount} días sin datos significa que el análisis solo refleja una foto parcial. Activa "Quick Log" como rutina diaria.`;
    case 'poor':
      return `Calidad de datos baja. Las predicciones y varianzas pueden ser inexactas. Establece un responsable diario de registro de merma.`;
    case 'no_data':
      return 'Sin datos de merma en este período. Registra la primera merma para activar el análisis.';
  }
}

function getEstimatedCaptureRate(rating: DataQualityResult['rating']): string {
  switch (rating) {
    case 'excellent': return '85-95%';
    case 'good': return '60-80%';
    case 'needs_improvement': return '30-50%';
    case 'poor': return '10-25%';
    case 'no_data': return '0%';
  }
}

// ── Hook ──

export function useWasteDataQuality(
  rawEvents: any[],
  dateRange: { from: Date; to: Date },
): DataQualityResult {
  return useMemo(() => {
    const today = new Date();
    const effectiveTo = dateRange.to > today ? today : dateRange.to;
    
    // Don't count future days
    if (dateRange.from > today) {
      return {
        completenessScore: 0,
        rating: 'no_data',
        currentStreak: 0,
        bestStreak: 0,
        totalDays: 0,
        daysWithLogs: 0,
        daysWithoutLogs: 0,
        missingDays: [],
        avgLogsPerDay: 0,
        recommendation: getRecommendation('no_data', 0),
        estimatedCaptureRate: '0%',
      };
    }

    // Build set of days with logs
    const daysWithLogsSet = new Set<string>();
    const logCountByDay: Record<string, number> = {};
    
    for (const event of rawEvents) {
      const day = format(new Date(event.created_at), 'yyyy-MM-dd');
      daysWithLogsSet.add(day);
      logCountByDay[day] = (logCountByDay[day] || 0) + 1;
    }

    // Generate all days in range
    const allDays = eachDayOfInterval({ start: dateRange.from, end: effectiveTo })
      .map(d => format(d, 'yyyy-MM-dd'));

    const totalDays = allDays.length;
    const daysWithLogs = allDays.filter(d => daysWithLogsSet.has(d)).length;
    const daysWithoutLogs = totalDays - daysWithLogs;

    // Missing days (formatted nicely, max 7 shown)
    const missingDaysList = allDays
      .filter(d => !daysWithLogsSet.has(d))
      .slice(-7) // most recent 7
      .map(d => {
        const date = new Date(d + 'T12:00:00');
        const dayName = format(date, 'EEE d MMM', { locale: es });
        const weekend = isWeekend(date);
        return weekend ? `${dayName} (fin de semana)` : dayName;
      });

    // Completeness score
    const completenessScore = totalDays > 0 ? Math.round((daysWithLogs / totalDays) * 100) : 0;

    // Streak calculation (from today backwards)
    let currentStreak = 0;
    for (let i = 0; i <= 90; i++) {
      const day = format(subDays(today, i), 'yyyy-MM-dd');
      if (daysWithLogsSet.has(day)) {
        currentStreak++;
      } else if (i === 0) {
        // Today might not have a log yet if it's morning — skip
        continue;
      } else {
        break;
      }
    }

    // Best streak in period
    let bestStreak = 0;
    let tempStreak = 0;
    for (const day of allDays) {
      if (daysWithLogsSet.has(day)) {
        tempStreak++;
        bestStreak = Math.max(bestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }

    // Avg logs per logged day
    const logCounts = Object.values(logCountByDay);
    const avgLogsPerDay = logCounts.length > 0
      ? Math.round((logCounts.reduce((a, b) => a + b, 0) / logCounts.length) * 10) / 10
      : 0;

    const rating = getRating(completenessScore);

    return {
      completenessScore,
      rating,
      currentStreak,
      bestStreak,
      totalDays,
      daysWithLogs,
      daysWithoutLogs,
      missingDays: missingDaysList,
      avgLogsPerDay,
      recommendation: getRecommendation(rating, daysWithoutLogs),
      estimatedCaptureRate: getEstimatedCaptureRate(rating),
    };
  }, [rawEvents, dateRange]);
}
