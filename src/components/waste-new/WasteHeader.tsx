import { ChevronRight, MoreHorizontal } from 'lucide-react';
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
}

export function WasteHeader({
  dateRange,
  setDateRange,
  dateMode,
  setDateMode,
  selectedLocations,
  setSelectedLocations,
}: WasteHeaderProps) {
  const { locations } = useApp();

  const selectedLocationName = selectedLocations.length === 0 || selectedLocations.length === locations.length
    ? 'All locations'
    : selectedLocations.length === 1
    ? locations.find(l => l.id === selectedLocations[0])?.name || 'Location'
    : `${selectedLocations.length} locations`;

  return (
    <div className="space-y-3">
      {/* Breadcrumbs and date picker */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Insights</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">Waste</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        
        <DateRangePickerNoryLike
          value={dateRange}
          onChange={setDateRange}
          mode={dateMode}
          onModeChange={setDateMode}
        />
      </div>

      {/* Title and location selector */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">
          Accounted Waste - {selectedLocationName}
        </h1>

        <div className="flex items-center gap-2">
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
            <SelectTrigger className="w-[140px] h-8 text-sm bg-card border-border">
              <SelectValue placeholder="All locations" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">All locations</SelectItem>
              {locations.map(loc => (
                <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
