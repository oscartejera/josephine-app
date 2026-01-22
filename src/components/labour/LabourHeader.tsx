/**
 * LabourHeader - Nory-style header with breadcrumbs, date picker, toggles
 */

import { ChevronDown, Sparkles, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DateRangePickerNoryLike, DateMode, ChartGranularity } from '@/components/bi/DateRangePickerNoryLike';
import type { LabourDateRange, MetricMode } from '@/hooks/useLabourData';

interface LabourHeaderProps {
  dateRange: LabourDateRange;
  setDateRange: (range: LabourDateRange) => void;
  metricMode: MetricMode;
  setMetricMode: (mode: MetricMode) => void;
  locationId?: string | null;
  locationName?: string;
  onAskJosephine: () => void;
}

export function LabourHeader({
  dateRange,
  setDateRange,
  metricMode,
  setMetricMode,
  locationId,
  locationName,
  onAskJosephine
}: LabourHeaderNewProps) {
  const { accessibleLocations, canShowAllLocations } = useApp();
  const navigate = useNavigate();
  const [dateMode, setDateMode] = useState<DateMode>('weekly');

  const handleDateChange = (range: { from: Date; to: Date }, mode: DateMode, _granularity: ChartGranularity) => {
    setDateRange(range);
    setDateMode(mode);
  };

  const handleModeChange = (mode: DateMode) => {
    setDateMode(mode);
  };

  const handleLocationSelect = (locId: string | null) => {
    if (locId) {
      navigate(`/insights/labour/${locId}`);
    } else {
      navigate('/insights/labour');
    }
  };

  const pageTitle = locationId && locationName 
    ? `Labour - ${locationName}` 
    : 'Labour - All locations';

  const currentLocationLabel = locationId && locationName 
    ? locationName 
    : 'All locations';

  return (
    <div className="space-y-4">
      {/* Row 1: Breadcrumbs, Date selector, Compare, Toggle, Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Breadcrumb dropdowns */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 px-2 text-muted-foreground gap-1 text-sm">
                Insights
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => navigate('/insights/sales')}>Sales</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/insights/labour')}>Labour</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/insights/instant-pl')}>Instant P&L</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="text-muted-foreground">/</span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 px-2 font-semibold gap-1 text-sm">
                Labour
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => navigate('/insights/labour')}>Labour</DropdownMenuItem>
              <DropdownMenuItem disabled>Scheduling (coming soon)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Date Range Picker */}
          <div className="ml-2">
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
              <Button variant="outline" size="sm" className="h-8 gap-2 text-sm">
                Compare: Forecast
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Forecast</DropdownMenuItem>
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

          {/* Location dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-2 text-sm">
                {currentLocationLabel}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {/* Always show All locations option */}
              <DropdownMenuItem onClick={() => handleLocationSelect(null)}>
                All locations
              </DropdownMenuItem>
              {accessibleLocations.map(loc => (
                <DropdownMenuItem key={loc.id} onClick={() => handleLocationSelect(loc.id)}>
                  {loc.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* More actions */}
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Row 2: Page title and Ask Josephine */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-foreground">{pageTitle}</h1>
        
        <Button 
          onClick={onAskJosephine}
          className="bg-gradient-primary text-white gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Ask Josephine
        </Button>
      </div>
    </div>
  );
}
