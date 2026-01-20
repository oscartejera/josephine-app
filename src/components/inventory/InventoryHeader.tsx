import { ChevronDown, Sparkles, RefreshCw, MoreHorizontal, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useApp } from '@/contexts/AppContext';
import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { DateRangePickerNoryLike, DateMode, ChartGranularity, DateRangeValue } from '@/components/bi/DateRangePickerNoryLike';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate, useLocation } from 'react-router-dom';
import { resetDemoGenerator } from '@/lib/demoDataGenerator';
import { toast } from 'sonner';

export type ViewMode = 'COGS' | 'GP';

interface InventoryHeaderProps {
  dateRange: DateRangeValue;
  setDateRange: (range: DateRangeValue) => void;
  dateMode: DateMode;
  setDateMode: (mode: DateMode) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  selectedLocations: string[];
  setSelectedLocations: (ids: string[]) => void;
  onAskJosephine: () => void;
  onReseedData?: () => void;
  lastUpdated?: Date | null;
  isLoading?: boolean;
  showViewToggle?: boolean;
  breadcrumbs?: { label: string; path?: string }[];
}

export function InventoryHeader({
  dateRange,
  setDateRange,
  dateMode,
  setDateMode,
  viewMode,
  setViewMode,
  selectedLocations,
  setSelectedLocations,
  onAskJosephine,
  onReseedData,
  lastUpdated,
  isLoading = false,
  showViewToggle = true,
  breadcrumbs = [{ label: 'Insights' }, { label: 'Inventory' }]
}: InventoryHeaderProps) {
  const { locations } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [locationsOpen, setLocationsOpen] = useState(false);

  const handleReseedData = () => {
    resetDemoGenerator();
    toast.success('Demo data regenerated', {
      description: 'New realistic data has been generated for all locations.'
    });
    if (onReseedData) {
      onReseedData();
    }
  };

  const handleDateChange = (range: DateRangeValue, mode: DateMode, chartGranularity: ChartGranularity) => {
    setDateRange(range);
    setDateMode(mode);
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

  const lastUpdatedText = lastUpdated 
    ? `Last updated ${formatDistanceToNow(lastUpdated, { addSuffix: false, locale: es })} ago`
    : 'Updating...';

  return (
    <div className="space-y-4">
      {/* Row 1: Breadcrumbs, Date selector, View Toggle, Ask Josephine */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Breadcrumb dropdowns */}
          {breadcrumbs.map((crumb, index) => (
            <div key={index} className="flex items-center gap-3">
              {index > 0 && <span className="text-muted-foreground">/</span>}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className={`h-8 px-2 gap-1 ${index === breadcrumbs.length - 1 ? 'font-semibold' : 'text-muted-foreground'}`}
                  >
                    {crumb.label}
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => navigate('/inventory')}>
                    Inventory Overview
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/inventory/reconciliation')}>
                    Reconciliation Report
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}

          {/* Date Range Picker */}
          <div className="ml-4">
            <DateRangePickerNoryLike
              value={dateRange}
              onChange={handleDateChange}
              mode={dateMode}
              onModeChange={setDateMode}
              isLoading={isLoading}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* GP / COGS Toggle */}
          {showViewToggle && (
            <div className="flex items-center bg-muted rounded-full p-0.5">
              <button
                onClick={() => setViewMode('GP')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  viewMode === 'GP' 
                    ? 'bg-success text-white shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                GP
              </button>
              <button
                onClick={() => setViewMode('COGS')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  viewMode === 'COGS' 
                    ? 'bg-warning text-white shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                COGS
              </button>
            </div>
          )}

          {/* Ask Josephine button */}
          <Button 
            onClick={onAskJosephine}
            className="bg-gradient-primary text-white gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Ask Josephine
          </Button>

          {/* Actions menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleReseedData}>
                <Database className="h-4 w-4 mr-2" />
                Reseed demo data
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Row 2: Location selector + Last updated */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
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
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{lastUpdatedText}</span>
        </div>
      </div>
    </div>
  );
}
