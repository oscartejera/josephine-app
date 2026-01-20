import { format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, ChevronDown, Sparkles, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { CompareMode, GranularityMode, BIDateRange } from '@/pages/BISales';
import { Checkbox } from '@/components/ui/checkbox';

interface BISalesHeaderProps {
  dateRange: BIDateRange;
  setDateRange: (range: BIDateRange) => void;
  granularity: GranularityMode;
  setGranularity: (mode: GranularityMode) => void;
  compareMode: CompareMode;
  setCompareMode: (mode: CompareMode) => void;
  selectedLocations: string[];
  setSelectedLocations: (ids: string[]) => void;
  onAskJosephine: () => void;
}

export function BISalesHeader({
  dateRange,
  setDateRange,
  granularity,
  setGranularity,
  compareMode,
  setCompareMode,
  selectedLocations,
  setSelectedLocations,
  onAskJosephine
}: BISalesHeaderProps) {
  const { locations } = useApp();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [locationsOpen, setLocationsOpen] = useState(false);

  const isSingleDay = isSameDay(dateRange.from, dateRange.to);

  const formatDateRange = () => {
    if (isSingleDay) {
      return format(dateRange.from, 'dd MMM yyyy', { locale: es });
    }
    const fromYear = dateRange.from.getFullYear();
    const toYear = dateRange.to.getFullYear();
    if (fromYear === toYear) {
      return `${format(dateRange.from, 'dd MMM', { locale: es })} – ${format(dateRange.to, 'dd MMM', { locale: es })}`;
    }
    return `${format(dateRange.from, 'dd MMM yyyy', { locale: es })} – ${format(dateRange.to, 'dd MMM yyyy', { locale: es })}`;
  };

  const navigatePrevious = () => {
    if (granularity === 'daily') {
      setDateRange({
        from: subDays(dateRange.from, 1),
        to: subDays(dateRange.to, 1)
      });
    } else if (granularity === 'weekly') {
      setDateRange({
        from: subWeeks(dateRange.from, 1),
        to: subWeeks(dateRange.to, 1)
      });
    } else {
      setDateRange({
        from: subMonths(dateRange.from, 1),
        to: subMonths(dateRange.to, 1)
      });
    }
  };

  const navigateNext = () => {
    if (granularity === 'daily') {
      setDateRange({
        from: addDays(dateRange.from, 1),
        to: addDays(dateRange.to, 1)
      });
    } else if (granularity === 'weekly') {
      setDateRange({
        from: addWeeks(dateRange.from, 1),
        to: addWeeks(dateRange.to, 1)
      });
    } else {
      setDateRange({
        from: addMonths(dateRange.from, 1),
        to: addMonths(dateRange.to, 1)
      });
    }
  };

  const handleGranularityChange = (value: string) => {
    const today = new Date();
    setGranularity(value as GranularityMode);
    
    if (value === 'daily') {
      setDateRange({ from: today, to: today });
    } else if (value === 'weekly') {
      setDateRange({ 
        from: startOfWeek(today, { weekStartsOn: 1 }), 
        to: endOfWeek(today, { weekStartsOn: 1 }) 
      });
    } else {
      setDateRange({ 
        from: startOfMonth(today), 
        to: endOfMonth(today) 
      });
    }
  };

  const handleShortcut = (shortcut: string) => {
    const today = new Date();
    switch (shortcut) {
      case 'today':
        setDateRange({ from: today, to: today });
        setGranularity('daily');
        break;
      case 'yesterday':
        const yesterday = subDays(today, 1);
        setDateRange({ from: yesterday, to: yesterday });
        setGranularity('daily');
        break;
      case 'day_last_week':
        const dayLastWeek = subWeeks(today, 1);
        setDateRange({ from: dayLastWeek, to: dayLastWeek });
        setGranularity('daily');
        break;
      case 'day_last_month':
        const dayLastMonth = subMonths(today, 1);
        setDateRange({ from: dayLastMonth, to: dayLastMonth });
        setGranularity('daily');
        break;
      case 'day_last_year':
        const dayLastYear = new Date(today);
        dayLastYear.setFullYear(dayLastYear.getFullYear() - 1);
        setDateRange({ from: dayLastYear, to: dayLastYear });
        setGranularity('daily');
        break;
    }
    setCalendarOpen(false);
  };

  const toggleLocation = (locationId: string) => {
    if (selectedLocations.includes(locationId)) {
      setSelectedLocations(selectedLocations.filter(id => id !== locationId));
    } else {
      setSelectedLocations([...selectedLocations, locationId]);
    }
  };

  const selectAllLocations = () => {
    if (selectedLocations.length === locations.length) {
      setSelectedLocations([]);
    } else {
      setSelectedLocations(locations.map(l => l.id));
    }
  };

  const locationsLabel = selectedLocations.length === 0 || selectedLocations.length === locations.length
    ? 'All locations'
    : selectedLocations.length === 1
    ? locations.find(l => l.id === selectedLocations[0])?.name || 'Location'
    : `${selectedLocations.length} locations`;

  return (
    <div className="space-y-4">
      {/* Row 1: Breadcrumbs, Date selector, Compare, Ask Josephine */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Breadcrumb dropdowns */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 px-2 text-muted-foreground gap-1">
                Insights
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Sales Insights</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="text-muted-foreground">/</span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 px-2 font-semibold gap-1">
                Sales
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Sales</DropdownMenuItem>
              <DropdownMenuItem disabled>Orders (coming soon)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Date navigation */}
          <div className="flex items-center gap-1 ml-4">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navigatePrevious}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-8 px-3 min-w-[180px] justify-center font-medium">
                  {formatDateRange()}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="flex">
                  {/* Shortcuts */}
                  <div className="w-40 border-r p-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Shortcuts</p>
                    {[
                      { key: 'today', label: 'Today' },
                      { key: 'yesterday', label: 'Yesterday' },
                      { key: 'day_last_week', label: 'Day last week' },
                      { key: 'day_last_month', label: 'Day last month' },
                      { key: 'day_last_year', label: 'Day last year' }
                    ].map(s => (
                      <Button 
                        key={s.key} 
                        variant="ghost" 
                        size="sm" 
                        className="w-full justify-start h-8 text-sm"
                        onClick={() => handleShortcut(s.key)}
                      >
                        {s.label}
                      </Button>
                    ))}
                  </div>
                  
                  {/* Calendar with tabs */}
                  <div className="p-3">
                    <Tabs value={granularity} onValueChange={handleGranularityChange} className="mb-3">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="daily">Daily</TabsTrigger>
                        <TabsTrigger value="weekly">Weekly</TabsTrigger>
                        <TabsTrigger value="monthly">Monthly</TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <Calendar
                      mode="range"
                      selected={{ from: dateRange.from, to: dateRange.to }}
                      onSelect={(range) => {
                        if (range?.from) {
                          setDateRange({ 
                            from: range.from, 
                            to: range.to || range.from 
                          });
                          if (range.to) {
                            setCalendarOpen(false);
                          }
                        }
                      }}
                      numberOfMonths={2}
                      locale={es}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navigateNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Compare dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-8 gap-2">
                Compare: {compareMode === 'forecast' ? 'Forecast' : compareMode === 'previous_period' ? 'Previous period' : 'Previous year'}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setCompareMode('forecast')}>
                Forecast
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCompareMode('previous_period')}>
                Previous period
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCompareMode('previous_year')}>
                Previous year
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Ask Josephine button */}
        <Button 
          onClick={onAskJosephine}
          className="bg-gradient-primary text-white gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Ask Josephine
        </Button>
      </div>

      {/* Row 2: Location selector */}
      <div className="flex items-center gap-2">
        <Popover open={locationsOpen} onOpenChange={setLocationsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-9 gap-2">
              {locationsLabel}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <div className="space-y-2">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Checkbox 
                  id="all-locations"
                  checked={selectedLocations.length === 0 || selectedLocations.length === locations.length}
                  onCheckedChange={selectAllLocations}
                />
                <label htmlFor="all-locations" className="text-sm font-medium cursor-pointer">
                  All locations
                </label>
              </div>
              {locations.map(loc => (
                <div key={loc.id} className="flex items-center gap-2">
                  <Checkbox 
                    id={loc.id}
                    checked={selectedLocations.includes(loc.id) || selectedLocations.length === 0}
                    onCheckedChange={() => toggleLocation(loc.id)}
                  />
                  <label htmlFor={loc.id} className="text-sm cursor-pointer">
                    {loc.name}
                  </label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button variant="ghost" size="icon" className="h-9 w-9">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
