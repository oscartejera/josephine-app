import { CalendarDays, Download, MapPin, Building2, Menu, ChevronLeft, ChevronRight } from 'lucide-react';
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
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState, useEffect } from 'react';
import { DateRange } from 'react-day-picker';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { cn } from '@/lib/utils';

interface TopBarProps {
  onMenuClick: () => void;
}

type QuickOption = 'today' | 'yesterday' | 'last7d' | 'last30d' | 'thisWeek' | 'thisMonth' | 'custom';

export function TopBar({ onMenuClick }: TopBarProps) {
  const {
    group,
    accessibleLocations,
    selectedLocationId,
    setSelectedLocationId,
    dateRange,
    setDateRange,
    customDateRange,
    setCustomDateRange,
    canShowAllLocations
  } = useApp();

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [tempRange, setTempRange] = useState<DateRange | undefined>();
  const [quickOption, setQuickOption] = useState<QuickOption>('today');

  // Sync quickOption with dateRange from context
  useEffect(() => {
    if (dateRange === 'today') setQuickOption('today');
    else if (dateRange === '7d') setQuickOption('last7d');
    else if (dateRange === '30d') setQuickOption('last30d');
    else if (dateRange === 'custom') setQuickOption('custom');
  }, [dateRange]);

  const getQuickOptionDates = (option: QuickOption): { from: Date; to: Date } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();
    
    switch (option) {
      case 'today':
        return { from: today, to: now };
      case 'yesterday':
        const yesterday = subDays(today, 1);
        return { from: yesterday, to: yesterday };
      case 'last7d':
        return { from: subDays(today, 7), to: now };
      case 'last30d':
        return { from: subDays(today, 30), to: now };
      case 'thisWeek':
        return { from: startOfWeek(today, { weekStartsOn: 1 }), to: endOfWeek(today, { weekStartsOn: 1 }) };
      case 'thisMonth':
        return { from: startOfMonth(today), to: endOfMonth(today) };
      default:
        return customDateRange || { from: today, to: now };
    }
  };

  const handleQuickOptionSelect = (option: QuickOption) => {
    setQuickOption(option);
    if (option === 'custom') {
      setCalendarOpen(true);
      return;
    }
    
    const dates = getQuickOptionDates(option);
    setCustomDateRange(dates);
    
    // Map to context dateRange
    if (option === 'today') setDateRange('today');
    else if (option === 'last7d') setDateRange('7d');
    else if (option === 'last30d') setDateRange('30d');
    else setDateRange('custom');
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    setTempRange(range);
    if (range?.from && range?.to) {
      setCustomDateRange({ from: range.from, to: range.to });
      setDateRange('custom');
      setQuickOption('custom');
      setCalendarOpen(false);
    }
  };

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const current = customDateRange || getQuickOptionDates(quickOption);
    const daysDiff = Math.ceil((current.to.getTime() - current.from.getTime()) / (1000 * 60 * 60 * 24));
    
    let newFrom: Date;
    let newTo: Date;
    
    if (daysDiff <= 1) {
      // Single day - move by 1 day
      newFrom = direction === 'next' ? addDays(current.from, 1) : subDays(current.from, 1);
      newTo = newFrom;
    } else if (daysDiff <= 7) {
      // Week range - move by week
      newFrom = direction === 'next' ? addDays(current.from, 7) : subDays(current.from, 7);
      newTo = direction === 'next' ? addDays(current.to, 7) : subDays(current.to, 7);
    } else {
      // Month or custom range - move by the range size
      newFrom = direction === 'next' ? addDays(current.from, daysDiff) : subDays(current.from, daysDiff);
      newTo = direction === 'next' ? addDays(current.to, daysDiff) : subDays(current.to, daysDiff);
    }
    
    setCustomDateRange({ from: newFrom, to: newTo });
    setDateRange('custom');
    setQuickOption('custom');
  };

  const getDateLabel = (): string => {
    const dates = customDateRange || getQuickOptionDates(quickOption);
    const isSameDay = dates.from.toDateString() === dates.to.toDateString();
    
    if (isSameDay) {
      return format(dates.from, "d MMM yyyy", { locale: es });
    }
    return `${format(dates.from, "d MMM", { locale: es })} - ${format(dates.to, "d MMM yyyy", { locale: es })}`;
  };

  const handleExport = () => {
    console.log('Export CSV');
  };

  const quickOptions: { value: QuickOption; label: string }[] = [
    { value: 'today', label: 'Hoy' },
    { value: 'yesterday', label: 'Ayer' },
    { value: 'last7d', label: 'Últimos 7 días' },
    { value: 'last30d', label: 'Últimos 30 días' },
    { value: 'thisWeek', label: 'Esta semana' },
    { value: 'thisMonth', label: 'Este mes' },
    { value: 'custom', label: 'Personalizado' },
  ];

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
            {/* Always show All locations option */}
            <SelectItem value="all">Todos los locales</SelectItem>
            {accessibleLocations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <NotificationCenter />
        
        {/* Date range picker with navigation */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
          {/* Previous period button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigatePeriod('prev')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* Date selector popover */}
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "h-8 px-3 text-sm font-medium gap-2",
                  "hover:bg-muted"
                )}
              >
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="hidden sm:inline">{getDateLabel()}</span>
                <span className="sm:hidden">{format(customDateRange?.from || new Date(), "d MMM", { locale: es })}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="flex">
                {/* Quick options sidebar */}
                <div className="border-r border-border p-2 space-y-1 min-w-[140px]">
                  {quickOptions.map((option) => (
                    <Button
                      key={option.value}
                      variant={quickOption === option.value ? "secondary" : "ghost"}
                      size="sm"
                      className="w-full justify-start text-sm"
                      onClick={() => handleQuickOptionSelect(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
                
                {/* Calendar */}
                <div className="p-2">
                  <Calendar
                    mode="range"
                    selected={tempRange || (customDateRange ? { from: customDateRange.from, to: customDateRange.to } : undefined)}
                    onSelect={handleCalendarSelect}
                    numberOfMonths={2}
                    locale={es}
                    className={cn("p-3 pointer-events-auto")}
                    disabled={(date) => date > new Date()}
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Next period button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigatePeriod('next')}
            disabled={customDateRange?.to && customDateRange.to >= new Date()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

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
