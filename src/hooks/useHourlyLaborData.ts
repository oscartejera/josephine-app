import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useApp } from '@/contexts/AppContext';

interface HourlyLaborPoint {
  hour: string;
  real: number;
  recommended: number;
}

/**
 * Fetches real hourly labor data from timesheets table.
 * Compares actual labor cost vs recommended based on forecast.
 */
export function useHourlyLaborData(dateFrom: Date, dateTo: Date) {
  const { selectedLocationId } = useApp();

  return useQuery({
    queryKey: ['hourly-labor', selectedLocationId, dateFrom.toISOString(), dateTo.toISOString()],
    queryFn: async (): Promise<HourlyLaborPoint[]> => {
      const dateFromStr = format(dateFrom, 'yyyy-MM-dd');
      const dateToStr = format(dateTo, 'yyyy-MM-dd');

      // Initialize hourly map (10:00 to 23:00 restaurant hours)
      const hourlyMap = new Map<number, { labor: number; recommended: number; count: number }>();
      for (let h = 10; h <= 23; h++) {
        hourlyMap.set(h, { labor: 0, recommended: 0, count: 0 });
      }

      // 1. Fetch actual labor from timesheets
      let timesheetsQuery = supabase
        .from('timesheets')
        .select('clock_in, clock_out, labor_cost')
        .gte('clock_in', `${dateFromStr}T00:00:00`)
        .lte('clock_in', `${dateToStr}T23:59:59`);

      if (selectedLocationId && selectedLocationId !== 'all') {
        timesheetsQuery = timesheetsQuery.eq('location_id', selectedLocationId);
      }

      const { data: timesheets } = await timesheetsQuery;

      // Calculate labor cost per hour
      // For simplicity, we attribute full shift cost to clock_in hour
      // A more accurate approach would distribute across all worked hours
      timesheets?.forEach(ts => {
        if (!ts.clock_in || !ts.labor_cost) return;
        
        const clockIn = new Date(ts.clock_in);
        const clockOut = ts.clock_out ? new Date(ts.clock_out) : null;
        const laborCost = Number(ts.labor_cost) || 0;
        
        if (clockOut) {
          // Distribute labor cost across worked hours
          const hoursWorked = Math.max(1, (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60));
          const costPerHour = laborCost / hoursWorked;
          
          let currentHour = clockIn.getHours();
          const endHour = clockOut.getHours();
          
          while (currentHour <= endHour && currentHour <= 23) {
            if (hourlyMap.has(currentHour)) {
              const current = hourlyMap.get(currentHour)!;
              current.labor += costPerHour;
              current.count++;
            }
            currentHour++;
          }
        } else {
          // Single hour attribution
          const hour = clockIn.getHours();
          if (hourlyMap.has(hour)) {
            const current = hourlyMap.get(hour)!;
            current.labor += laborCost;
            current.count++;
          }
        }
      });

      // 2. Fetch forecast data for recommended labor
      // Use forecast_hourly_metrics if available
      if (selectedLocationId && selectedLocationId !== 'all') {
        const { data: forecasts } = await supabase
          .from('forecast_hourly_metrics')
          .select('hour, forecast_sales')
          .eq('location_id', selectedLocationId)
          .eq('date', dateFromStr);

        // Calculate recommended labor based on forecast sales
        // Formula: forecast_sales * target_col% / avg_hourly_wage
        const targetColPct = 0.22; // 22% target COL
        const avgHourlyWage = 14; // €14/hour average

        forecasts?.forEach(f => {
          if (hourlyMap.has(f.hour)) {
            const current = hourlyMap.get(f.hour)!;
            // Recommended labor cost = forecast sales * COL target
            current.recommended = (f.forecast_sales || 0) * targetColPct;
          }
        });
      }

      // If no forecast data, estimate based on sales patterns
      if (!selectedLocationId || selectedLocationId === 'all') {
        // Typical restaurant sales distribution by hour
        const salesDistribution: Record<number, number> = {
          10: 0.02, 11: 0.04, 12: 0.12, 13: 0.15, 14: 0.10,
          15: 0.05, 16: 0.04, 17: 0.06, 18: 0.08, 19: 0.12,
          20: 0.12, 21: 0.08, 22: 0.02, 23: 0.01
        };

        // Get total daily sales estimate
        const { data: salesData } = await supabase
          .from('tickets')
          .select('net_total')
          .eq('status', 'closed')
          .gte('closed_at', `${dateFromStr}T00:00:00`)
          .lte('closed_at', `${dateToStr}T23:59:59`);

        const totalSales = salesData?.reduce((sum, t) => sum + (Number(t.net_total) || 0), 0) || 0;
        const targetColPct = 0.22;

        hourlyMap.forEach((data, hour) => {
          const hourShare = salesDistribution[hour] || 0.05;
          data.recommended = totalSales * hourShare * targetColPct;
        });
      }

      // Convert to array format
      return Array.from(hourlyMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([hour, data]) => ({
          hour: `${hour}:00`,
          real: Math.round(data.labor * 100) / 100,
          recommended: Math.round(data.recommended * 100) / 100
        }));
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false
  });
}
