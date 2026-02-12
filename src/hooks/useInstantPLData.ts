/**
 * useInstantPLData - Hook for Instant P&L data
 * Provides per-location P&L snapshot with actual vs forecast comparisons
 * Uses forecast_daily_metrics (LR+SI v3 model) for real forecast data
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, differenceInDays, subDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';

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

// ============= SEEDED RANDOM FOR DEMO DATA =============
import { SeededRandom, hashString } from '@/lib/seededRandom';

// ============= MAIN HOOK =============

export function useInstantPLData({
  dateRange,
  viewMode: _viewMode, // Reserved for future use
  filterMode,
  activeChips
}: UseInstantPLDataParams): InstantPLData {
  const { locations, dataSource } = useApp();

  const queryKey = [
    'instant-pl',
    format(dateRange.from, 'yyyy-MM-dd'),
    format(dateRange.to, 'yyyy-MM-dd'),
    dataSource
  ];
  
  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: async () => {
      if (locations.length === 0) {
        return [];
      }
      
      const locationIds = locations.map(l => l.id);
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');
      
      // Fetch actual sales from pos_daily_finance (aggregated daily data)
      const { data: dailyFinance } = await supabase
        .from('pos_daily_finance')
        .select('location_id, date, net_sales, gross_sales')
        .eq('data_source', dataSource)
        .in('location_id', locationIds)
        .gte('date', fromDate)
        .lte('date', toDate);
      
      // Fetch forecasts from LR+SI v3 model
      const { data: forecasts } = await supabase
        .from('forecast_daily_metrics')
        .select('location_id, date, forecast_sales, planned_labor_cost')
        .in('location_id', locationIds)
        .gte('date', fromDate)
        .lte('date', toDate);
      
      // Fetch labor actuals from pos_daily_metrics (data_source aware)
      const { data: laborData } = await supabase
        .from('pos_daily_metrics')
        .select('location_id, date, labor_cost, labor_hours')
        .eq('data_source', dataSource)
        .in('location_id', locationIds)
        .gte('date', fromDate)
        .lte('date', toDate);

      // Fetch labour_daily as fallback (e.g. when POS doesn't provide labour)
      const { data: labourDailyData } = await supabase
        .from('labour_daily')
        .select('location_id, date, labour_cost, labour_hours')
        .in('location_id', locationIds)
        .gte('date', fromDate)
        .lte('date', toDate);

      // Fetch actual COGS from cogs_daily (populated by sync)
      const { data: cogsData } = await supabase
        .from('cogs_daily')
        .select('location_id, date, cogs_amount')
        .in('location_id', locationIds)
        .gte('date', fromDate)
        .lte('date', toDate);

      // Aggregate by location
      const locationMetrics: LocationPLMetrics[] = locations.map(loc => {
        // Actuals from daily finance aggregates
        const locFinance = (dailyFinance || []).filter(d => d.location_id === loc.id);
        const salesActual = locFinance.reduce((sum, d) => sum + (d.net_sales || d.gross_sales || 0), 0);
        
        // Forecasts
        const locForecasts = (forecasts || []).filter(f => f.location_id === loc.id);
        const salesForecast = locForecasts.reduce((sum, f) => sum + (f.forecast_sales || 0), 0);
        const labourForecast = locForecasts.reduce((sum, f) => sum + (f.planned_labor_cost || 0), 0);
        
        // Labor actuals from pos_daily_metrics
        const locLabor = (laborData || []).filter(l => l.location_id === loc.id);
        let labourActual = locLabor.reduce((sum, l) => sum + (l.labor_cost || 0), 0);
        let labourHoursActual = locLabor.reduce((sum, l) => sum + (l.labor_hours || 0), 0);

        // Fallback to labour_daily when pos_daily_metrics has no labour data
        // (e.g. Square POS doesn't provide labour - but timesheets/shifts do)
        if (labourActual === 0) {
          const locLabourDaily = (labourDailyData || []).filter(l => l.location_id === loc.id);
          labourActual = locLabourDaily.reduce((sum, l) => sum + (l.labour_cost || 0), 0);
          labourHoursActual = locLabourDaily.reduce((sum, l) => sum + (l.labour_hours || 0), 0);
        }

        // COGS from cogs_daily (populated by sync with category-based estimates)
        const locCogs = (cogsData || []).filter(c => c.location_id === loc.id);
        let cogsActual = locCogs.reduce((sum, c) => sum + (c.cogs_amount || 0), 0);

        // Fallback: estimate COGS at 28% if no real data
        if (cogsActual === 0 && salesActual > 0) {
          cogsActual = Math.round(salesActual * 0.28);
        }

        // Forecast COGS estimated at 28% of forecast sales
        const cogsForecast = Math.round(salesForecast * 0.28);
        
        // Calculate percentages
        const cogsActualPct = salesActual > 0 ? (cogsActual / salesActual) * 100 : 0;
        const cogsForecastPct = salesForecast > 0 ? (cogsForecast / salesForecast) * 100 : 0;
        const labourActualPct = salesActual > 0 ? (labourActual / salesActual) * 100 : 0;
        const labourForecastPct = salesForecast > 0 ? (labourForecast / salesForecast) * 100 : 0;
        
        // Flash Profit
        const flashProfitActual = salesActual - cogsActual - labourActual;
        const flashProfitForecast = salesForecast - cogsForecast - labourForecast;
        const flashProfitActualPct = salesActual > 0 ? (flashProfitActual / salesActual) * 100 : 0;
        const flashProfitForecastPct = salesForecast > 0 ? (flashProfitForecast / salesForecast) * 100 : 0;
        
        // Deltas
        const salesDelta = salesActual - salesForecast;
        const salesDeltaPct = salesForecast > 0 ? (salesDelta / salesForecast) * 100 : 0;
        const cogsDelta = cogsActual - cogsForecast;
        const cogsDeltaPct = cogsForecast > 0 ? (cogsDelta / cogsForecast) * 100 : 0;
        const labourDelta = labourActual - labourForecast;
        const labourDeltaPct = labourForecast > 0 ? (labourDelta / labourForecast) * 100 : 0;
        const flashProfitDelta = flashProfitActual - flashProfitForecast;
        const flashProfitDeltaPct = flashProfitForecast > 0 ? (flashProfitDelta / flashProfitForecast) * 100 : 0;
        
        // Labour hours
        const hourlyRate = labourHoursActual > 0 ? labourActual / labourHoursActual : 20;
        const labourHoursForecast = hourlyRate > 0 ? labourForecast / hourlyRate : 0;
        
        return {
          locationId: loc.id,
          locationName: loc.name,
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
          cogsIsBetter: cogsActualPct < cogsForecastPct,
          labourActual,
          labourForecast,
          labourActualPct,
          labourForecastPct,
          labourDelta,
          labourDeltaPct,
          labourIsBetter: labourActual <= labourForecast,
          labourHoursActual,
          labourHoursForecast,
          flashProfitActual,
          flashProfitForecast,
          flashProfitActualPct,
          flashProfitForecastPct,
          flashProfitDelta,
          flashProfitDeltaPct,
          flashProfitIsBetter: flashProfitActual >= flashProfitForecast,
          isProfitOverTarget: flashProfitActualPct >= 40,
          isSalesAboveForecast: salesActual >= salesForecast * 1.10,
          isCogsBelow: false, // Will be calculated after all locations
          isUnderPlannedLabour: labourActual <= labourForecast
        };
      });
      
      // Calculate average COGS % and update isCogsBelow
      const avgCogsPct = locationMetrics.length > 0
        ? locationMetrics.reduce((sum, l) => sum + l.cogsActualPct, 0) / locationMetrics.length
        : 0;
      locationMetrics.forEach(loc => {
        loc.isCogsBelow = loc.cogsActualPct < avgCogsPct;
      });
      
      return locationMetrics;
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
