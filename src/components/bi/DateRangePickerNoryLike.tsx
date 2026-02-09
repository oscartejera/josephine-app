import { useState, useCallback, useEffect } from 'react';
import { 
  format, 
  addDays, 
  subDays, 
  addWeeks, 
  subWeeks, 
  addMonths, 
  subMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isSameDay,
  differenceInDays,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export type DateMode = 'daily' | 'weekly' | 'monthly';
export type ChartGranularity = 'hourly' | 'daily';

export interface DateRangeValue {
  from: Date;
  to: Date;
}

interface DateRangePickerNoryLikeProps {
  value: DateRangeValue;
  onChange: (range: DateRangeValue, mode: DateMode, chartGranularity: ChartGranularity) => void;
  mode: DateMode;
  onModeChange?: (mode: DateMode) => void;
  isLoading?: boolean;
  className?: string;
}

const MODE_BUTTONS: { key: DateMode; label: string }[] = [
  { key: 'daily', label: 'Today' },
  { key: 'weekly', label: 'Week' },
  { key: 'monthly', label: 'Month' },
];

export function DateRangePickerNoryLike({
  value,
  onChange,
  mode,
  onModeChange,
  isLoading = false,
  className
}: DateRangePickerNoryLikeProps) {
  const [open, setOpen] = useState(false);
  const [tempRange, setTempRange] = useState<{ from?: Date; to?: Date }>({
    from: value.from,
    to: value.to,
  });

  const isSingleDay = isSameDay(value.from, value.to);

  // Sync temp range when value changes externally
  useEffect(() => {
    setTempRange({ from: value.from, to: value.to });
  }, [value.from, value.to]);

  const formatDateRange = () => {
    if (isSingleDay) {
      return format(value.from, 'dd MMM yyyy', { locale: es });
    }
    const fromYear = value.from.getFullYear();
    const toYear = value.to.getFullYear();
    if (fromYear === toYear) {
      return `${format(value.from, 'dd MMM', { locale: es })} – ${format(value.to, 'dd MMM', { locale: es })}`;
    }
    return `${format(value.from, 'dd MMM yy', { locale: es })} – ${format(value.to, 'dd MMM yy', { locale: es })}`;
  };

  // Clicking a mode button jumps to the CURRENT period
  const handleModeSelect = useCallback((newMode: DateMode) => {
    const today = new Date();
    let newFrom: Date, newTo: Date;

    if (newMode === 'daily') {
      newFrom = today;
      newTo = today;
    } else if (newMode === 'weekly') {
      newFrom = startOfWeek(today, { weekStartsOn: 1 });
      newTo = endOfWeek(today, { weekStartsOn: 1 });
    } else {
      newFrom = startOfMonth(today);
      newTo = endOfMonth(today);
    }

    onModeChange?.(newMode);
    const granularity: ChartGranularity = isSameDay(newFrom, newTo) ? 'hourly' : 'daily';
    onChange({ from: newFrom, to: newTo }, newMode, granularity);
    setOpen(false);
  }, [onChange, onModeChange]);

  // Calendar range selection
  const handleCalendarSelect = useCallback((range: { from?: Date; to?: Date } | undefined) => {
    if (!range?.from) return;

    setTempRange(range);

    // When both dates are selected, apply the range
    if (range.from && range.to) {
      const newFrom = range.from;
      const newTo = range.to;
      const granularity: ChartGranularity = isSameDay(newFrom, newTo) ? 'hourly' : 'daily';
      onModeChange?.('daily'); // Custom range = daily mode for navigation
      onChange({ from: newFrom, to: newTo }, 'daily', granularity);
      setOpen(false);
    }
  }, [onChange, onModeChange]);

  const navigatePrevious = useCallback(() => {
    let newFrom: Date, newTo: Date;

    if (mode === 'daily') {
      if (isSingleDay) {
        newFrom = subDays(value.from, 1);
        newTo = subDays(value.to, 1);
      } else {
        const rangeDays = differenceInDays(value.to, value.from) + 1;
        newFrom = subDays(value.from, rangeDays);
        newTo = subDays(value.to, rangeDays);
      }
    } else if (mode === 'weekly') {
      newFrom = subWeeks(value.from, 1);
      newTo = subWeeks(value.to, 1);
    } else {
      newFrom = startOfMonth(subMonths(value.from, 1));
      newTo = endOfMonth(subMonths(value.from, 1));
    }

    const granularity: ChartGranularity = isSameDay(newFrom, newTo) ? 'hourly' : 'daily';
    onChange({ from: newFrom, to: newTo }, mode, granularity);
  }, [value, mode, isSingleDay, onChange]);

  const navigateNext = useCallback(() => {
    let newFrom: Date, newTo: Date;

    if (mode === 'daily') {
      if (isSingleDay) {
        newFrom = addDays(value.from, 1);
        newTo = addDays(value.to, 1);
      } else {
        const rangeDays = differenceInDays(value.to, value.from) + 1;
        newFrom = addDays(value.from, rangeDays);
        newTo = addDays(value.to, rangeDays);
      }
    } else if (mode === 'weekly') {
      newFrom = addWeeks(value.from, 1);
      newTo = addWeeks(value.to, 1);
    } else {
      newFrom = startOfMonth(addMonths(value.from, 1));
      newTo = endOfMonth(addMonths(value.from, 1));
    }

    const granularity: ChartGranularity = isSameDay(newFrom, newTo) ? 'hourly' : 'daily';
    onChange({ from: newFrom, to: newTo }, mode, granularity);
  }, [value, mode, isSingleDay, onChange]);

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Skeleton className="h-8 w-[200px]" />
        <Skeleton className="h-8 w-[180px]" />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Navigation: < [calendar popover] > */}
      <div className="inline-flex items-center gap-0.5">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 rounded-lg hover:bg-muted/80"
          onClick={navigatePrevious}
          aria-label="Previous period"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "h-8 px-3 min-w-[150px] justify-center gap-2 font-medium",
                "border-border/60 hover:border-border hover:bg-muted/40",
                "rounded-lg transition-all"
              )}
            >
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{formatDateRange()}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-auto p-0 border-border/60 shadow-lg" 
            align="center"
            sideOffset={4}
          >
            <div className="p-3 space-y-3">
              {/* Mode buttons: Today | Week | Month */}
              <div className="flex gap-2">
                {MODE_BUTTONS.map(btn => (
                  <button
                    key={btn.key}
                    onClick={() => handleModeSelect(btn.key)}
                    className={cn(
                      "flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-all",
                      mode === btn.key
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              {/* Calendar for custom range selection */}
              <Calendar
                mode="range"
                selected={{ from: tempRange.from, to: tempRange.to }}
                onSelect={(selected) => {
                  handleCalendarSelect(selected as { from?: Date; to?: Date });
                }}
                numberOfMonths={2}
                locale={es}
                weekStartsOn={1}
                className="pointer-events-auto"
              />
            </div>
          </PopoverContent>
        </Popover>

        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 rounded-lg hover:bg-muted/80"
          onClick={navigateNext}
          aria-label="Next period"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
