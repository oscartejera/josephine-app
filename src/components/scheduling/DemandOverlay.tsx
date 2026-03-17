/**
 * DemandOverlay — forecast bar chart shown behind the schedule grid.
 *
 * Displays hourly demand forecasts for the selected day so managers
 * can visually compare staffing levels to expected sales volume.
 */

import { useMemo, useState } from 'react';
import { format, addDays } from 'date-fns';
import { BarChart3, TrendingUp, TrendingDown, Clock, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHourlyForecast, type HourlyForecastRow } from '@/hooks/useHourlyForecast';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTranslation } from 'react-i18next';

interface DemandOverlayProps {
  locationId: string | undefined;
  weekStart: Date;
  /** Total scheduled shifts per day index (0=Mon … 6=Sun) */
  scheduledHoursPerDay?: number[];
}

const DAY_LABELS = ['Lun', 'Mar', t('scheduling.mie'), 'Jue', 'Vie', t('scheduling.sab'), 'Dom'];

export function DemandOverlay({ locationId, weekStart, scheduledHoursPerDay }: DemandOverlayProps) {
  const { t } = useTranslation();
  const [selectedDay, setSelectedDay] = useState(0); // 0 = Monday
  const [visible, setVisible] = useState(true);

  const selectedDate = useMemo(() => addDays(weekStart, selectedDay), [weekStart, selectedDay]);

  const { data: hourlyData, isLoading } = useHourlyForecast({
    locationId,
    date: selectedDate,
    enabled: visible && !!locationId,
  });

  // Compute daily forecast totals for the mini bar view
  const dailyForecasts = useMemo(() => {
    return DAY_LABELS.map((label, i) => {
      const scheduled = scheduledHoursPerDay?.[i] ?? 0;
      // We don't call the RPC for all 7 days — we use the scheduled hours
      // as a proxy. Peak days get visual emphasis.
      return { label, scheduled, dayIdx: i };
    });
  }, [scheduledHoursPerDay]);

  // Peak hour from the selected day
  const peakHour = useMemo(() => {
    if (!hourlyData?.length) return null;
    return hourlyData.reduce((best, row) =>
      row.forecast_sales > best.forecast_sales ? row : best
    , hourlyData[0]);
  }, [hourlyData]);

  const totalDaySales = useMemo(() =>
    hourlyData?.reduce((s, r) => s + r.forecast_sales, 0) ?? 0
  , [hourlyData]);

  const maxSales = useMemo(() =>
    hourlyData?.reduce((m, r) => Math.max(m, r.forecast_sales), 0) ?? 1
  , [hourlyData]);

  if (!locationId) return null;

  return (
    <div className="space-y-3">
      {/* Toggle + Day selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setVisible(v => !v)}
          >
            {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            Demand Forecast
          </Button>

          {visible && (
            <div className="flex items-center gap-0.5">
              {DAY_LABELS.map((label, i) => (
                <Button
                  key={i}
                  variant={selectedDay === i ? 'default' : 'ghost'}
                  size="sm"
                  className={cn(
                    "h-6 px-2 text-xs",
                    selectedDay === i && "bg-primary text-primary-foreground"
                  )}
                  onClick={() => setSelectedDay(i)}
                >
                  {label}
                </Button>
              ))}
            </div>
          )}
        </div>

        {visible && peakHour && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              Peak: {peakHour.hour}:00 (€{Math.round(peakHour.forecast_sales)})
            </span>
            <span className="flex items-center gap-1">
              <BarChart3 className="h-3.5 w-3.5" />
              Total: €{Math.round(totalDaySales).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Hourly bars */}
      {visible && (
        <div className="relative">
          {isLoading ? (
            <div className="h-20 flex items-center justify-center text-xs text-muted-foreground">
              Loading forecast…
            </div>
          ) : hourlyData && hourlyData.length > 0 ? (
            <div className="flex items-end gap-px h-20 px-1">
              {hourlyData.map((row) => {
                const heightPct = maxSales > 0 ? (row.forecast_sales / maxSales) * 100 : 0;
                return (
                  <Tooltip key={row.hour}>
                    <TooltipTrigger asChild>
                      <div className="flex-1 flex flex-col items-center gap-0.5">
                        <div
                          className={cn(
                            "w-full rounded-t transition-all duration-300",
                            row.is_peak
                              ? "bg-amber-400/70"
                              : "bg-blue-300/50"
                          )}
                          style={{ height: `${Math.max(heightPct, 4)}%` }}
                        />
                        <span className="text-[9px] text-muted-foreground leading-none">
                          {row.hour}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      <div className="font-semibold">{row.hour}:00</div>
                      <div>€{Math.round(row.forecast_sales)} ({(row.mix_pct * 100).toFixed(1)}%)</div>
                      {row.is_peak && <div className="text-amber-500 font-medium">Peak hour</div>}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ) : (
            <div className="h-20 flex items-center justify-center text-xs text-muted-foreground">
              No forecast data for {format(selectedDate, 'EEEE d MMM')}
            </div>
          )}

          {/* Under/over staffing indicator per day (mini row) */}
          {scheduledHoursPerDay && scheduledHoursPerDay.some(h => h > 0) && (
            <div className="flex items-center gap-1 mt-2 px-1">
              <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
              <div className="flex items-center gap-0.5 flex-1">
                {dailyForecasts.map(({ label, scheduled, dayIdx }) => {
                  // Simple heuristic: > 60h = over, < 20h = under (for a full-service restaurant)
                  const status = scheduled > 50 ? 'over' : scheduled < 15 ? 'under' : 'ok';
                  return (
                    <Tooltip key={dayIdx}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            "flex-1 h-2 rounded-full transition-colors",
                            status === 'over' && "bg-red-300",
                            status === 'under' && "bg-amber-300",
                            status === 'ok' && "bg-emerald-300"
                          )}
                        />
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">
                        {label}: {Math.round(scheduled)}h scheduled
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
