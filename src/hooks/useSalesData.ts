/**
 * useSalesData Hook
 * Carga datos de ventas dinámicos según rango de fechas
 */

import { useState, useEffect, useMemo } from 'react';
import { generateYearData } from '@/lib/data-generator/year-data-generator';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, format } from 'date-fns';

export type DateRangeType = 'today' | 'week' | 'month' | 'last30' | 'last90' | 'year';

export function useSalesData(locationId: string | null, rangeType: DateRangeType = 'week') {
  const [allData, setAllData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Generate or load data once
  useEffect(() => {
    if (!locationId || locationId === 'all') {
      setLoading(false);
      return;
    }

    // Generate data async to not block UI (90 days for performance)
    setTimeout(() => {
      try {
        const yearData = generateYearData(locationId, 'demo-org', 90);
        setAllData(yearData);
        console.log('[Sales] Data generated successfully');
      } catch (error) {
        console.error('Error generating data:', error);
      } finally {
        setLoading(false);
      }
    }, 100);
  }, [locationId]);

  // Filter data based on selected range
  const filteredData = useMemo(() => {
    if (!allData) return null;

    const now = new Date();
    let startDate: Date;
    let endDate = now;

    switch (rangeType) {
      case 'today':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        endDate = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'month':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case 'last30':
        startDate = subDays(now, 30);
        break;
      case 'last90':
        startDate = subDays(now, 90);
        break;
      case 'year':
        startDate = subDays(now, 365);
        break;
      default:
        startDate = startOfWeek(now);
    }

    // Filter sales data
    const sales15m = allData.sales15m.filter((s: any) => {
      const ts = new Date(s.ts_bucket);
      return ts >= startDate && ts <= endDate;
    });

    // Aggregate to daily for charts
    const dailyMap = new Map<string, any>();
    
    sales15m.forEach((slot: any) => {
      const day = slot.ts_bucket.split('T')[0];
      
      if (!dailyMap.has(day)) {
        dailyMap.set(day, {
          day,
          actual: 0,
          forecast: 0,
          tickets: 0,
          covers: 0,
          avgCheck: 0,
          dineIn: 0,
          pickUp: 0,
          delivery: 0,
        });
      }

      const dayData = dailyMap.get(day)!;
      dayData.actual += slot.sales_gross;
      dayData.forecast += slot.sales_gross * 1.02; // Mock forecast = actual * 1.02
      dayData.tickets += slot.tickets;
      dayData.covers += slot.covers;
      dayData.dineIn += slot.channel_dine_in || 0;
      dayData.pickUp += slot.channel_pickup || 0;
      dayData.delivery += slot.channel_delivery || 0;
    });

    const dailyData = Array.from(dailyMap.values()).map(d => ({
      ...d,
      avgCheck: d.covers > 0 ? d.actual / d.covers : 0,
    }));

    // Calculate totals
    const totalSales = dailyData.reduce((sum, d) => sum + d.actual, 0);
    const totalForecast = dailyData.reduce((sum, d) => sum + d.forecast, 0);
    const totalCovers = dailyData.reduce((sum, d) => sum + d.covers, 0);
    const totalDineIn = dailyData.reduce((sum, d) => sum + d.dineIn, 0);
    const totalPickUp = dailyData.reduce((sum, d) => sum + d.pickUp, 0);
    const totalDelivery = dailyData.reduce((sum, d) => sum + d.delivery, 0);

    return {
      dailyData,
      totals: {
        sales: totalSales,
        forecast: totalForecast,
        variance: totalForecast > 0 ? ((totalSales - totalForecast) / totalForecast) * 100 : 0,
        covers: totalCovers,
        avgCheck: totalCovers > 0 ? totalSales / totalCovers : 0,
        channels: {
          dineIn: { amount: totalDineIn, pct: (totalDineIn / totalSales) * 100 },
          pickUp: { amount: totalPickUp, pct: (totalPickUp / totalSales) * 100 },
          delivery: { amount: totalDelivery, pct: (totalDelivery / totalSales) * 100 },
        },
      },
    };
  }, [allData, rangeType]);

  return {
    data: filteredData,
    loading,
  };
}
