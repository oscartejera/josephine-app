/**
 * useInstantPLData - Hook for Instant P&L data
 * Provides per-location P&L snapshot with actual vs forecast comparisons
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, differenceInDays, subDays } from 'date-fns';
import { DEMO_LOCATIONS } from '@/lib/demoDataGenerator';

// ============= TYPES =============

export type ViewMode = 'percentage' | 'amount' | 'hours';
export type FilterMode = 'all' | 'best' | 'worst';
export type ChipFilter = 
  | 'all_locations'
  | 'profit_over_target'
  | 'sales_above_forecast'
  | 'cogs_below_average'
  | 'under_planned_labour';

export interface PLDateRange {
  from: Date;
  to: Date;
}

export interface LocationPLMetrics {
  locationId: string;
  locationName: string;
  
  // Sales
  salesActual: number;
  salesForecast: number;
  salesDelta: number;
  salesDeltaPct: number;
  
  // COGS
  cogsActual: number;
  cogsForecast: number;
  cogsActualPct: number;
  cogsForecastPct: number;
  cogsDelta: number;
  cogsDeltaPct: number;
  cogsIsBetter: boolean;
  
  // Labour
  labourActual: number;
  labourForecast: number;
  labourActualPct: number;
  labourForecastPct: number;
  labourDelta: number;
  labourDeltaPct: number;
  labourIsBetter: boolean;
  labourHoursActual: number;
  labourHoursForecast: number;
  
  // Flash Profit
  flashProfitActual: number;
  flashProfitForecast: number;
  flashProfitActualPct: number;
  flashProfitForecastPct: number;
  flashProfitDelta: number;
  flashProfitDeltaPct: number;
  flashProfitIsBetter: boolean;
  
  // Chip filter flags
  isProfitOverTarget: boolean;
  isSalesAboveForecast: boolean;
  isCogsBelow: boolean;
  isUnderPlannedLabour: boolean;
}

export interface InstantPLData {
  locations: LocationPLMetrics[];
  chipCounts: {
    all_locations: number;
    profit_over_target: number;
    sales_above_forecast: number;
    cogs_below_average: number;
    under_planned_labour: number;
  };
  lastUpdated: Date;
  isLoading: boolean;
  isError: boolean;
}

interface UseInstantPLDataParams {
  dateRange: PLDateRange;
  viewMode: ViewMode;
  filterMode: FilterMode;
  activeChips: ChipFilter[];
}

// Use centralized SeededRandom
import { SeededRandom, hashString } from '@/lib/seededRandom';

// ============= DEMO DATA GENERATOR =============

function generateLocationPLData(
  locationId: string,
  locationName: string,
  dateRange: PLDateRange
): LocationPLMetrics {
  const dateKey = format(dateRange.from, 'yyyy-MM-dd') + '-' + format(dateRange.to, 'yyyy-MM-dd');
  const seed = hashString(locationId + dateKey);
  const rng = new SeededRandom(seed);
  
  const dayCount = Math.max(1, differenceInDays(dateRange.to, dateRange.from) + 1);
  
  // Location-specific base multiplier for variety
  const locationMultipliers: Record<string, number> = {
    'loc-cpu-001': 1.3,
    'loc-west-002': 1.1,
    'loc-south-003': 0.95,
    'loc-hq-005': 0.7,
    'loc-westend-006': 1.0,
    'loc-east-004': 0.85,
  };
  const locMultiplier = locationMultipliers[locationId] || 1.0;
  
  // Base daily sales range
  const baseDailySales = rng.between(800, 1400) * locMultiplier;
  
  // Sales
  const salesActual = Math.round(baseDailySales * dayCount * rng.between(0.95, 1.15));
  const salesForecast = Math.round(baseDailySales * dayCount * rng.between(0.92, 1.08));
  const salesDelta = salesActual - salesForecast;
  const salesDeltaPct = salesForecast > 0 ? (salesDelta / salesForecast) * 100 : 0;
  
  // COGS (24-33% of sales)
  const cogsRateActual = rng.between(0.24, 0.33);
  const cogsRateForecast = rng.between(0.24, 0.31);
  const cogsActual = Math.round(salesActual * cogsRateActual);
  const cogsForecast = Math.round(salesForecast * cogsRateForecast);
  const cogsActualPct = salesActual > 0 ? (cogsActual / salesActual) * 100 : 0;
  const cogsForecastPct = salesForecast > 0 ? (cogsForecast / salesForecast) * 100 : 0;
  const cogsDelta = cogsActual - cogsForecast;
  const cogsDeltaPct = cogsForecast > 0 ? (cogsDelta / cogsForecast) * 100 : 0;
  const cogsIsBetter = cogsActualPct < cogsForecastPct;
  
  // Labour (11-27% of sales)
  const labourRateActual = rng.between(0.11, 0.27);
  const labourRateForecast = rng.between(0.13, 0.25);
  const labourActual = Math.round(salesActual * labourRateActual);
  const labourForecast = Math.round(salesForecast * labourRateForecast);
  const labourActualPct = salesActual > 0 ? (labourActual / salesActual) * 100 : 0;
  const labourForecastPct = salesForecast > 0 ? (labourForecast / salesForecast) * 100 : 0;
  const labourDelta = labourActual - labourForecast;
  const labourDeltaPct = labourForecast > 0 ? (labourDelta / labourForecast) * 100 : 0;
  const labourIsBetter = labourActual <= labourForecast;
  
  // Labour hours (assuming €18-22/hour)
  const hourlyRate = rng.between(18, 22);
  const labourHoursActual = Math.round((labourActual / hourlyRate) * 10) / 10;
  const labourHoursForecast = Math.round((labourForecast / hourlyRate) * 10) / 10;
  
  // Flash Profit
  const flashProfitActual = salesActual - cogsActual - labourActual;
  const flashProfitForecast = salesForecast - cogsForecast - labourForecast;
  const flashProfitActualPct = salesActual > 0 ? (flashProfitActual / salesActual) * 100 : 0;
  const flashProfitForecastPct = salesForecast > 0 ? (flashProfitForecast / salesForecast) * 100 : 0;
  const flashProfitDelta = flashProfitActual - flashProfitForecast;
  const flashProfitDeltaPct = flashProfitForecast > 0 ? (flashProfitDelta / flashProfitForecast) * 100 : 0;
  const flashProfitIsBetter = flashProfitActual >= flashProfitForecast;
  
  // Chip filter conditions
  const targetProfitPct = 40; // 40% profit target
  const isProfitOverTarget = flashProfitActualPct >= targetProfitPct;
  const isSalesAboveForecast = salesActual >= salesForecast * 1.10; // 10%+ above
  
  return {
    locationId,
    locationName,
    salesActual,
    salesForecast,
    salesDelta,
    salesDeltaPct,
    cogsActual,
    cogsForecast,
    cogsActualPct,
    cogsForecastPct,
    cogsDelta,
    cogsDeltaPct,
    cogsIsBetter,
    labourActual,
    labourForecast,
    labourActualPct,
    labourForecastPct,
    labourDelta,
    labourDeltaPct,
    labourIsBetter,
    labourHoursActual,
    labourHoursForecast,
    flashProfitActual,
    flashProfitForecast,
    flashProfitActualPct,
    flashProfitForecastPct,
    flashProfitDelta,
    flashProfitDeltaPct,
    flashProfitIsBetter,
    isProfitOverTarget,
    isSalesAboveForecast,
    isCogsBelow: false, // Will be calculated after all locations
    isUnderPlannedLabour: labourActual <= labourForecast
  };
}

// ============= MAIN HOOK =============

export function useInstantPLData({
  dateRange,
  viewMode: _viewMode, // Reserved for future use
  filterMode,
  activeChips
}: UseInstantPLDataParams): InstantPLData {
  
  const queryKey = [
    'instant-pl',
    format(dateRange.from, 'yyyy-MM-dd'),
    format(dateRange.to, 'yyyy-MM-dd')
  ];
  
  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: async () => {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Generate demo data for all locations
      const locations = DEMO_LOCATIONS.map(loc => 
        generateLocationPLData(loc.id, loc.name, dateRange)
      );
      
      // Calculate average COGS % across locations
      const avgCogsPct = locations.reduce((sum, l) => sum + l.cogsActualPct, 0) / locations.length;
      
      // Update isCogsBelow flag
      locations.forEach(loc => {
        loc.isCogsBelow = loc.cogsActualPct < avgCogsPct;
      });
      
      return locations;
    },
    staleTime: 60000 // 1 minute
  });
  
  // Compute chip counts and filter locations
  const result = useMemo(() => {
    const allLocations = data || [];
    
    // Calculate chip counts
    const chipCounts = {
      all_locations: allLocations.length,
      profit_over_target: allLocations.filter(l => l.isProfitOverTarget).length,
      sales_above_forecast: allLocations.filter(l => l.isSalesAboveForecast).length,
      cogs_below_average: allLocations.filter(l => l.isCogsBelow).length,
      under_planned_labour: allLocations.filter(l => l.isUnderPlannedLabour).length
    };
    
    // Apply chip filters (AND logic)
    let filteredLocations = [...allLocations];
    
    if (!activeChips.includes('all_locations') && activeChips.length > 0) {
      filteredLocations = filteredLocations.filter(loc => {
        return activeChips.every(chip => {
          switch (chip) {
            case 'profit_over_target':
              return loc.isProfitOverTarget;
            case 'sales_above_forecast':
              return loc.isSalesAboveForecast;
            case 'cogs_below_average':
              return loc.isCogsBelow;
            case 'under_planned_labour':
              return loc.isUnderPlannedLabour;
            default:
              return true;
          }
        });
      });
    }
    
    // Apply Best/Worst/All filter
    if (filterMode === 'best') {
      // Sort by flash profit % descending, take top half
      filteredLocations.sort((a, b) => b.flashProfitActualPct - a.flashProfitActualPct);
      filteredLocations = filteredLocations.slice(0, Math.ceil(filteredLocations.length / 2));
    } else if (filterMode === 'worst') {
      // Sort by flash profit % ascending, take bottom half
      filteredLocations.sort((a, b) => a.flashProfitActualPct - b.flashProfitActualPct);
      filteredLocations = filteredLocations.slice(0, Math.ceil(filteredLocations.length / 2));
    }
    
    return {
      locations: filteredLocations,
      chipCounts,
      lastUpdated: subDays(new Date(), 0), // Today
      isLoading,
      isError
    };
  }, [data, activeChips, filterMode, isLoading, isError]);
  
  return result;
}
