import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { HeatmapCell } from '@/hooks/useWasteShiftAnalysis';

interface WasteHeatmapProps {
  heatmapData: HeatmapCell[];
  isLoading?: boolean;
}

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const HOURS_DISPLAYED = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1];

function getHeatColor(intensity: number): string {
  if (intensity === 0) return 'bg-muted/30';
  if (intensity < 0.2) return 'bg-emerald-500/20';
  if (intensity < 0.4) return 'bg-amber-400/30';
  if (intensity < 0.6) return 'bg-amber-500/50';
  if (intensity < 0.8) return 'bg-orange-500/60';
  return 'bg-red-500/70';
}

export function WasteHeatmap({ heatmapData, isLoading = false }: WasteHeatmapProps) {
  const { grid, maxVal } = useMemo(() => {
    const grid = new Map<string, HeatmapCell>();
    let maxVal = 0;
    heatmapData.forEach(cell => {
      grid.set(`${cell.day}-${cell.hour}`, cell);
      if (cell.value > maxVal) maxVal = cell.value;
    });
    return { grid, maxVal };
  }, [heatmapData]);

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-2"><Skeleton className="h-5 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-[220px] w-full" /></CardContent>
      </Card>
    );
  }

  if (heatmapData.length === 0) return null;

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-foreground">Mapa de Calor — Merma por Día × Hora</CardTitle>
        <p className="text-xs text-muted-foreground">Identifica cuándo ocurren las mermas para optimizar turnos</p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Hour labels */}
            <div className="flex gap-[2px] mb-1 pl-10">
              {HOURS_DISPLAYED.map(h => (
                <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground tabular-nums">
                  {h.toString().padStart(2, '0')}
                </div>
              ))}
            </div>

            {/* Grid rows */}
            {[1, 2, 3, 4, 5, 6, 0].map(day => (
              <div key={day} className="flex items-center gap-[2px] mb-[2px]">
                <div className="w-9 text-right text-[11px] text-muted-foreground font-medium pr-1">
                  {DAY_LABELS[day]}
                </div>
                {HOURS_DISPLAYED.map(hour => {
                  const cell = grid.get(`${day}-${hour}`);
                  const value = cell?.value || 0;
                  const intensity = maxVal > 0 ? value / maxVal : 0;
                  const color = getHeatColor(intensity);

                  return (
                    <div
                      key={`${day}-${hour}`}
                      className={`flex-1 aspect-square rounded-[3px] ${color} transition-colors cursor-default relative group`}
                      title={`${DAY_LABELS[day]} ${hour}:00 — €${value.toFixed(0)} (${cell?.count || 0} eventos)`}
                    >
                      {/* Tooltip on hover */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                        <div className="bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded shadow-md whitespace-nowrap border">
                          {DAY_LABELS[day]} {hour}:00 · €{value.toFixed(0)} · {cell?.count || 0} evt
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Legend */}
            <div className="flex items-center justify-end gap-1 mt-3">
              <span className="text-[10px] text-muted-foreground mr-1">Menos</span>
              {[0, 0.15, 0.35, 0.55, 0.75, 0.95].map((i, idx) => (
                <div key={idx} className={`w-3 h-3 rounded-[2px] ${getHeatColor(i)}`} />
              ))}
              <span className="text-[10px] text-muted-foreground ml-1">Más</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
