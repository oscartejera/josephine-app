import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { startOfMonth, endOfMonth, parseISO } from 'date-fns';
import {
  WasteHeader,
  WasteKPICards,
  WasteTrendChart,
  WasteByReasonChart,
  WasteCategoryDonut,
  WasteLeaderboard,
  WasteItemsTable
} from '@/components/waste';
import { useWasteData } from '@/hooks/useWasteData';
import type { DateMode, DateRangeValue } from '@/components/bi/DateRangePickerNoryLike';

export default function Waste() {
  const [searchParams] = useSearchParams();
  const today = new Date();

  // Initialize from query params if present
  const initialFrom = searchParams.get('start_date') 
    ? parseISO(searchParams.get('start_date')!) 
    : startOfMonth(today);
  const initialTo = searchParams.get('end_date') 
    ? parseISO(searchParams.get('end_date')!) 
    : endOfMonth(today);
  const initialLocation = searchParams.get('location_id');

  const [dateRange, setDateRange] = useState<DateRangeValue>({
    from: initialFrom,
    to: initialTo
  });
  const [dateMode, setDateMode] = useState<DateMode>('monthly');
  const [selectedLocations, setSelectedLocations] = useState<string[]>(
    initialLocation && initialLocation !== 'all' ? [initialLocation] : []
  );

  const {
    isLoading,
    metrics,
    trendData,
    byReason,
    byCategory,
    leaderboard,
    items
  } = useWasteData(dateRange, dateMode, selectedLocations);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <WasteHeader
        dateRange={dateRange}
        setDateRange={setDateRange}
        dateMode={dateMode}
        setDateMode={setDateMode}
        selectedLocations={selectedLocations}
        setSelectedLocations={setSelectedLocations}
      />

      {/* KPI Cards Row */}
      <WasteKPICards
        totalSales={metrics.totalSales}
        totalAccountedWaste={metrics.totalAccountedWaste}
        wastePercentOfSales={metrics.wastePercentOfSales}
        isLoading={isLoading}
      />

      {/* Charts Row - Trend and By Reason Value */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WasteTrendChart
          trendData={trendData}
          byReason={byReason}
          isLoading={isLoading}
        />
        <WasteByReasonChart
          byReason={byReason}
          isLoading={isLoading}
        />
      </div>

      {/* Second Row - Category Donut and Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WasteCategoryDonut
          byCategory={byCategory}
          isLoading={isLoading}
        />
        <WasteLeaderboard
          leaderboard={leaderboard}
          isLoading={isLoading}
        />
      </div>

      {/* Items Table */}
      <WasteItemsTable
        items={items}
        totalWastePercent={metrics.wastePercentOfSales}
        isLoading={isLoading}
      />
    </div>
  );
}
