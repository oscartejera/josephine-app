import { useCallback } from 'react';
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
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const isSingleDay = isSameDay(value.from, value.to);

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

  // Clicking a mode button always jumps to the CURRENT period and sets the mode
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
  }, [onChange, onModeChange]);

  const navigatePrevious = useCallback(() => {
    let newFrom: Date, newTo: Date;

    if (mode === 'daily') {
      newFrom = subDays(value.from, 1);
      newTo = subDays(value.to, 1);
    } else if (mode === 'weekly') {
      newFrom = subWeeks(value.from, 1);
      newTo = subWeeks(value.to, 1);
    } else {
      newFrom = startOfMonth(subMonths(value.from, 1));
      newTo = endOfMonth(subMonths(value.from, 1));
    }

    const granularity: ChartGranularity = isSameDay(newFrom, newTo) ? 'hourly' : 'daily';
    onChange({ from: newFrom, to: newTo }, mode, granularity);
  }, [value, mode, onChange]);

  const navigateNext = useCallback(() => {
    let newFrom: Date, newTo: Date;

    if (mode === 'daily') {
      newFrom = addDays(value.from, 1);
      newTo = addDays(value.to, 1);
    } else if (mode === 'weekly') {
      newFrom = addWeeks(value.from, 1);
      newTo = addWeeks(value.to, 1);
    } else {
      newFrom = startOfMonth(addMonths(value.from, 1));
      newTo = endOfMonth(addMonths(value.from, 1));
    }

    const granularity: ChartGranularity = isSameDay(newFrom, newTo) ? 'hourly' : 'daily';
    onChange({ from: newFrom, to: newTo }, mode, granularity);
  }, [value, mode, onChange]);

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
      {/* Mode buttons: Today | Week | Month */}
      <div className="inline-flex items-center rounded-lg border border-border/60 bg-muted/30 p-0.5">
        {MODE_BUTTONS.map(btn => (
          <button
            key={btn.key}
            onClick={() => handleModeSelect(btn.key)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
              mode === btn.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Navigation: < date range > */}
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

        <div className="h-8 px-3 min-w-[150px] flex items-center justify-center text-sm font-medium border border-border/60 rounded-lg bg-background select-none">
          {formatDateRange()}
        </div>

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
