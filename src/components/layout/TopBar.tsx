import { CalendarDays, Download, MapPin, Building2, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useApp } from '@/contexts/AppContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState } from 'react';
import { DateRange } from 'react-day-picker';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const {
    group,
    locations,
    selectedLocationId,
    setSelectedLocationId,
    dateRange,
    setDateRange,
    customDateRange,
    setCustomDateRange,
    getDateRangeValues
  } = useApp();

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [tempRange, setTempRange] = useState<DateRange | undefined>();

  const handleDateRangeChange = (value: string) => {
    if (value === 'custom') {
      setCalendarOpen(true);
    } else {
      setDateRange(value as 'today' | '7d' | '30d');
    }
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    setTempRange(range);
    if (range?.from && range?.to) {
      setCustomDateRange({ from: range.from, to: range.to });
      setDateRange('custom');
      setCalendarOpen(false);
    }
  };

  const dateRangeValues = getDateRangeValues();
  const dateRangeLabel = dateRange === 'custom' && customDateRange
    ? `${format(customDateRange.from, 'dd MMM', { locale: es })} - ${format(customDateRange.to, 'dd MMM', { locale: es })}`
    : dateRange === 'today' ? 'Hoy'
    : dateRange === '7d' ? 'Últimos 7 días'
    : 'Últimos 30 días';

  const handleExport = () => {
    // TODO: Implement CSV export
    console.log('Export CSV');
  };

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>

        {/* Group selector (read-only for now) */}
        <div className="hidden md:flex items-center gap-2 text-sm">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{group?.name || 'Grupo'}</span>
        </div>

        {/* Location selector */}
        <Select value={selectedLocationId || ''} onValueChange={setSelectedLocationId}>
          <SelectTrigger className="w-[180px] md:w-[200px]">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Seleccionar local" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los locales</SelectItem>
            {locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <NotificationCenter />
        {/* Date range selector */}
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <div className="flex items-center">
            <Select value={dateRange} onValueChange={handleDateRangeChange}>
              <SelectTrigger className="w-[140px] md:w-[180px]">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{dateRangeLabel}</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoy</SelectItem>
                <SelectItem value="7d">Últimos 7 días</SelectItem>
                <SelectItem value="30d">Últimos 30 días</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <PopoverTrigger asChild>
            <span className="hidden" />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={tempRange}
              onSelect={handleCalendarSelect}
              numberOfMonths={2}
              locale={es}
            />
          </PopoverContent>
        </Popover>

        {/* Export button */}
        <Button variant="outline" size="sm" className="hidden md:flex gap-2" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Export
        </Button>
        <Button variant="outline" size="icon" className="md:hidden" onClick={handleExport}>
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
