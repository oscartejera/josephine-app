/**
 * useLabourData - Hook for Labour page using optimized RPC calls
 * Calls get_labour_kpis, get_labour_timeseries, get_labour_locations_table
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useApp } from '@/contexts/AppContext';

export type MetricMode = 'percentage' | 'amount' | 'hours';

export interface LabourDateRange {
  from: Date;
  to: Date;
}

export interface LabourKpis {
  actual_sales: number;
  forecast_sales: number;
  actual_labor_cost: number;
  planned_labor_cost: number;
  actual_labor_hours: number;
  planned_labor_hours: number;
  actual_orders: number;
  forecast_orders: number;
  actual_col_pct: number;
  planned_col_pct: number;
  actual_splh: number;
  planned_splh: number;
  actual_oplh: number;
  planned_oplh: number;
  sales_delta_pct: number;
  col_delta_pct: number;
  hours_delta_pct: number;
  splh_delta_pct: number;
  oplh_delta_pct: number;
}

export interface LabourTimeseriesRow {
  date: string;
  actual_sales: number;
  forecast_sales: number;
  actual_labor_cost: number;
  planned_labor_cost: number;
  actual_hours: number;
  planned_hours: number;
  actual_orders: number;
  forecast_orders: number;
  actual_col_pct: number;
  planned_col_pct: number;
  actual_splh: number;
  planned_splh: number;
  actual_oplh: number;
  planned_oplh: number;
}

export interface LabourLocationRow {
  location_id: string | null;
  location_name: string;
  sales_actual: number;
  sales_projected: number;
  sales_delta_pct: number;
  col_actual_pct: number;
  col_projected_pct: number;
  col_delta_pct: number;
  splh_actual: number;
  splh_projected: number;
  splh_delta_pct: number;
  oplh_actual: number;
  oplh_projected: number;
  oplh_delta_pct: number;
  labor_cost_actual: number;
  labor_cost_projected: number;
  hours_actual: number;
  hours_projected: number;
  is_summary: boolean;
}

interface UseLabourDataParams {
  dateRange: LabourDateRange;
  locationId?: string | null;
}

export function useLabourData({ dateRange, locationId }: UseLabourDataParams) {
  const { dataSource } = useApp();
  const dateFrom = format(dateRange.from, 'yyyy-MM-dd');
  const dateTo = format(dateRange.to, 'yyyy-MM-dd');

  // Fetch KPIs
  const kpisQuery = useQuery({
    queryKey: ['labour-kpis', dateFrom, dateTo, locationId, dataSource],
    queryFn: async (): Promise<LabourKpis> => {
      const { data, error } = await supabase.rpc('get_labour_kpis', {
        date_from: dateFrom,
        date_to: dateTo,
        selected_location_id: locationId || null,
        p_data_source: dataSource,
      });

      if (error) throw error;
      return data as unknown as LabourKpis;
    },
  });

  // Fetch timeseries for chart
  const timeseriesQuery = useQuery({
    queryKey: ['labour-timeseries', dateFrom, dateTo, locationId, dataSource],
    queryFn: async (): Promise<LabourTimeseriesRow[]> => {
      const { data, error } = await supabase.rpc('get_labour_timeseries', {
        date_from: dateFrom,
        date_to: dateTo,
        selected_location_id: locationId || null,
        p_data_source: dataSource,
      });

      if (error) throw error;
      return (data || []) as unknown as LabourTimeseriesRow[];
    },
  });

  // Fetch locations table
  const locationsQuery = useQuery({
    queryKey: ['labour-locations', dateFrom, dateTo, locationId, dataSource],
    queryFn: async (): Promise<LabourLocationRow[]> => {
      const { data, error } = await supabase.rpc('get_labour_locations_table', {
        date_from: dateFrom,
        date_to: dateTo,
        selected_location_id: locationId || null,
        p_data_source: dataSource,
      });

      if (error) throw error;
      return (data || []) as unknown as LabourLocationRow[];
    },
  });

  // Check if data is empty (for showing seed button)
  const isEmpty = 
    !kpisQuery.isLoading && 
    kpisQuery.data && 
    kpisQuery.data.actual_sales === 0 && 
    kpisQuery.data.forecast_sales === 0;

  return {
    kpis: kpisQuery.data,
    timeseries: timeseriesQuery.data || [],
    locations: locationsQuery.data || [],
    isLoading: kpisQuery.isLoading || timeseriesQuery.isLoading || locationsQuery.isLoading,
    isError: kpisQuery.isError || timeseriesQuery.isError || locationsQuery.isError,
    error: kpisQuery.error || timeseriesQuery.error || locationsQuery.error,
    isEmpty,
    refetch: () => {
      kpisQuery.refetch();
      timeseriesQuery.refetch();
      locationsQuery.refetch();
    },
  };
}

