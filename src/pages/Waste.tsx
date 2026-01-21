import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { startOfMonth, endOfMonth, parseISO } from 'date-fns';
import {
  WasteHeader,
  WasteKPICards,
  WasteTrendChart,
  WasteByReasonChart,
  WasteCategoryDonut,
  WasteLeaderboard,
  WasteItemsTable,
  LogWasteDialog
} from '@/components/waste';
import { useWasteData } from '@/hooks/useWasteData';
import type { DateMode, DateRangeValue } from '@/components/bi/DateRangePickerNoryLike';

export default function Waste() {
  const [searchParams] = useSearchParams();
  const today = new Date();
  const [refreshKey, setRefreshKey] = useState(0);

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
    isConnected,
    metrics,
    trendData,
    byReason,
    byCategory,
    leaderboard,
    items,
    seedDemoData
  } = useWasteData(dateRange, dateMode, selectedLocations);

  const handleWasteLogged = () => {
    // Trigger refresh by updating key
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex-1">
          <WasteHeader
            dateRange={dateRange}
            setDateRange={setDateRange}
            dateMode={dateMode}
            setDateMode={setDateMode}
            selectedLocations={selectedLocations}
            setSelectedLocations={setSelectedLocations}
            isConnected={isConnected}
          />
        </div>
        <div className="flex-shrink-0 pt-8 lg:pt-12">
          <LogWasteDialog
            onSuccess={handleWasteLogged}
            defaultLocationId={selectedLocations[0]}
          />
        </div>
      </div>

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
        onGenerateDemo={seedDemoData}
      />
    </div>
  );
}
