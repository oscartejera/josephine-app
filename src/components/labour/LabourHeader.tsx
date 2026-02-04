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

export type CompareMode = 'forecast' | 'last_week' | 'last_month' | 'last_year';

interface LabourHeaderProps {
  dateRange: LabourDateRange;
  setDateRange: (range: LabourDateRange) => void;
  metricMode: MetricMode;
  setMetricMode: (mode: MetricMode) => void;
  compareMode?: CompareMode;
  setCompareMode?: (mode: CompareMode) => void;
  locationId?: string | null;
  locationName?: string;
  onAskJosephine: () => void;
}

export function LabourHeader({
  dateRange,
  setDateRange,
  metricMode,
  setMetricMode,
  compareMode = 'forecast',
  setCompareMode,
  locationId,
  locationName,
  onAskJosephine
}: LabourHeaderProps) {
  const { accessibleLocations, canShowAllLocations } = useApp();
  const navigate = useNavigate();
  const [dateMode, setDateMode] = useState<DateMode>('weekly');

  const getCompareModeLabel = (mode: CompareMode) => {
    switch (mode) {
      case 'forecast': return 'vs Forecast';
      case 'last_week': return 'vs Last Week';
      case 'last_month': return 'vs Last Month';
      case 'last_year': return 'vs Last Year';
      default: return 'vs Forecast';
    }
  };

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
      {/* Title */}
      <h1 className="text-3xl font-bold text-gray-900">Labour</h1>

      {/* Controls row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Location Selector (simplified like Sales) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="w-[200px] justify-between">
                {currentLocationLabel}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
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
        </div>

        <div className="flex items-center gap-2">
          {/* Date Range Picker */}
          <DateRangePickerNoryLike
            value={dateRange}
            onChange={handleDateChange}
            mode={dateMode}
            onModeChange={handleModeChange}
          />

          {/* Compare dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-2">
                {getCompareModeLabel(compareMode)}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setCompareMode?.('forecast')}>vs Forecast</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCompareMode?.('last_week')}>vs Last Week</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCompareMode?.('last_month')}>vs Last Month</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCompareMode?.('last_year')}>vs Last Year</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Metric Toggle Pills */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-3 rounded-md text-xs font-medium transition-all",
                metricMode === 'percentage' 
                  ? "bg-white shadow-sm text-gray-900" 
                  : "text-gray-600 hover:text-gray-900"
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
                  ? "bg-white shadow-sm text-gray-900" 
                  : "text-gray-600 hover:text-gray-900"
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
                  ? "bg-white shadow-sm text-gray-900" 
                  : "text-gray-600 hover:text-gray-900"
              )}
              onClick={() => setMetricMode('hours')}
            >
              Hours
            </Button>
          </div>

          {/* Ask Josephine */}
          <Button 
            onClick={onAskJosephine}
            variant="outline"
          >
            ✨ Ask Josephine
          </Button>
        </div>
      </div>
    </div>
  );
}
