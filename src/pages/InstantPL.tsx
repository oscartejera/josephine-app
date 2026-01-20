/**
 * InstantPL - Flash P&L dashboard page
 * Shows per-location P&L snapshot with actual vs forecast comparisons
 */

import { useState, useMemo, useCallback } from 'react';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { 
  InstantPLHeader, 
  FilterChips, 
  LocationCardsGrid 
} from '@/components/instant-pl';
import { 
  useInstantPLData, 
  ViewMode, 
  FilterMode, 
  ChipFilter,
  PLDateRange 
} from '@/hooks/useInstantPLData';
import { DateMode, ChartGranularity, DateRangeValue } from '@/components/bi/DateRangePickerNoryLike';

export default function InstantPL() {
  // Date range state (default: last 7 days)
  const [dateRange, setDateRange] = useState<PLDateRange>(() => ({
    from: startOfDay(subDays(new Date(), 6)),
    to: endOfDay(new Date())
  }));
  const [dateMode, setDateMode] = useState<DateMode>('daily');
  
  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('percentage');
  
  // Filter mode state (Best/Worst/All)
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  
  // Active chips state
  const [activeChips, setActiveChips] = useState<ChipFilter[]>(['all_locations']);
  
  // Fetch data
  const { locations, chipCounts, lastUpdated, isLoading, isError } = useInstantPLData({
    dateRange,
    viewMode,
    filterMode,
    activeChips
  });
  
  // Handle date change
  const handleDateChange = useCallback((
    range: DateRangeValue, 
    mode: DateMode, 
    _granularity: ChartGranularity
  ) => {
    setDateRange({ from: range.from, to: range.to });
    setDateMode(mode);
  }, []);
  
  // Handle chip toggle
  const handleChipToggle = useCallback((chip: ChipFilter) => {
    setActiveChips(prev => {
      // If clicking "all_locations", reset to only that
      if (chip === 'all_locations') {
        return ['all_locations'];
      }
      
      // If currently only "all_locations" is active, switch to the clicked chip
      if (prev.length === 1 && prev[0] === 'all_locations') {
        return [chip];
      }
      
      // Toggle the chip
      if (prev.includes(chip)) {
        const newChips = prev.filter(c => c !== chip);
        // If no chips left, reset to all_locations
        return newChips.length === 0 ? ['all_locations'] : newChips;
      }
      
      // Add the chip (and remove all_locations if present)
      return [...prev.filter(c => c !== 'all_locations'), chip];
    });
  }, []);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <InstantPLHeader
        dateRange={dateRange}
        dateMode={dateMode}
        onDateChange={handleDateChange}
        onDateModeChange={setDateMode}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        filterMode={filterMode}
        onFilterModeChange={setFilterMode}
        lastUpdated={lastUpdated}
      />
      
      {/* Filter Chips */}
      <FilterChips
        counts={chipCounts}
        activeChips={activeChips}
        onChipToggle={handleChipToggle}
      />
      
      {/* Location Cards Grid */}
      <LocationCardsGrid
        locations={locations}
        viewMode={viewMode}
        isLoading={isLoading}
      />
      
      {/* Error state */}
      {isError && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-center">
          <p className="text-destructive font-medium">
            Failed to load P&L data. Please try again.
          </p>
        </div>
      )}
    </div>
  );
}
