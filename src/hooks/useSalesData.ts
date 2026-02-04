/**
 * useSalesData Hook
 * Carga datos de ventas dinámicos desde Supabase según rango de fechas
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, eachDayOfInterval, startOfDay, endOfDay } from 'date-fns';

interface UseSalesDataParams {
  locationIds: string[];
  startDate: Date;
  endDate: Date;
}

export function useSalesData({ locationIds, startDate, endDate }: UseSalesDataParams) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchSalesData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Construir query base
        let query = supabase
          .from('facts_sales_15m')
          .select('*')
          .gte('ts_bucket', startOfDay(startDate).toISOString())
          .lte('ts_bucket', endOfDay(endDate).toISOString())
          .order('ts_bucket', { ascending: true });

        // Filtrar por location si no es 'all'
        if (locationIds.length > 0 && !locationIds.includes('all')) {
          query = query.in('location_id', locationIds);
        }

        const { data: salesData, error: salesError } = await query;

        if (salesError) throw salesError;

        if (!isMounted) return;

        // Si no hay datos, generar mock data
        if (!salesData || salesData.length === 0) {
          const mockData = generateMockData(startDate, endDate, locationIds);
          setData(mockData);
          setLoading(false);
          return;
        }

        // Aggregate data by day
        const dailyMap = new Map<string, any>();
        const allDays = eachDayOfInterval({ start: startDate, end: endDate });

        // Initialize all days with zeros
        allDays.forEach(day => {
          const dayKey = format(day, 'yyyy-MM-dd');
          const dayName = format(day, 'EEEE, d');
          dailyMap.set(dayKey, {
            date: dayKey,
            day: dayName,
            actual: 0,
            forecast: 0,
            forecastLive: 0,
            tickets: 0,
            covers: 0,
            avgCheck: 0,
            avgCheckForecast: 0,
          });
        });

        // Aggregate sales data
        salesData.forEach((slot: any) => {
          const dayKey = format(new Date(slot.ts_bucket), 'yyyy-MM-dd');
          const dayData = dailyMap.get(dayKey);
          
          if (dayData) {
            dayData.actual += Number(slot.sales_net) || 0;
            dayData.forecast += (Number(slot.sales_net) || 0) * 0.98; // Mock forecast slightly below
            dayData.forecastLive += (Number(slot.sales_net) || 0) * 1.02; // Mock live forecast slightly above
            dayData.tickets += Number(slot.tickets) || 0;
            dayData.covers += Number(slot.covers) || 0;
          }
        });

        // Calculate avg checks
        const dailyData = Array.from(dailyMap.values()).map(d => ({
          ...d,
          avgCheck: d.covers > 0 ? d.actual / d.covers : 0,
          avgCheckForecast: d.covers > 0 ? d.forecast / d.covers : 0,
        }));

        // Calculate totals
        const totalSales = dailyData.reduce((sum, d) => sum + d.actual, 0);
        const totalForecast = dailyData.reduce((sum, d) => sum + d.forecast, 0);
        const totalTickets = dailyData.reduce((sum, d) => sum + d.tickets, 0);
        const totalCovers = dailyData.reduce((sum, d) => sum + d.covers, 0);

        const aggregatedData = {
          dailyData,
          totals: {
            sales: totalSales,
            forecast: totalForecast,
            variance: totalForecast > 0 ? ((totalSales - totalForecast) / totalForecast) * 100 : 0,
            tickets: totalTickets,
            covers: totalCovers,
            avgCheck: totalCovers > 0 ? totalSales / totalCovers : 0,
            avgCheckForecast: totalCovers > 0 ? totalForecast / totalCovers : 0,
          },
        };

        setData(aggregatedData);
      } catch (err) {
        console.error('Error fetching sales data:', err);
        if (isMounted) {
          setError(err as Error);
          // Generate mock data on error
          const mockData = generateMockData(startDate, endDate, locationIds);
          setData(mockData);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchSalesData();

    return () => {
      isMounted = false;
    };
  }, [locationIds, startDate, endDate]);

  return { data, loading, error };
}

// Generate mock data when no real data exists
function generateMockData(startDate: Date, endDate: Date, locationIds: string[]) {
  const allDays = eachDayOfInterval({ start: startDate, end: endDate });
  
  const dailyData = allDays.map(day => {
    const dayOfWeek = day.getDay();
    // Weekend boost
    const weekendMultiplier = (dayOfWeek === 5 || dayOfWeek === 6) ? 1.4 : 1.0;
    // Mid-week dip
    const midWeekMultiplier = (dayOfWeek === 2 || dayOfWeek === 3) ? 0.85 : 1.0;
    
    const baseActual = 12000 * weekendMultiplier * midWeekMultiplier * (0.9 + Math.random() * 0.2);
    const forecast = baseActual * 0.98;
    const forecastLive = baseActual * 1.01;
    const covers = Math.floor(baseActual / 24);
    
    return {
      date: format(day, 'yyyy-MM-dd'),
      day: format(day, 'EEEE, d'),
      actual: Math.round(baseActual),
      forecast: Math.round(forecast),
      forecastLive: Math.round(forecastLive),
      tickets: Math.floor(covers * 0.85),
      covers: covers,
      avgCheck: baseActual / covers,
      avgCheckForecast: forecast / covers,
    };
  });

  const totalSales = dailyData.reduce((sum, d) => sum + d.actual, 0);
  const totalForecast = dailyData.reduce((sum, d) => sum + d.forecast, 0);
  const totalCovers = dailyData.reduce((sum, d) => sum + d.covers, 0);

  return {
    dailyData,
    totals: {
      sales: totalSales,
      forecast: totalForecast,
      variance: totalForecast > 0 ? ((totalSales - totalForecast) / totalForecast) * 100 : 0,
      tickets: dailyData.reduce((sum, d) => sum + d.tickets, 0),
      covers: totalCovers,
      avgCheck: totalCovers > 0 ? totalSales / totalCovers : 0,
      avgCheckForecast: totalCovers > 0 ? totalForecast / totalCovers : 0,
    },
  };
}
