import { ChevronRight, MoreHorizontal, Sparkles, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DateRangePickerNoryLike, type DateMode, type DateRangeValue } from '@/components/bi/DateRangePickerNoryLike';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';

interface WasteHeaderProps {
  dateRange: DateRangeValue;
  setDateRange: (value: DateRangeValue) => void;
  dateMode: DateMode;
  setDateMode: (value: DateMode) => void;
  selectedLocations: string[];
  setSelectedLocations: (value: string[]) => void;
  onAskJosephine?: () => void;
  isConnected?: boolean;
}

export function WasteHeader({
  dateRange,
  setDateRange,
  dateMode,
  setDateMode,
  selectedLocations,
  setSelectedLocations,
  onAskJosephine,
  isConnected = false
}: WasteHeaderProps) {
  const { locations } = useApp();

  const selectedLocationName = selectedLocations.length === 0 || selectedLocations.length === locations.length
    ? 'All locations'
    : selectedLocations.length === 1
    ? locations.find(l => l.id === selectedLocations[0])?.name || 'Location'
    : `${selectedLocations.length} locations`;

  return (
    <div className="space-y-4">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <span>Insights</span>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">Waste</span>
      </div>

      {/* Title and controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <h1 className="text-2xl font-display font-bold">
          Accounted Waste - {selectedLocationName}
        </h1>

        <div className="flex flex-wrap items-center gap-3">
          {/* Live Status Indicator */}
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
                <p>Real-time waste updates active</p>
              ) : (
                <p>Connecting to real-time updates...</p>
              )}
            </TooltipContent>
          </Tooltip>

          {/* Date Range Picker */}
          <DateRangePickerNoryLike
            value={dateRange}
            onChange={setDateRange}
            mode={dateMode}
            onModeChange={setDateMode}
          />

          {/* Location Selector */}
          <Select
            value={selectedLocations.length === 0 ? 'all' : selectedLocations[0]}
            onValueChange={(val) => {
              if (val === 'all') {
                setSelectedLocations([]);
              } else {
                setSelectedLocations([val]);
              }
            }}
          >
            <SelectTrigger className="w-[180px] bg-card border-border">
              <SelectValue placeholder="All locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {locations.map(loc => (
                <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* More actions */}
          <Button variant="outline" size="icon" className="h-9 w-9">
            <MoreHorizontal className="h-4 w-4" />
          </Button>

          {/* Ask Josephine */}
          {onAskJosephine && (
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={onAskJosephine}
            >
              <Sparkles className="h-4 w-4" />
              Ask Josephine
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
