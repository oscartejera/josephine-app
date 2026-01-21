import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { startOfWeek, endOfWeek, parseISO, subDays } from 'date-fns';
import {
  WasteHeader,
  WasteKPICards,
  WasteTrendChart,
  WasteReasonValueChart,
  WasteCategoryDonut,
  WasteLeaderboard,
  WasteItemsTable
} from '@/components/waste-new';
import { useWasteDataNew } from '@/hooks/useWasteDataNew';
import type { DateMode, DateRangeValue } from '@/components/bi/DateRangePickerNoryLike';

export default function WasteNew() {
  const [searchParams] = useSearchParams();
  const today = new Date();

  // Default to last 7 days like Nory (29 Sep - 05 Oct style)
  const defaultFrom = subDays(today, 6);
  const defaultTo = today;

  const initialFrom = searchParams.get('start_date') 
    ? parseISO(searchParams.get('start_date')!) 
    : defaultFrom;
  const initialTo = searchParams.get('end_date') 
    ? parseISO(searchParams.get('end_date')!) 
    : defaultTo;
  const initialLocation = searchParams.get('location_id');

  const [dateRange, setDateRange] = useState<DateRangeValue>({
    from: initialFrom,
    to: initialTo
  });
  const [dateMode, setDateMode] = useState<DateMode>('weekly');
  const [selectedLocations, setSelectedLocations] = useState<string[]>(
    initialLocation && initialLocation !== 'all' ? [initialLocation] : []
  );

  const {
    isLoading,
    hasData,
    metrics,
    trendData,
    byReason,
    byCategory,
    leaderboard,
    items,
    seedDemoData
  } = useWasteDataNew(dateRange, dateMode, selectedLocations);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <WasteHeader
        dateRange={dateRange}
        setDateRange={setDateRange}
        dateMode={dateMode}
        setDateMode={setDateMode}
        selectedLocations={selectedLocations}
        setSelectedLocations={setSelectedLocations}
      />

      {/* KPI Cards */}
      <WasteKPICards
        metrics={metrics}
        isLoading={isLoading}
      />

      {/* Charts Row - Trend and Reason Value */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WasteTrendChart
          trendData={trendData}
          byReason={byReason}
          isLoading={isLoading}
        />
        <WasteReasonValueChart
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
        isLoading={isLoading}
        onGenerateDemo={!hasData ? seedDemoData : undefined}
      />
    </div>
  );
}
