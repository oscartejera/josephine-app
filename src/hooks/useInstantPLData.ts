/**
 * useInstantPLData - Hook for Instant P&L data
 * Provides per-location P&L snapshot with actual vs forecast comparisons.
 *
 * Uses get_instant_pnl_unified RPC (resolve_data_source internally).
 * COGS is estimated client-side (flagged).
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveDataSource } from '@/hooks/useEffectiveDataSource';

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
  cogsActual: number | null;
  cogsForecast: number | null;
  cogsActualPct: number | null;
  cogsForecastPct: number | null;
  cogsDelta: number | null;
  cogsDeltaPct: number | null;
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
  flashProfitActual: number | null;
  flashProfitForecast: number | null;
  flashProfitActualPct: number | null;
  flashProfitForecastPct: number | null;
  flashProfitDelta: number | null;
  flashProfitDeltaPct: number | null;
  flashProfitIsBetter: boolean;

  // Chip filter flags
  isProfitOverTarget: boolean;
  isSalesAboveForecast: boolean;
  isCogsBelow: boolean;
  isUnderPlannedLabour: boolean;

  // Estimation flags
  estimatedCogs: boolean;
  estimatedLabour: boolean;
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

// ============= RPC RESPONSE TYPES =============
interface RPCLocationRow {
  locationId: string;
  locationName: string;
  salesActual: number;
  salesForecast: number;
  labourForecast: number;
  labourActual: number;
  labourHoursActual: number;
  estimated_cogs: boolean;
  estimated_labour: boolean;
}

/** Sanitize a numeric value: NaN / Infinity → null */
function finiteOrNull(v: number | null | undefined): number | null {
  return v != null && Number.isFinite(v) ? v : null;
}

interface RPCResponse {
  data_source: string;
  mode: string;
  reason: string;
  last_synced_at: string | null;
  locations: RPCLocationRow[];
  flags: {
    estimated_cogs: boolean;
    cogs_note: string;
  };
}

// ============= MAIN HOOK =============

export function useInstantPLData({
  dateRange,
  viewMode: _viewMode,
  filterMode,
  activeChips
}: UseInstantPLDataParams): InstantPLData {
  const { locations } = useApp();
  const { profile } = useAuth();
  const { dsUnified } = useEffectiveDataSource();
  const orgId = profile?.group_id;

  const queryKey = [
    'instant-pl-unified',
    format(dateRange.from, 'yyyy-MM-dd'),
    format(dateRange.to, 'yyyy-MM-dd'),
    orgId,
    dsUnified,
  ];

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: async (): Promise<LocationPLMetrics[]> => {
      if (!orgId || locations.length === 0) {
        return [];
      }

      const locationIds = locations.map(l => l.id);
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      // Call unified RPC — resolves data_source internally
      const { data: rpcResult, error } = await supabase.rpc('get_instant_pnl_unified', {
        p_org_id: orgId,
        p_location_ids: locationIds,
        p_from: fromDate,
        p_to: toDate
      });

      if (error) {
        console.error('get_instant_pnl_unified RPC error:', error.message);
        throw error;
      }

      const result = rpcResult as RPCResponse;
      const rpcLocations = result?.locations || [];

      // Map RPC rows to full LocationPLMetrics (add COGS estimation + deltas)
      const locationMetrics: LocationPLMetrics[] = rpcLocations.map((loc: RPCLocationRow) => {
        const salesActual = loc.salesActual || 0;
        const salesForecast = loc.salesForecast || 0;
        let labourActual = loc.labourActual || 0;
        let labourHoursActual = loc.labourHoursActual || 0;
        const labourForecast = loc.labourForecast || 0;
        const estimatedLabour = loc.estimated_labour;

        // If no labour data, estimate based on typical 22% ratio
        if (labourActual === 0 && salesActual > 0) {
          const dateKey = format(dateRange.from, 'yyyy-MM-dd') + loc.locationId;
          const rng = new SeededRandom(hashString(dateKey));
          const labourRatio = rng.between(0.18, 0.26);
          labourActual = Math.round(salesActual * labourRatio);
          labourHoursActual = Math.round(labourActual / 20);
        }

        // COGS: null = not configured (no recipe costs / COGS feed)
        const cogsActual: number | null = null;
        const cogsForecast: number | null = null;

        // Calculate percentages
        const cogsActualPct = cogsActual != null && salesActual > 0 ? (cogsActual / salesActual) * 100 : null;
        const cogsForecastPct = cogsForecast != null && salesForecast > 0 ? (cogsForecast / salesForecast) * 100 : null;
        const labourActualPct = salesActual > 0 ? (labourActual / salesActual) * 100 : 0;
        const labourForecastPct = salesForecast > 0 ? (labourForecast / salesForecast) * 100 : 0;

        // Flash Profit — requires COGS to be meaningful
        const flashProfitActual = cogsActual != null ? salesActual - cogsActual - labourActual : null;
        const flashProfitForecast = cogsForecast != null ? salesForecast - cogsForecast - labourForecast : null;
        const flashProfitActualPct = flashProfitActual != null && salesActual > 0 ? (flashProfitActual / salesActual) * 100 : null;
        const flashProfitForecastPct = flashProfitForecast != null && salesForecast > 0 ? (flashProfitForecast / salesForecast) * 100 : null;

        // Deltas
        const salesDelta = salesActual - salesForecast;
        const salesDeltaPct = salesForecast > 0 ? (salesDelta / salesForecast) * 100 : 0;
        const cogsDelta = cogsActual != null && cogsForecast != null ? cogsActual - cogsForecast : null;
        const cogsDeltaPct = cogsDelta != null && cogsForecast != null && cogsForecast > 0 ? (cogsDelta / cogsForecast) * 100 : null;
        const labourDelta = labourActual - labourForecast;
        const labourDeltaPct = labourForecast > 0 ? (labourDelta / labourForecast) * 100 : 0;
        const flashProfitDelta = flashProfitActual != null && flashProfitForecast != null ? flashProfitActual - flashProfitForecast : null;
        const flashProfitDeltaPct = flashProfitDelta != null && flashProfitForecast != null && flashProfitForecast > 0 ? (flashProfitDelta / flashProfitForecast) * 100 : null;

        // Labour hours
        const hourlyRate = labourHoursActual > 0 ? labourActual / labourHoursActual : 20;
        const labourHoursForecastCalc = hourlyRate > 0 ? labourForecast / hourlyRate : 0;

        return {
          locationId: loc.locationId,
          locationName: loc.locationName,
          salesActual,
          salesForecast,
          salesDelta,
          salesDeltaPct,
          cogsActual: finiteOrNull(cogsActual),
          cogsForecast: finiteOrNull(cogsForecast),
          cogsActualPct: finiteOrNull(cogsActualPct),
          cogsForecastPct: finiteOrNull(cogsForecastPct),
          cogsDelta: finiteOrNull(cogsDelta),
          cogsDeltaPct: finiteOrNull(cogsDeltaPct),
          cogsIsBetter: cogsActualPct != null && cogsForecastPct != null && cogsActualPct < cogsForecastPct,
          labourActual,
          labourForecast,
          labourActualPct,
          labourForecastPct,
          labourDelta,
          labourDeltaPct,
          labourIsBetter: labourActual <= labourForecast,
          labourHoursActual,
          labourHoursForecast: labourHoursForecastCalc,
          flashProfitActual: finiteOrNull(flashProfitActual),
          flashProfitForecast: finiteOrNull(flashProfitForecast),
          flashProfitActualPct: finiteOrNull(flashProfitActualPct),
          flashProfitForecastPct: finiteOrNull(flashProfitForecastPct),
          flashProfitDelta: finiteOrNull(flashProfitDelta),
          flashProfitDeltaPct: finiteOrNull(flashProfitDeltaPct),
          flashProfitIsBetter: flashProfitActual != null && flashProfitForecast != null && flashProfitActual >= flashProfitForecast,
          isProfitOverTarget: flashProfitActualPct != null && flashProfitActualPct >= 40,
          isSalesAboveForecast: salesActual >= salesForecast * 1.10,
          isCogsBelow: false, // Calculated after all locations
          isUnderPlannedLabour: labourActual <= labourForecast,
          estimatedCogs: true,
          estimatedLabour: estimatedLabour,
        };
      });

      // Calculate average COGS % and update isCogsBelow
      const validCogs = locationMetrics.filter(l => l.cogsActualPct != null);
      const avgCogsPct = validCogs.length > 0
        ? validCogs.reduce((sum, l) => sum + l.cogsActualPct!, 0) / validCogs.length
        : null;
      locationMetrics.forEach(loc => {
        loc.isCogsBelow = loc.cogsActualPct != null && avgCogsPct != null && loc.cogsActualPct < avgCogsPct;
      });

      return locationMetrics;
    },
    enabled: !!orgId,
    staleTime: 60000
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

    // Apply Best/Worst/All filter (null profit sorts last)
    if (filterMode === 'best') {
      filteredLocations.sort((a, b) => (b.flashProfitActualPct ?? -Infinity) - (a.flashProfitActualPct ?? -Infinity));
      filteredLocations = filteredLocations.slice(0, Math.ceil(filteredLocations.length / 2));
    } else if (filterMode === 'worst') {
      filteredLocations.sort((a, b) => (a.flashProfitActualPct ?? Infinity) - (b.flashProfitActualPct ?? Infinity));
      filteredLocations = filteredLocations.slice(0, Math.ceil(filteredLocations.length / 2));
    }

    return {
      locations: filteredLocations,
      chipCounts,
      lastUpdated: subDays(new Date(), 0),
      isLoading,
      isError
    };
  }, [data, activeChips, filterMode, isLoading, isError]);

  return result;
}
