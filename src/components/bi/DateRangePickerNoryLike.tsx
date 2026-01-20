import { useState, useEffect, useCallback } from 'react';
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
  differenceInDays
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

const STORAGE_KEY = 'bi-date-range-state';

interface StoredState {
  from: string;
  to: string;
  mode: DateMode;
}

export function DateRangePickerNoryLike({
  value,
  onChange,
  mode,
  onModeChange,
  isLoading = false,
  className
}: DateRangePickerNoryLikeProps) {
  const [open, setOpen] = useState(false);
  const [tempRange, setTempRange] = useState<DateRangeValue>(value);
  const [tempMode, setTempMode] = useState<DateMode>(mode);

  const isSingleDay = isSameDay(value.from, value.to);
  const chartGranularity: ChartGranularity = isSingleDay ? 'hourly' : 'daily';

  // Sync temp state when value changes externally
  useEffect(() => {
    setTempRange(value);
    setTempMode(mode);
  }, [value, mode]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: StoredState = JSON.parse(stored);
        const from = new Date(parsed.from);
        const to = new Date(parsed.to);
        if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
          const restoredGranularity: ChartGranularity = isSameDay(from, to) ? 'hourly' : 'daily';
          onChange({ from, to }, parsed.mode, restoredGranularity);
        }
      }
    } catch (e) {
      // Invalid stored state, ignore
    }
  }, []);

  // Save to localStorage when value changes
  useEffect(() => {
    const state: StoredState = {
      from: value.from.toISOString(),
      to: value.to.toISOString(),
      mode
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [value, mode]);

  const formatDateRange = () => {
    if (isSingleDay) {
      return format(value.from, 'dd MMM', { locale: es });
    }
    const fromYear = value.from.getFullYear();
    const toYear = value.to.getFullYear();
    if (fromYear === toYear) {
      return `${format(value.from, 'dd MMM', { locale: es })} – ${format(value.to, 'dd MMM', { locale: es })}`;
    }
    return `${format(value.from, 'dd MMM yy', { locale: es })} – ${format(value.to, 'dd MMM yy', { locale: es })}`;
  };

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
      newTo = endOfMonth(subMonths(value.to, 1));
    }
    
    const newGranularity: ChartGranularity = isSameDay(newFrom, newTo) ? 'hourly' : 'daily';
    onChange({ from: newFrom, to: newTo }, mode, newGranularity);
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
      newTo = endOfMonth(addMonths(value.to, 1));
    }
    
    const newGranularity: ChartGranularity = isSameDay(newFrom, newTo) ? 'hourly' : 'daily';
    onChange({ from: newFrom, to: newTo }, mode, newGranularity);
  }, [value, mode, isSingleDay, onChange]);

  const handleModeChange = (newMode: string) => {
    const m = newMode as DateMode;
    setTempMode(m);
    onModeChange?.(m);
    
    const today = new Date();
    let newFrom: Date, newTo: Date;
    
    if (m === 'daily') {
      newFrom = today;
      newTo = today;
    } else if (m === 'weekly') {
      newFrom = startOfWeek(today, { weekStartsOn: 1 });
      newTo = endOfWeek(today, { weekStartsOn: 1 });
    } else {
      newFrom = startOfMonth(today);
      newTo = endOfMonth(today);
    }
    
    setTempRange({ from: newFrom, to: newTo });
    const newGranularity: ChartGranularity = isSameDay(newFrom, newTo) ? 'hourly' : 'daily';
    onChange({ from: newFrom, to: newTo }, m, newGranularity);
    setOpen(false);
  };

  const handleShortcut = (shortcut: string) => {
    const today = new Date();
    let newFrom: Date, newTo: Date;
    
    switch (shortcut) {
      case 'today':
        newFrom = today;
        newTo = today;
        break;
      case 'yesterday':
        newFrom = subDays(today, 1);
        newTo = subDays(today, 1);
        break;
      case 'day_last_week':
        newFrom = subWeeks(today, 1);
        newTo = subWeeks(today, 1);
        break;
      case 'day_last_month':
        newFrom = subMonths(today, 1);
        newTo = subMonths(today, 1);
        break;
      case 'day_last_year':
        newFrom = new Date(today);
        newFrom.setFullYear(newFrom.getFullYear() - 1);
        newTo = new Date(newFrom);
        break;
      default:
        return;
    }
    
    const newGranularity: ChartGranularity = 'hourly'; // Single day = hourly
    onChange({ from: newFrom, to: newTo }, 'daily', newGranularity);
    onModeChange?.('daily');
    setOpen(false);
  };

  const handleCalendarSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (!range?.from) return;

    let newFrom = range.from;
    let newTo = range.to || range.from;

    if (tempMode === 'weekly') {
      newFrom = startOfWeek(range.from, { weekStartsOn: 1 });
      newTo = endOfWeek(range.from, { weekStartsOn: 1 });
      setTempRange({ from: newFrom, to: newTo });
      const newGranularity: ChartGranularity = 'daily';
      onChange({ from: newFrom, to: newTo }, tempMode, newGranularity);
      setOpen(false);
    } else if (tempMode === 'monthly') {
      newFrom = startOfMonth(range.from);
      newTo = endOfMonth(range.from);
      setTempRange({ from: newFrom, to: newTo });
      const newGranularity: ChartGranularity = 'daily';
      onChange({ from: newFrom, to: newTo }, tempMode, newGranularity);
      setOpen(false);
    } else {
      // Daily mode - range selection
      setTempRange({ from: newFrom, to: newTo });
      if (range.to) {
        const newGranularity: ChartGranularity = isSameDay(newFrom, newTo) ? 'hourly' : 'daily';
        onChange({ from: newFrom, to: newTo }, tempMode, newGranularity);
        setOpen(false);
      }
    }
  };

  // Handle keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const shortcuts = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'day_last_week', label: 'Day last week' },
    { key: 'day_last_month', label: 'Day last month' },
    { key: 'day_last_year', label: 'Day last year' }
  ];

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-[140px]" />
        <Skeleton className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {/* Previous button */}
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-8 w-8 rounded-lg hover:bg-muted/80"
        onClick={navigatePrevious}
        aria-label="Previous period"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* Main date button */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            className={cn(
              "h-8 px-3 min-w-[140px] justify-center gap-2 font-medium",
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
          align="start"
          sideOffset={4}
        >
          <div className="flex">
            {/* Left column - Shortcuts */}
            <div className="w-36 border-r border-border/40 p-2 space-y-0.5">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide px-2 py-1.5">
                Shortcuts
              </p>
              {shortcuts.map(s => (
                <Button 
                  key={s.key} 
                  variant="ghost" 
                  size="sm" 
                  className={cn(
                    "w-full justify-start h-8 text-sm font-normal rounded-md",
                    "hover:bg-primary/10 hover:text-primary"
                  )}
                  onClick={() => handleShortcut(s.key)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
            
            {/* Right column - Calendar */}
            <div className="p-3">
              {/* Mode tabs */}
              <Tabs value={tempMode} onValueChange={handleModeChange} className="mb-3">
                <TabsList className="grid w-full grid-cols-3 h-8 p-0.5 bg-muted/50">
                  <TabsTrigger 
                    value="daily" 
                    className="text-xs h-7 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    Daily
                  </TabsTrigger>
                  <TabsTrigger 
                    value="weekly"
                    className="text-xs h-7 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    Weekly
                  </TabsTrigger>
                  <TabsTrigger 
                    value="monthly"
                    className="text-xs h-7 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    Monthly
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Calendar - Render different modes */}
              {tempMode === 'daily' ? (
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
              ) : (
                <Calendar
                  mode="single"
                  selected={tempRange.from}
                  onSelect={(selected) => {
                    if (selected) {
                      handleCalendarSelect({ from: selected });
                    }
                  }}
                  numberOfMonths={tempMode === 'monthly' ? 1 : 2}
                  locale={es}
                  weekStartsOn={1}
                  className={cn(
                    "pointer-events-auto",
                    tempMode === 'weekly' && "[&_.rdp-day]:rounded-none [&_.rdp-day_button]:rounded-none"
                  )}
                  modifiers={tempMode === 'weekly' ? {
                    selected: (date: Date) => {
                      const weekStart = startOfWeek(tempRange.from, { weekStartsOn: 1 });
                      const weekEnd = endOfWeek(tempRange.from, { weekStartsOn: 1 });
                      return date >= weekStart && date <= weekEnd;
                    }
                  } : undefined}
                  modifiersStyles={tempMode === 'weekly' ? {
                    selected: { 
                      backgroundColor: 'hsl(var(--primary) / 0.15)',
                      color: 'hsl(var(--primary))'
                    }
                  } : undefined}
                />
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Next button */}
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
  );
}
