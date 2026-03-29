/**
 * useWasteTeamScore — gamified scoring for team waste management.
 *
 * Score dimensions (0-100 total):
 * - Volume (30pts): More logs = better (encourages transparency)
 * - Reduction (30pts): Trend vs previous period
 * - Diversity (20pts): Uses multiple reason codes (not just "other")
 * - Consistency (20pts): Logs regularly, not just some days
 */

import { useMemo } from 'react';
import { parseISO, format } from 'date-fns';
import { REASON_LABELS } from './useWasteData';

// ── Types ──

export interface TeamMemberScore {
  userId: string;
  name: string;
  initials: string;
  logsCount: number;
  totalValue: number;
  score: number;          // 0-100
  volumeScore: number;    // 0-30
  reductionScore: number; // 0-30
  diversityScore: number; // 0-20
  consistencyScore: number; // 0-20
  trend: 'up' | 'stable' | 'down';
  level: string;
  levelEmoji: string;
  uniqueReasons: number;
  activeDays: number;
}

export interface TeamScoreResult {
  members: TeamMemberScore[];
  teamAvgScore: number;
  topPerformer: string | null;
  isReliable: boolean;
}

// ── Level thresholds ──
const LEVELS = [
  { min: 90, label: 'Experto', emoji: '🏆' },
  { min: 75, label: 'Avanzado', emoji: '⭐' },
  { min: 50, label: 'Competente', emoji: '📈' },
  { min: 25, label: 'En progreso', emoji: '🔄' },
  { min: 0,  label: 'Iniciado', emoji: '🌱' },
];

function getLevel(score: number) {
  return LEVELS.find(l => score >= l.min) || LEVELS[LEVELS.length - 1];
}

// ── Hook ──

interface WasteEvent {
  waste_value: number;
  reason: string | null;
  created_at: string;
  logged_by?: string;
}

interface ProfileData {
  id: string;
  full_name: string;
}

export function useWasteTeamScore(
  wasteEvents: WasteEvent[],
  profiles: ProfileData[] = [],
): TeamScoreResult {
  return useMemo(() => {
    if (wasteEvents.length < 5) {
      return { members: [], teamAvgScore: 0, topPerformer: null, isReliable: false };
    }

    // Step 1: Group events by user
    const userMap = new Map<string, {
      logsCount: number;
      totalValue: number;
      reasons: Set<string>;
      activeDays: Set<string>;
      recentValue: number;  // last 7 days
      olderValue: number;   // 8-14 days ago
    }>();

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    wasteEvents.forEach(event => {
      const userId = event.logged_by || 'unknown';
      if (userId === 'unknown') return;

      const existing = userMap.get(userId) || {
        logsCount: 0,
        totalValue: 0,
        reasons: new Set<string>(),
        activeDays: new Set<string>(),
        recentValue: 0,
        olderValue: 0,
      };

      existing.logsCount += 1;
      existing.totalValue += event.waste_value || 0;
      existing.reasons.add(event.reason || 'other');
      existing.activeDays.add(event.created_at.slice(0, 10));

      const eventDate = parseISO(event.created_at);
      if (eventDate >= sevenDaysAgo) {
        existing.recentValue += event.waste_value || 0;
      } else if (eventDate >= fourteenDaysAgo) {
        existing.olderValue += event.waste_value || 0;
      }

      userMap.set(userId, existing);
    });

    if (userMap.size === 0) {
      return { members: [], teamAvgScore: 0, topPerformer: null, isReliable: false };
    }

    // Step 2: Calculate scores
    const maxLogs = Math.max(...Array.from(userMap.values()).map(u => u.logsCount));
    const profileMap = new Map(profiles.map(p => [p.id, p.full_name]));

    // Count total unique days in data
    const allDays = new Set<string>();
    wasteEvents.forEach(e => allDays.add(e.created_at.slice(0, 10)));
    const totalDays = allDays.size;

    const members: TeamMemberScore[] = [];

    userMap.forEach((data, userId) => {
      // Volume score (0-30): ratio of logs vs max logs
      const volumeScore = maxLogs > 0 ? Math.round((data.logsCount / maxLogs) * 30) : 0;

      // Reduction score (0-30): waste trend
      let reductionScore = 15; // default neutral
      if (data.olderValue > 0) {
        const changeRatio = (data.recentValue - data.olderValue) / data.olderValue;
        if (changeRatio < -0.2) reductionScore = 30;      // improved >20%
        else if (changeRatio < -0.05) reductionScore = 22; // slightly improved
        else if (changeRatio < 0.05) reductionScore = 15;  // stable
        else if (changeRatio < 0.2) reductionScore = 8;    // slightly worsened
        else reductionScore = 0;                            // worsened >20%
      }

      // Diversity score (0-20): uses different reason codes
      const reasonCount = data.reasons.size;
      const diversityScore = Math.min(20, Math.round((reasonCount / 6) * 20)); // 6+ reasons = full score

      // Consistency score (0-20): how many of the total days they logged
      const consistencyRatio = totalDays > 0 ? data.activeDays.size / totalDays : 0;
      const consistencyScore = Math.round(consistencyRatio * 20);

      const totalScore = volumeScore + reductionScore + diversityScore + consistencyScore;
      const level = getLevel(totalScore);

      // Trend
      let trend: TeamMemberScore['trend'] = 'stable';
      if (data.olderValue > 0) {
        const change = (data.recentValue - data.olderValue) / data.olderValue;
        if (change < -0.1) trend = 'down'; // waste going down = good
        else if (change > 0.1) trend = 'up'; // waste going up = bad
      }

      const name = profileMap.get(userId) || 'Desconocido';
      const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

      members.push({
        userId,
        name,
        initials: initials || '??',
        logsCount: data.logsCount,
        totalValue: data.totalValue,
        score: totalScore,
        volumeScore,
        reductionScore,
        diversityScore,
        consistencyScore,
        trend,
        level: level.label,
        levelEmoji: level.emoji,
        uniqueReasons: reasonCount,
        activeDays: data.activeDays.size,
      });
    });

    // Sort by score descending
    members.sort((a, b) => b.score - a.score);

    const teamAvgScore = members.length > 0
      ? Math.round(members.reduce((s, m) => s + m.score, 0) / members.length)
      : 0;

    return {
      members,
      teamAvgScore,
      topPerformer: members.length > 0 ? members[0].name : null,
      isReliable: wasteEvents.length >= 20,
    };
  }, [wasteEvents, profiles]);
}
