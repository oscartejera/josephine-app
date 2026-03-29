import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Sun, Sunset, Moon } from 'lucide-react';
import type { ShiftData, Shift } from '@/hooks/useWasteShiftAnalysis';
import { REASON_LABELS, type WasteReason } from '@/hooks/useWasteData';

interface WasteShiftAnalysisProps {
  shiftData: ShiftData[];
  isLoading?: boolean;
  currency?: string;
}

const SHIFT_ICONS: Record<Shift, typeof Sun> = {
  morning: Sun,
  afternoon: Sunset,
  night: Moon,
};

const SHIFT_COLORS: Record<Shift, { bg: string; bar: string; icon: string }> = {
  morning:   { bg: 'bg-amber-500/8', bar: 'bg-amber-500', icon: 'text-amber-500' },
  afternoon: { bg: 'bg-orange-500/8', bar: 'bg-orange-500', icon: 'text-orange-500' },
  night:     { bg: 'bg-indigo-500/8', bar: 'bg-indigo-500', icon: 'text-indigo-500' },
};

export function WasteShiftAnalysis({ shiftData, isLoading = false, currency = '€' }: WasteShiftAnalysisProps) {
  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-2"><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent><Skeleton className="h-[180px] w-full" /></CardContent>
      </Card>
    );
  }

  if (shiftData.length === 0) return null;

  const maxValue = Math.max(...shiftData.map(s => s.totalValue), 1);

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-foreground">Merma por Turno</CardTitle>
        <p className="text-xs text-muted-foreground">Distribución de merma según horario de registro</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {shiftData.map(shift => {
          const colors = SHIFT_COLORS[shift.shift];
          const Icon = SHIFT_ICONS[shift.shift];
          const barWidth = (shift.totalValue / maxValue) * 100;
          const reasonLabel = REASON_LABELS[shift.topReason as WasteReason] || shift.topReason;

          return (
            <div key={shift.shift} className={`rounded-lg p-3 ${colors.bg}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${colors.icon}`} />
                  <span className="text-sm font-medium text-foreground">{shift.label}</span>
                  <span className="text-[11px] text-muted-foreground">{shift.timeRange}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold tabular-nums">
                    {currency}{shift.totalValue.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-[11px] text-muted-foreground ml-1.5">
                    ({shift.percentOfTotal.toFixed(0)}%)
                  </span>
                </div>
              </div>
              {/* Bar */}
              <div className="w-full h-2 bg-background/50 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[11px] text-muted-foreground">
                  {shift.totalCount} eventos · motivo top: {reasonLabel}
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
