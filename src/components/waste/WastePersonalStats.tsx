/**
 * WastePersonalStats — Sprint 3: Micro-Gamification
 *
 * Shows personal stats for the logged-in employee:
 * - Total logs this week/month
 * - Current streak
 * - Total waste value tracked
 * - Employee level (Novato → Responsable → Experto → Campeón)
 * - Progress to next level
 *
 * Data from localStorage + waste_events.logged_by
 */

import { useMemo } from 'react';
import { Flame, Trophy, TrendingUp, Star, Target, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface WastePersonalStatsProps {
  totalLogs: number;
  weekLogs: number;
  totalWasteValue: number;
  streak: number;
  teamRank?: number;
  teamSize?: number;
}

// ── Level system ──
interface Level {
  name: string;
  icon: string;
  minLogs: number;
  color: string;
  bgColor: string;
  borderColor: string;
}

const LEVELS: Level[] = [
  { name: 'Novato', icon: '🥉', minLogs: 0, color: 'text-zinc-600', bgColor: 'bg-zinc-500/10', borderColor: 'border-zinc-500/20' },
  { name: 'Responsable', icon: '🥈', minLogs: 11, color: 'text-blue-600', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/20' },
  { name: 'Experto', icon: '🥇', minLogs: 51, color: 'text-amber-600', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/20' },
  { name: 'Campeón de Merma', icon: '💎', minLogs: 201, color: 'text-purple-600', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/20' },
];

function getLevel(totalLogs: number): { current: Level; next: Level | null; progress: number } {
  let currentLevel = LEVELS[0];
  let nextLevel: Level | null = null;

  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalLogs >= LEVELS[i].minLogs) {
      currentLevel = LEVELS[i];
      nextLevel = LEVELS[i + 1] || null;
      break;
    }
  }

  const progress = nextLevel
    ? Math.round(((totalLogs - currentLevel.minLogs) / (nextLevel.minLogs - currentLevel.minLogs)) * 100)
    : 100;

  return { current: currentLevel, next: nextLevel, progress: Math.min(100, progress) };
}

export function WastePersonalStats({
  totalLogs,
  weekLogs,
  totalWasteValue,
  streak,
  teamRank,
  teamSize,
}: WastePersonalStatsProps) {
  const { current, next, progress } = useMemo(() => getLevel(totalLogs), [totalLogs]);

  return (
    <div className="rounded-2xl border-2 overflow-hidden" style={{ borderColor: `var(--${current.borderColor})` }}>
      {/* Header with level */}
      <div className={`${current.bgColor} px-4 py-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{current.icon}</span>
            <div>
              <p className={`text-sm font-bold ${current.color}`}>{current.name}</p>
              <p className="text-[10px] text-muted-foreground">{totalLogs} registros totales</p>
            </div>
          </div>
          {teamRank && teamSize && (
            <Badge variant="outline" className="gap-1 text-xs">
              <Trophy className="h-3 w-3" />
              #{teamRank} de {teamSize}
            </Badge>
          )}
        </div>

        {/* Progress to next level */}
        {next && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="text-muted-foreground">Próximo nivel: {next.icon} {next.name}</span>
              <span className="font-medium">{next.minLogs - totalLogs} registros más</span>
            </div>
            <Progress value={progress} className="h-1.5 [&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:to-primary/70" />
          </div>
        )}
        {!next && (
          <div className="mt-2 flex items-center gap-1 text-xs text-purple-600">
            <Sparkles className="h-3 w-3" />
            <span className="font-medium">¡Nivel máximo alcanzado!</span>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 divide-x divide-border">
        <div className="text-center p-3">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            <span className="text-lg font-bold">{weekLogs}</span>
          </div>
          <p className="text-[10px] text-muted-foreground">Esta semana</p>
        </div>
        <div className="text-center p-3">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Flame className={`h-3.5 w-3.5 ${streak >= 5 ? 'text-orange-500' : streak >= 2 ? 'text-amber-500' : 'text-muted-foreground'}`} />
            <span className="text-lg font-bold">{streak}</span>
          </div>
          <p className="text-[10px] text-muted-foreground">Racha (días)</p>
        </div>
        <div className="text-center p-3">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Target className="h-3.5 w-3.5 text-red-500" />
            <span className="text-lg font-bold text-red-600">€{totalWasteValue >= 1000 ? `${(totalWasteValue / 1000).toFixed(1)}k` : totalWasteValue.toFixed(0)}</span>
          </div>
          <p className="text-[10px] text-muted-foreground">Identificadas</p>
        </div>
        <div className="text-center p-3">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Star className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-lg font-bold">{totalLogs}</span>
          </div>
          <p className="text-[10px] text-muted-foreground">Total logs</p>
        </div>
      </div>
    </div>
  );
}
