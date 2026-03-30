/**
 * WasteDayFlow — Sprint 2: Daily Waste Checklist
 *
 * Stepper component showing the 3 phases of the day:
 * - ☀️ Apertura (6-11h) — Check fridges, expiry
 * - 🍳 Servicio (11-22h) — Kitchen errors, returns
 * - 🌙 Cierre (22-24h) — End of day batch
 *
 * Motivational: shows daily progress, log count, cost, streak.
 */

import { useMemo } from 'react';
import { Flame, Sun, ChefHat, Moon, Check, Clock, TrendingDown, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface WasteDayFlowProps {
  dailyCount: number;
  dailyCost: number;
  streak: number;
  onSelectPhase?: (phase: 'opening' | 'service' | 'closing') => void;
}

type DayPhase = 'opening' | 'service' | 'closing';

interface PhaseConfig {
  id: DayPhase;
  label: string;
  timeLabel: string;
  icon: React.ReactNode;
  description: string;
  tip: string;
  hours: [number, number]; // start, end
  color: string;
  bgColor: string;
  borderColor: string;
}

const PHASES: PhaseConfig[] = [
  {
    id: 'opening',
    label: 'Apertura',
    timeLabel: '6:00 — 11:00',
    icon: <Sun className="h-5 w-5" />,
    description: 'Revisar cámaras y almacén',
    tip: 'Busca productos caducados o en mal estado',
    hours: [6, 11],
    color: 'text-amber-600',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
  },
  {
    id: 'service',
    label: 'Servicio',
    timeLabel: '11:00 — 22:00',
    icon: <ChefHat className="h-5 w-5" />,
    description: 'Errores cocina, devoluciones de platos',
    tip: 'Registra al momento — ¡5 segundos con el FAB!',
    hours: [11, 22],
    color: 'text-red-600',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
  },
  {
    id: 'closing',
    label: 'Cierre',
    timeLabel: '22:00 — 00:00',
    icon: <Moon className="h-5 w-5" />,
    description: 'Conteo de sobrantes del día',
    tip: 'Usa el registro batch — más rápido',
    hours: [22, 24],
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/30',
  },
];

function getCurrentPhase(): DayPhase {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 11) return 'opening';
  if (hour >= 11 && hour < 22) return 'service';
  return 'closing';
}

function getPhaseStatus(phase: PhaseConfig, currentPhase: DayPhase, dailyCount: number): 'done' | 'current' | 'upcoming' {
  const phaseOrder: DayPhase[] = ['opening', 'service', 'closing'];
  const currentIdx = phaseOrder.indexOf(currentPhase);
  const phaseIdx = phaseOrder.indexOf(phase.id);

  if (phaseIdx < currentIdx) return dailyCount > 0 ? 'done' : 'done'; // Past phases
  if (phaseIdx === currentIdx) return 'current';
  return 'upcoming';
}

export function WasteDayFlow({ dailyCount, dailyCost, streak, onSelectPhase }: WasteDayFlowProps) {
  const currentPhase = useMemo(getCurrentPhase, []);
  const progressPct = Math.min(100, Math.round((dailyCount / 8) * 100)); // 8 logs = 100% (industry benchmark)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            📋 Flujo de Merma del Día
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sigue las fases para un registro completo
          </p>
        </div>
        {streak >= 2 && (
          <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30 gap-1">
            <Flame className="h-3 w-3" />
            {streak} días
          </Badge>
        )}
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-muted-foreground">Progreso hoy</span>
          <span className="font-medium">{progressPct}%</span>
        </div>
        <Progress value={progressPct} className="h-2.5 [&>div]:bg-gradient-to-r [&>div]:from-emerald-400 [&>div]:to-emerald-600" />
      </div>

      {/* Phase cards */}
      <div className="space-y-2">
        {PHASES.map(phase => {
          const status = getPhaseStatus(phase, currentPhase, dailyCount);
          const isCurrent = status === 'current';
          const isDone = status === 'done' && dailyCount > 0;

          return (
            <button
              key={phase.id}
              onClick={() => onSelectPhase?.(phase.id)}
              className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${
                isCurrent
                  ? `${phase.borderColor} ${phase.bgColor} shadow-sm`
                  : isDone
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : 'border-transparent bg-muted/30 opacity-60'
              } ${isCurrent ? 'hover:shadow-md' : 'hover:opacity-80'}`}
            >
              <div className="flex items-start gap-3">
                {/* Status icon */}
                <div className={`mt-0.5 h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isDone
                    ? 'bg-emerald-500 text-white'
                    : isCurrent
                      ? `${phase.bgColor} ${phase.color}`
                      : 'bg-muted text-muted-foreground'
                }`}>
                  {isDone ? <Check className="h-4 w-4" /> : phase.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${isCurrent ? phase.color : isDone ? 'text-emerald-600' : ''}`}>
                      {phase.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{phase.timeLabel}</span>
                    {isCurrent && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/30">
                        Ahora
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{phase.description}</p>
                  {isCurrent && (
                    <p className="text-[10px] text-muted-foreground/70 mt-1 italic flex items-center gap-1">
                      💡 {phase.tip}
                    </p>
                  )}
                </div>

                {/* Arrow for current */}
                {isCurrent && (
                  <ArrowRight className={`h-4 w-4 mt-1 flex-shrink-0 ${phase.color}`} />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Daily summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-2.5 rounded-xl bg-muted/40">
          <p className="text-lg font-bold">{dailyCount}</p>
          <p className="text-[10px] text-muted-foreground">Registros</p>
        </div>
        <div className="text-center p-2.5 rounded-xl bg-red-500/5">
          <p className="text-lg font-bold text-red-600">€{dailyCost.toFixed(0)}</p>
          <p className="text-[10px] text-muted-foreground">Coste hoy</p>
        </div>
        <div className="text-center p-2.5 rounded-xl bg-orange-500/5">
          <div className="flex items-center justify-center gap-1">
            <Flame className={`h-4 w-4 ${streak >= 3 ? 'text-orange-500' : 'text-muted-foreground'}`} />
            <p className="text-lg font-bold">{streak}</p>
          </div>
          <p className="text-[10px] text-muted-foreground">Racha (días)</p>
        </div>
      </div>

      {/* Motivational message */}
      {dailyCount >= 5 && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
          <p className="text-xs text-emerald-700 font-medium">
            💪 ¡Excelente trabajo! {dailyCount} registros hoy — tu equipo controla la merma
          </p>
        </div>
      )}
      {dailyCount === 0 && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
          <p className="text-xs text-amber-700">
            📢 Hoy aún no se ha registrado merma. ¡Empieza ahora!
          </p>
        </div>
      )}
    </div>
  );
}
