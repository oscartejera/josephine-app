import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { CalendarIcon, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useApp, type Location } from '@/contexts/AppContext';
import type { DatePreset } from '@/hooks/useMenuEngineeringData';
import { DateRange } from 'react-day-picker';

interface MenuEngineeringHeaderProps {
  selectedLocationId: string | null;
  onLocationChange: (id: string | null) => void;
  datePreset: DatePreset;
  onDatePresetChange: (preset: DatePreset) => void;
  customDateFrom: Date;
  customDateTo: Date;
  onCustomDateFromChange: (date: Date) => void;
  onCustomDateToChange: (date: Date) => void;
  categories: string[];
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  includeLowData: boolean;
  onIncludeLowDataChange: (include: boolean) => void;
  usePerCategoryThresholds: boolean;
  onPerCategoryThresholdsChange: (use: boolean) => void;
  onRefresh: () => void;
  loading: boolean;
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
  includeLowData,
  onIncludeLowDataChange,
  usePerCategoryThresholds,
  onPerCategoryThresholdsChange,
  onRefresh,
  loading,
}: MenuEngineeringHeaderProps) {
  const { accessibleLocations, canShowAllLocations } = useApp();
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
    switch (datePreset) {
      case 'last7':
        return 'Últimos 7 días';
      case 'last30':
        return 'Últimos 30 días';
      case 'custom':
        return `${format(customDateFrom, 'dd MMM', { locale: es })} - ${format(customDateTo, 'dd MMM', { locale: es })}`;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Menu Engineering</h1>
          <p className="text-muted-foreground">Análisis de rentabilidad y popularidad del menú</p>
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Location selector */}
        <Select 
          value={selectedLocationId || ''} 
          onValueChange={(v) => onLocationChange(v || null)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Seleccionar ubicación" />
          </SelectTrigger>
          <SelectContent>
            {canShowAllLocations && (
              <SelectItem value="all">Todas las ubicaciones</SelectItem>
            )}
            {accessibleLocations.map((loc: Location) => (
              <SelectItem key={loc.id} value={loc.id}>
                {loc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date range selector */}
        <div className="flex items-center gap-2">
          <Select 
            value={datePreset} 
            onValueChange={(v) => onDatePresetChange(v as DatePreset)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
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
                <Button variant="outline" size="sm" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {getDateLabel()}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={tempRange}
                  onSelect={handleCalendarSelect}
                  locale={es}
                  numberOfMonths={2}
                  defaultMonth={customDateFrom}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* Category filter */}
        <Select 
          value={selectedCategory || 'all'} 
          onValueChange={(v) => onCategoryChange(v === 'all' ? null : v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorías</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Toggles */}
        <div className="flex items-center gap-4 ml-auto">
          {/* Per-category thresholds toggle - only show when "All categories" selected */}
          {!selectedCategory && (
            <div className="flex items-center gap-2">
              <Switch
                id="per-category-thresholds"
                checked={usePerCategoryThresholds}
                onCheckedChange={onPerCategoryThresholdsChange}
              />
              <Label htmlFor="per-category-thresholds" className="text-sm cursor-pointer">
                Umbrales por categoría
              </Label>
            </div>
          )}
          
          {/* Include low data toggle */}
          <div className="flex items-center gap-2">
            <Switch
              id="include-low-data"
              checked={includeLowData}
              onCheckedChange={onIncludeLowDataChange}
            />
            <Label htmlFor="include-low-data" className="text-sm cursor-pointer">
              Incluir low data
            </Label>
          </div>
        </div>
      </div>
    </div>
  );
}
