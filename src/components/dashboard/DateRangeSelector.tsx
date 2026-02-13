import { useState } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import type { DateRangePreset } from '@/hooks/useDashboardMetrics';

interface DateRangeSelectorProps {
  value: DateRangePreset;
  customRange: { from: Date; to: Date } | null;
  onChange: (preset: DateRangePreset) => void;
  onCustomChange: (range: { from: Date; to: Date }) => void;
}

const presetLabels: Record<Exclude<DateRangePreset, 'custom'>, string> = {
  today: 'Hoy',
  '7d': '7 días',
  '30d': '30 días',
};

export function DateRangeSelector({ value, customRange, onChange, onCustomChange }: DateRangeSelectorProps) {
  const [calOpen, setCalOpen] = useState(false);
  const [pendingFrom, setPendingFrom] = useState<Date | undefined>(customRange?.from);

  const handlePreset = (v: string) => {
    if (v && v !== 'custom') {
      onChange(v as DateRangePreset);
    }
  };

  const handleDayClick = (day: Date) => {
    if (!pendingFrom) {
      setPendingFrom(day);
    } else {
      const from = day < pendingFrom ? day : pendingFrom;
      const to = day < pendingFrom ? pendingFrom : day;
      onCustomChange({ from, to });
      onChange('custom');
      setPendingFrom(undefined);
      setCalOpen(false);
    }
  };

  const customLabel = value === 'custom' && customRange
    ? `${customRange.from.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} – ${customRange.to.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}`
    : 'Personalizado';

  return (
    <div className="flex items-center gap-2">
      <ToggleGroup type="single" value={value} onValueChange={handlePreset} size="sm">
        {Object.entries(presetLabels).map(([key, label]) => (
          <ToggleGroupItem key={key} value={key} className="text-xs px-3">
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <Popover open={calOpen} onOpenChange={(open) => { setCalOpen(open); if (!open) setPendingFrom(undefined); }}>
        <PopoverTrigger asChild>
          <Button
            variant={value === 'custom' ? 'default' : 'outline'}
            size="sm"
            className="text-xs gap-1.5"
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {customLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={pendingFrom}
            onDayClick={handleDayClick}
            disabled={{ after: new Date() }}
            initialFocus
          />
          {pendingFrom && (
            <p className="text-xs text-muted-foreground text-center pb-2">
              Selecciona la fecha de fin
            </p>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
