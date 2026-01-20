/**
 * Labour Data Hook - Fetches and processes labour data for the Labour module
 * Supports percentage, amount, and hours display modes
 */

import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/contexts/AppContext';
import { getDemoGenerator } from '@/lib/demoDataGenerator';
import { startOfDay, endOfDay, eachDayOfInterval, format, isSameDay } from 'date-fns';

export type MetricMode = 'percentage' | 'amount' | 'hours';
export type CompareMode = 'forecast' | 'last_week' | 'last_month';
export type ChartMode = 'splh' | 'oplh';

export interface LabourDateRange {
  from: Date;
  to: Date;
}

export interface LabourDailyData {
  date: string;
  dateLabel: string;
  salesActual: number;
  salesProjected: number;
  hoursActual: number;
  hoursPlanned: number;
  labourCostActual: number;
  labourCostPlanned: number;
  colActual: number;
  colPlanned: number;
  splhActual: number;
  splhPlanned: number;
  oplhActual: number;
  oplhPlanned: number;
}

export interface LocationLabourData {
  locationId: string;
  locationName: string;
  salesActual: number;
  salesProjected: number;
  salesDelta: number;
  hoursActual: number;
  hoursPlanned: number;
  hoursDelta: number;
  labourCostActual: number;
  labourCostPlanned: number;
  colActual: number;
  colPlanned: number;
  colDelta: number;
  splhActual: number;
  splhPlanned: number;
  splhDelta: number;
}

export interface LabourKPIs {
  salesActual: number;
  salesProjected: number;
  salesDelta: number;
  colActual: number;
  colPlanned: number;
  colDelta: number;
  hoursActual: number;
  hoursPlanned: number;
  hoursDelta: number;
  labourCostActual: number;
  labourCostPlanned: number;
  splhActual: number;
  splhPlanned: number;
}

export interface LabourData {
  kpis: LabourKPIs;
  dailyData: LabourDailyData[];
  locationData: LocationLabourData[];
}

interface UseLabourDataParams {
  dateRange: LabourDateRange;
  metricMode: MetricMode;
  compareMode: CompareMode;
  locationId?: string;
}

export function useLabourData({ dateRange, metricMode, compareMode, locationId }: UseLabourDataParams) {
  const { group, locations, loading: appLoading } = useApp();

  return useQuery({
    queryKey: ['labour-data', group?.id, dateRange.from.toISOString(), dateRange.to.toISOString(), metricMode, compareMode, locationId],
    queryFn: async (): Promise<LabourData> => {
      // Generate demo data using the existing generator
      const generator = getDemoGenerator(dateRange.from, dateRange.to);
      
      // Get location list
      const locationsToProcess = locationId 
        ? locations.filter(l => l.id === locationId)
        : locations;
      
      // Use demo locations if no real locations
      const demoLocations = generator.getLocations();
      const effectiveLocations = locationsToProcess.length > 0 
        ? locationsToProcess.map(l => ({
            id: l.id,
            name: l.name
          }))
        : demoLocations.map(l => ({
            id: l.id,
            name: l.name
          }));

      // Generate daily data for the range
      const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
      const dailyData: LabourDailyData[] = [];
      
      // Location performance data
      const locationDataMap = new Map<string, LocationLabourData>();
      
      // Initialize location data
      for (const loc of effectiveLocations) {
        locationDataMap.set(loc.id, {
          locationId: loc.id,
          locationName: loc.name,
          salesActual: 0,
          salesProjected: 0,
          salesDelta: 0,
          hoursActual: 0,
          hoursPlanned: 0,
          hoursDelta: 0,
          labourCostActual: 0,
          labourCostPlanned: 0,
          colActual: 0,
          colPlanned: 0,
          colDelta: 0,
          splhActual: 0,
          splhPlanned: 0,
          splhDelta: 0
        });
      }
      
      // Process each day
      for (const day of days) {
        let daySalesActual = 0;
        let daySalesProjected = 0;
        let dayHoursActual = 0;
        let dayHoursPlanned = 0;
        let dayLabourCostActual = 0;
        let dayLabourCostPlanned = 0;
        
        for (const loc of effectiveLocations) {
          // Get sales from tickets (demo generator)
          const dayStr = format(day, 'yyyy-MM-dd');
          
          // Generate realistic labour data based on location size
          const baseSales = generateLocationDaySales(loc.name, day);
          const salesActual = baseSales;
          const salesProjected = baseSales * randomBetween(0.92, 1.08, hashCode(dayStr + loc.id));
          
          // Hours based on sales (roughly €100-150 per labour hour)
          const avgSalesPerHour = randomBetween(100, 150, hashCode(dayStr + loc.id + 'hours'));
          const hoursActual = Math.round(salesActual / avgSalesPerHour);
          const hoursPlanned = Math.round(salesProjected / avgSalesPerHour * randomBetween(0.95, 1.05, hashCode(dayStr + loc.id + 'planned')));
          
          // Hourly rate €12-18
          const avgHourlyRate = randomBetween(12, 18, hashCode(loc.id + 'rate'));
          const labourCostActual = hoursActual * avgHourlyRate;
          const labourCostPlanned = hoursPlanned * avgHourlyRate;
          
          // Accumulate to location totals
          const locData = locationDataMap.get(loc.id)!;
          locData.salesActual += salesActual;
          locData.salesProjected += salesProjected;
          locData.hoursActual += hoursActual;
          locData.hoursPlanned += hoursPlanned;
          locData.labourCostActual += labourCostActual;
          locData.labourCostPlanned += labourCostPlanned;
          
          // Accumulate to daily totals
          daySalesActual += salesActual;
          daySalesProjected += salesProjected;
          dayHoursActual += hoursActual;
          dayHoursPlanned += hoursPlanned;
          dayLabourCostActual += labourCostActual;
          dayLabourCostPlanned += labourCostPlanned;
        }
        
        // Calculate daily derived metrics
        const colActual = daySalesActual > 0 ? (dayLabourCostActual / daySalesActual) * 100 : 0;
        const colPlanned = daySalesProjected > 0 ? (dayLabourCostPlanned / daySalesProjected) * 100 : 0;
        const splhActual = dayHoursActual > 0 ? daySalesActual / dayHoursActual : 0;
        const splhPlanned = dayHoursPlanned > 0 ? daySalesProjected / dayHoursPlanned : 0;
        const oplhActual = splhActual * 0.65; // Simplified OPLH calculation (GP-based)
        const oplhPlanned = splhPlanned * 0.65;
        
        dailyData.push({
          date: format(day, 'yyyy-MM-dd'),
          dateLabel: format(day, 'EEE d'),
          salesActual: daySalesActual,
          salesProjected: daySalesProjected,
          hoursActual: dayHoursActual,
          hoursPlanned: dayHoursPlanned,
          labourCostActual: dayLabourCostActual,
          labourCostPlanned: dayLabourCostPlanned,
          colActual,
          colPlanned,
          splhActual,
          splhPlanned,
          oplhActual,
          oplhPlanned
        });
      }
      
      // Finalize location data with calculated metrics
      const locationData: LocationLabourData[] = [];
      for (const [, locData] of locationDataMap) {
        locData.colActual = locData.salesActual > 0 
          ? (locData.labourCostActual / locData.salesActual) * 100 
          : 0;
        locData.colPlanned = locData.salesProjected > 0 
          ? (locData.labourCostPlanned / locData.salesProjected) * 100 
          : 0;
        locData.splhActual = locData.hoursActual > 0 
          ? locData.salesActual / locData.hoursActual 
          : 0;
        locData.splhPlanned = locData.hoursPlanned > 0 
          ? locData.salesProjected / locData.hoursPlanned 
          : 0;
        
        // Calculate deltas
        locData.salesDelta = locData.salesProjected > 0 
          ? ((locData.salesActual - locData.salesProjected) / locData.salesProjected) * 100 
          : 0;
        locData.colDelta = locData.colPlanned > 0 
          ? ((locData.colActual - locData.colPlanned) / locData.colPlanned) * 100 
          : 0;
        locData.splhDelta = locData.splhPlanned > 0 
          ? ((locData.splhActual - locData.splhPlanned) / locData.splhPlanned) * 100 
          : 0;
        locData.hoursDelta = locData.hoursPlanned > 0
          ? ((locData.hoursActual - locData.hoursPlanned) / locData.hoursPlanned) * 100
          : 0;
        
        locationData.push(locData);
      }
      
      // Sort by sales descending
      locationData.sort((a, b) => b.salesActual - a.salesActual);
      
      // Calculate overall KPIs
      const totals = locationData.reduce((acc, loc) => ({
        salesActual: acc.salesActual + loc.salesActual,
        salesProjected: acc.salesProjected + loc.salesProjected,
        hoursActual: acc.hoursActual + loc.hoursActual,
        hoursPlanned: acc.hoursPlanned + loc.hoursPlanned,
        labourCostActual: acc.labourCostActual + loc.labourCostActual,
        labourCostPlanned: acc.labourCostPlanned + loc.labourCostPlanned
      }), {
        salesActual: 0,
        salesProjected: 0,
        hoursActual: 0,
        hoursPlanned: 0,
        labourCostActual: 0,
        labourCostPlanned: 0
      });
      
      const kpis: LabourKPIs = {
        salesActual: totals.salesActual,
        salesProjected: totals.salesProjected,
        salesDelta: totals.salesProjected > 0 
          ? ((totals.salesActual - totals.salesProjected) / totals.salesProjected) * 100 
          : 0,
        labourCostActual: totals.labourCostActual,
        labourCostPlanned: totals.labourCostPlanned,
        colActual: totals.salesActual > 0 
          ? (totals.labourCostActual / totals.salesActual) * 100 
          : 0,
        colPlanned: totals.salesProjected > 0 
          ? (totals.labourCostPlanned / totals.salesProjected) * 100 
          : 0,
        colDelta: 0,
        hoursActual: totals.hoursActual,
        hoursPlanned: totals.hoursPlanned,
        hoursDelta: totals.hoursPlanned > 0
          ? ((totals.hoursActual - totals.hoursPlanned) / totals.hoursPlanned) * 100
          : 0,
        splhActual: totals.hoursActual > 0 
          ? totals.salesActual / totals.hoursActual 
          : 0,
        splhPlanned: totals.hoursPlanned > 0 
          ? totals.salesProjected / totals.hoursPlanned 
          : 0
      };
      
      // Calculate COL delta (inverted - lower is better)
      kpis.colDelta = kpis.colPlanned > 0 
        ? ((kpis.colActual - kpis.colPlanned) / kpis.colPlanned) * 100 
        : 0;
      
      return {
        kpis,
        dailyData,
        locationData
      };
    },
    enabled: !appLoading,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });
}

// Helper functions for deterministic demo data
function hashCode(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return Math.abs(hash);
}

function randomBetween(min: number, max: number, seed: number): number {
  const x = Math.sin(seed) * 10000;
  const r = x - Math.floor(x);
  return min + r * (max - min);
}

function generateLocationDaySales(locationName: string, date: Date): number {
  const seed = hashCode(locationName + format(date, 'yyyy-MM-dd'));
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
  
  // Base sales by location "size"
  const baseSalesMap: Record<string, [number, number]> = {
    'CPU': [4000, 8000],
    'Westside': [5000, 10000],
    'Southside': [3500, 7500],
    'HQ': [2500, 5000],
    'Westend': [4500, 8500],
    'Eastside': [3000, 6500]
  };
  
  const range = baseSalesMap[locationName] || [3000, 6000];
  const weekendMultiplier = isWeekend ? 1.25 : 1.0;
  
  return Math.round(randomBetween(range[0], range[1], seed) * weekendMultiplier);
}
