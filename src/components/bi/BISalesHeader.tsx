import { ChevronDown, Sparkles, MoreHorizontal, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { CompareMode, GranularityMode, BIDateRange } from '@/types/sales';
import { Checkbox } from '@/components/ui/checkbox';
import { DateRangePickerNoryLike, DateMode, ChartGranularity } from './DateRangePickerNoryLike';
import { formatDistanceToNow } from 'date-fns';

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
  isConnected?: boolean;
  lastUpdate?: Date | null;
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
  onAskJosephine,
  isConnected = false,
  lastUpdate = null
}: BISalesHeaderProps) {
  const { locations } = useApp();
  const [locationsOpen, setLocationsOpen] = useState(false);

  // Map granularity to DateMode
  const dateMode: DateMode = granularity === 'daily' ? 'daily' : granularity === 'weekly' ? 'weekly' : 'monthly';

  const handleDateChange = (range: BIDateRange, mode: DateMode, chartGranularity: ChartGranularity) => {
    setDateRange(range);
    // Map DateMode back to GranularityMode
    setGranularity(mode as GranularityMode);
  };

  const handleModeChange = (mode: DateMode) => {
    setGranularity(mode as GranularityMode);
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

          {/* Date Range Picker */}
          <div className="ml-4">
            <DateRangePickerNoryLike
              value={dateRange}
              onChange={handleDateChange}
              mode={dateMode}
              onModeChange={handleModeChange}
            />
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

        {/* Live Status + Ask Josephine button */}
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={cn(
                  "gap-1.5 cursor-default transition-colors",
                  isConnected
                    ? "text-success border-success/30 bg-success/5"
                    : "text-muted-foreground border-border"
                )}
              >
                {isConnected ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                    </span>
                    Live
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3" />
                    Offline
                  </>
                )}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              {isConnected ? (
                <p>Real-time updates active{lastUpdate ? `. Last update: ${formatDistanceToNow(lastUpdate, { addSuffix: true })}` : ''}</p>
              ) : (
                <p>Connecting to real-time updates...</p>
              )}
            </TooltipContent>
          </Tooltip>

          <Button
            onClick={onAskJosephine}
            className="bg-gradient-primary text-white gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Ask Josephine
          </Button>
        </div>
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