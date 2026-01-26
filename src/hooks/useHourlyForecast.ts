import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay, addDays } from 'date-fns';

export interface HourlyForecast {
  id: string;
  location_id: string;
  date: string;
  hour: number;
  forecast_sales: number;
  forecast_covers: number;
  forecast_orders: number;
  confidence: number;
  factors: Record<string, number> | null;
  model_version: string | null;
  generated_at: string | null;
  created_at?: string;
}

export interface HourlyForecastWithActual extends HourlyForecast {
  actual_sales?: number;
  actual_covers?: number;
  actual_orders?: number;
}

export function useHourlyForecast(locationId: string | null, date: Date, autoGenerate = true) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const queryClient = useQueryClient();
  const generatingRef = useRef(false);

  const query = useQuery({
    queryKey: ['hourly-forecast', locationId, dateStr],
    queryFn: async (): Promise<HourlyForecastWithActual[]> => {
      if (!locationId || locationId === 'all') {
        return [];
      }

      // Fetch forecasts
      const { data: forecasts, error } = await supabase
        .from('forecast_hourly_metrics')
        .select('*')
        .eq('location_id', locationId)
        .eq('date', dateStr)
        .order('hour');

      if (error) {
        console.error('Error fetching hourly forecast:', error);
        throw error;
      }

      // Check if this is today or past - fetch actuals from POS
      const today = startOfDay(new Date());
      const targetDate = startOfDay(date);
      
      if (targetDate <= today) {
        // Fetch actual sales from tickets (POS data)
        const dayStart = new Date(dateStr);
        const dayEnd = addDays(dayStart, 1);

        const { data: tickets } = await supabase
          .from('tickets')
          .select('opened_at, net_total, covers')
          .eq('location_id', locationId)
          .eq('status', 'closed')
          .gte('opened_at', dayStart.toISOString())
          .lt('opened_at', dayEnd.toISOString());

        // Aggregate actuals by hour
        const actualsByHour: Record<number, { sales: number; covers: number; orders: number }> = {};
        
        for (const ticket of tickets || []) {
          const hour = new Date(ticket.opened_at).getHours();
          if (!actualsByHour[hour]) {
            actualsByHour[hour] = { sales: 0, covers: 0, orders: 0 };
          }
          actualsByHour[hour].sales += Number(ticket.net_total) || 0;
          actualsByHour[hour].covers += Number(ticket.covers) || 0;
          actualsByHour[hour].orders += 1;
        }

        // If we have actuals but no forecasts, create synthetic display data
        if ((!forecasts || forecasts.length === 0) && Object.keys(actualsByHour).length > 0) {
          // Return actuals without forecast for display
          return Object.entries(actualsByHour).map(([hour, data]) => ({
            id: `actual-${hour}`,
            location_id: locationId,
            date: dateStr,
            hour: parseInt(hour),
            forecast_sales: 0,
            forecast_covers: 0,
            forecast_orders: 0,
            confidence: 0,
            factors: null,
            model_version: null,
            generated_at: null,
            actual_sales: data.sales,
            actual_covers: data.covers,
            actual_orders: data.orders,
          })).sort((a, b) => a.hour - b.hour);
        }

        // Merge actuals with forecasts
        return (forecasts || []).map(f => ({
          ...f,
          factors: f.factors as Record<string, number> | null,
          actual_sales: actualsByHour[f.hour]?.sales,
          actual_covers: actualsByHour[f.hour]?.covers,
          actual_orders: actualsByHour[f.hour]?.orders,
        }));
      }

      // Future dates - just return forecasts
      return (forecasts || []).map(f => ({
        ...f,
        factors: f.factors as Record<string, number> | null,
      }));
    },
    enabled: !!locationId && locationId !== 'all',
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Auto-generate forecast if missing and autoGenerate is true
  useEffect(() => {
    const shouldGenerate = 
      autoGenerate && 
      locationId && 
      locationId !== 'all' &&
      query.data !== undefined && 
      query.data.length === 0 &&
      !query.isLoading &&
      !generatingRef.current;

    if (shouldGenerate) {
      generatingRef.current = true;
      console.log('Auto-generating forecast for location:', locationId);
      
      supabase.functions.invoke('ai_forecast_hourly', {
        body: { location_id: locationId, forecast_days: 14 },
      }).then((response) => {
        if (!response.error) {
          console.log('Forecast generated:', response.data);
          queryClient.invalidateQueries({
            queryKey: ['hourly-forecast', locationId],
          });
        } else {
          console.error('Error generating forecast:', response.error);
        }
        generatingRef.current = false;
      }).catch((err) => {
        console.error('Forecast generation failed:', err);
        generatingRef.current = false;
      });
    }
  }, [autoGenerate, locationId, query.data, query.isLoading, queryClient]);

  return query;
}

export function useGenerateForecast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ locationId, forecastDays = 14 }: { locationId: string; forecastDays?: number }) => {
      const response = await supabase.functions.invoke('ai_forecast_hourly', {
        body: { location_id: locationId, forecast_days: forecastDays },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate all forecast queries for this location
      queryClient.invalidateQueries({
        queryKey: ['hourly-forecast', variables.locationId],
      });
    },
  });
}

export function useAverageConfidence(forecasts: HourlyForecast[]): number {
  if (!forecasts || forecasts.length === 0) return 0;
  const sum = forecasts.reduce((acc, f) => acc + (f.confidence || 0), 0);
  return Math.round(sum / forecasts.length);
}

export function useForecastAccuracy(forecasts: HourlyForecastWithActual[]): number | null {
  const withActuals = forecasts.filter(f => f.actual_sales !== undefined && f.forecast_sales > 0);
  if (withActuals.length === 0) return null;

  // Calculate MAPE (Mean Absolute Percentage Error)
  const totalError = withActuals.reduce((acc, f) => {
    const error = Math.abs((f.actual_sales! - f.forecast_sales) / f.forecast_sales);
    return acc + error;
  }, 0);

  const mape = (totalError / withActuals.length) * 100;
  return Math.round(100 - mape); // Return as accuracy percentage
}
