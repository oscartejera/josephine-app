import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

export type DateRangePreset = 'today' | 'week' | 'month';

interface DateRangePickerProps {
  selectedPreset: DateRangePreset;
  onPresetChange: (preset: DateRangePreset) => void;
  startDate: Date;
  endDate: Date;
  onDateRangeChange: (start: Date, end: Date) => void;
}

export function DateRangePicker({
  selectedPreset,
  onPresetChange,
  startDate,
  endDate,
  onDateRangeChange,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getDisplayText = () => {
    if (selectedPreset === 'today') {
      return 'Today';
    } else if (selectedPreset === 'week') {
      return 'This Week';
    } else if (selectedPreset === 'month') {
      return 'This Month';
    }
    // Custom range
    return `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d')}`;
  };

  const handlePrevious = () => {
    let newStart: Date;
    let newEnd: Date;

    if (selectedPreset === 'today') {
      newStart = subDays(startDate, 1);
      newEnd = newStart;
    } else if (selectedPreset === 'week') {
      newStart = subWeeks(startDate, 1);
      newEnd = endOfWeek(newStart, { weekStartsOn: 1 });
    } else if (selectedPreset === 'month') {
      newStart = subMonths(startDate, 1);
      newEnd = endOfMonth(newStart);
    } else {
      // Custom: move by the number of days in current range
      const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      newStart = subDays(startDate, daysDiff + 1);
      newEnd = subDays(endDate, daysDiff + 1);
    }

    onDateRangeChange(newStart, newEnd);
  };

  const handleNext = () => {
    let newStart: Date;
    let newEnd: Date;

    if (selectedPreset === 'today') {
      newStart = addDays(startDate, 1);
      newEnd = newStart;
    } else if (selectedPreset === 'week') {
      newStart = addWeeks(startDate, 1);
      newEnd = endOfWeek(newStart, { weekStartsOn: 1 });
    } else if (selectedPreset === 'month') {
      newStart = addMonths(startDate, 1);
      newEnd = endOfMonth(newStart);
    } else {
      // Custom: move by the number of days in current range
      const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      newStart = addDays(startDate, daysDiff + 1);
      newEnd = addDays(endDate, daysDiff + 1);
    }

    onDateRangeChange(newStart, newEnd);
  };

  const handlePresetClick = (preset: DateRangePreset) => {
    const now = new Date();
    let newStart: Date;
    let newEnd: Date;

    if (preset === 'today') {
      newStart = startOfDay(now);
      newEnd = endOfDay(now);
    } else if (preset === 'week') {
      newStart = startOfWeek(now, { weekStartsOn: 1 });
      newEnd = endOfWeek(now, { weekStartsOn: 1 });
    } else if (preset === 'month') {
      newStart = startOfMonth(now);
      newEnd = endOfMonth(now);
    } else {
      newStart = now;
      newEnd = now;
    }

    onPresetChange(preset);
    onDateRangeChange(newStart, newEnd);
    setIsOpen(false);
  };

  return (
    <div className="flex items-center gap-1 border rounded-lg p-1">
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-8 w-8"
        onClick={handlePrevious}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" className="h-8 px-3">
            <CalendarIcon className="h-4 w-4 mr-2" />
            {getDisplayText()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="center">
          <div className="p-3 space-y-3">
            {/* Preset buttons */}
            <div className="flex gap-2">
              <Button
                variant={selectedPreset === 'today' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePresetClick('today')}
                className="flex-1"
              >
                Today
              </Button>
              <Button
                variant={selectedPreset === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePresetClick('week')}
                className="flex-1"
              >
                Week
              </Button>
              <Button
                variant={selectedPreset === 'month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePresetClick('month')}
                className="flex-1"
              >
                Month
              </Button>
            </div>

            {/* Calendar for custom selection */}
            <div className="border-t pt-3">
              <p className="text-sm font-medium mb-2">Or select custom range:</p>
              <Calendar
                mode="range"
                selected={{
                  from: startDate,
                  to: endDate,
                }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    onDateRangeChange(range.from, range.to);
                    onPresetChange('today'); // Reset preset to indicate custom
                    setIsOpen(false);
                  } else if (range?.from) {
                    // Single day selected
                    onDateRangeChange(range.from, range.from);
                    onPresetChange('today');
                    setIsOpen(false);
                  }
                }}
                locale={es}
                numberOfMonths={1}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Button 
        variant="ghost" 
        size="icon" 
        className="h-8 w-8"
        onClick={handleNext}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
