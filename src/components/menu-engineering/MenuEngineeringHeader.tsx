import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DatePreset } from '@/hooks/useMenuEngineeringData';
import { DateRange } from 'react-day-picker';

interface Location {
  id: string;
  name: string;
}

interface MenuEngineeringHeaderProps {
  selectedLocationId: string | null;
  onLocationChange: (id: string | null) => void;
  datePreset: DatePreset;
  onDatePresetChange: (preset: DatePreset) => void;
  customDateFrom?: Date;
  customDateTo?: Date;
  onCustomDateFromChange: (date: Date | undefined) => void;
  onCustomDateToChange: (date: Date | undefined) => void;
  categories: string[];
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  onRefresh: () => void;
  loading: boolean;
  accessibleLocations: Location[];
}

export function MenuEngineeringHeader({
  selectedLocationId,
  onLocationChange,
  datePreset,
  onDatePresetChange,
  customDateFrom,
  customDateTo,
  onCustomDateFromChange,
  onCustomDateToChange,
  categories,
  selectedCategory,
  onCategoryChange,
  onRefresh,
  loading,
  accessibleLocations,
}: MenuEngineeringHeaderProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [tempRange, setTempRange] = useState<DateRange | undefined>({
    from: customDateFrom,
    to: customDateTo,
  });

  const handleCalendarSelect = (range: DateRange | undefined) => {
    setTempRange(range);
    if (range?.from && range?.to) {
      onCustomDateFromChange(range.from);
      onCustomDateToChange(range.to);
      onDatePresetChange('custom');
      setCalendarOpen(false);
    }
  };

  const getDateLabel = () => {
    if (datePreset === 'last7') return 'Últimos 7 días';
    if (datePreset === 'last30') return 'Últimos 30 días';
    if (customDateFrom && customDateTo) {
      return `${format(customDateFrom, 'dd MMM', { locale: es })} - ${format(customDateTo, 'dd MMM', { locale: es })}`;
    }
    return 'Seleccionar';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Rentabilidad del Menú</h1>
          <p className="text-muted-foreground">Descubre qué productos te dejan más dinero</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedLocationId || 'all'} onValueChange={(v) => onLocationChange(v === 'all' ? null : v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Local" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los locales</SelectItem>
            {accessibleLocations.map((loc) => (
              <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Select value={datePreset} onValueChange={(v) => onDatePresetChange(v as DatePreset)}>
            <SelectTrigger className="w-40">
              <SelectValue>{getDateLabel()}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last7">Últimos 7 días</SelectItem>
              <SelectItem value="last30">Últimos 30 días</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>

          {datePreset === 'custom' && (
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm"><CalendarIcon className="h-4 w-4" /></Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="range" selected={tempRange} onSelect={handleCalendarSelect} locale={es} numberOfMonths={2} />
              </PopoverContent>
            </Popover>
          )}
        </div>

        <Select value={selectedCategory || 'all'} onValueChange={(v) => onCategoryChange(v === 'all' ? null : v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
