import { ChevronRight, MoreHorizontal, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DateRangePickerNoryLike, type DateMode, type DateRangeValue } from '@/components/bi/DateRangePickerNoryLike';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/contexts/AppContext';

interface WasteHeaderProps {
  dateRange: DateRangeValue;
  setDateRange: (value: DateRangeValue) => void;
  dateMode: DateMode;
  setDateMode: (value: DateMode) => void;
  selectedLocations: string[];
  setSelectedLocations: (value: string[]) => void;
  onAskJosephine?: () => void;
}

export function WasteHeader({
  dateRange,
  setDateRange,
  dateMode,
  setDateMode,
  selectedLocations,
  setSelectedLocations,
  onAskJosephine
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
