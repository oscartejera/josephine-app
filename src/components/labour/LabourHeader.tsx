/**
 * Labour Header Component - Nory-style header with breadcrumbs, date picker, toggles
 */

import { ChevronDown, Sparkles, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { DateRangePickerNoryLike, DateMode, ChartGranularity } from '@/components/bi/DateRangePickerNoryLike';
import type { LabourDateRange, MetricMode, CompareMode } from '@/hooks/useLabourData';

interface LabourHeaderProps {
  dateRange: LabourDateRange;
  setDateRange: (range: LabourDateRange) => void;
  metricMode: MetricMode;
  setMetricMode: (mode: MetricMode) => void;
  compareMode: CompareMode;
  setCompareMode: (mode: CompareMode) => void;
  locationId?: string;
  locationName?: string;
  onAskJosephine: () => void;
}

export function LabourHeader({
  dateRange,
  setDateRange,
  metricMode,
  setMetricMode,
  compareMode,
  setCompareMode,
  locationId,
  locationName,
  onAskJosephine
}: LabourHeaderProps) {
  const { locations } = useApp();
  const [dateMode, setDateMode] = useState<DateMode>('daily');

  const handleDateChange = (range: { from: Date; to: Date }, mode: DateMode, _granularity: ChartGranularity) => {
    setDateRange(range);
    setDateMode(mode);
  };

  const handleModeChange = (mode: DateMode) => {
    setDateMode(mode);
  };

  const pageTitle = locationId && locationName 
    ? `Labour - ${locationName}` 
    : 'Labour - All locations';

  return (
    <div className="space-y-4">
      {/* Row 1: Breadcrumbs, Date selector, Compare, Toggle, Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Breadcrumb dropdowns */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 px-2 text-muted-foreground gap-1">
                Insights
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Labour Insights</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="text-muted-foreground">/</span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 px-2 font-semibold gap-1">
                Labour
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Labour</DropdownMenuItem>
              <DropdownMenuItem disabled>Scheduling (coming soon)</DropdownMenuItem>
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
                Compare: {compareMode === 'forecast' ? 'Forecast' : compareMode === 'last_week' ? 'Last week' : 'Last month'}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setCompareMode('forecast')}>
                Forecast
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCompareMode('last_week')}>
                Last week
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCompareMode('last_month')}>
                Last month
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-3">
          {/* Metric Toggle Pills */}
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-3 rounded-md text-xs font-medium transition-all",
                metricMode === 'percentage' 
                  ? "bg-background shadow-sm text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setMetricMode('percentage')}
            >
              Percentage
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-3 rounded-md text-xs font-medium transition-all",
                metricMode === 'amount' 
                  ? "bg-background shadow-sm text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setMetricMode('amount')}
            >
              Amount
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-3 rounded-md text-xs font-medium transition-all",
                metricMode === 'hours' 
                  ? "bg-background shadow-sm text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setMetricMode('hours')}
            >
              Hours
            </Button>
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
      </div>

      {/* Row 2: Page title and location selector */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold">{pageTitle}</h1>
        
        {!locationId && (
          <div className="flex items-center gap-2">
            <Button variant="outline" className="h-9 gap-2">
              All locations
              <ChevronDown className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
