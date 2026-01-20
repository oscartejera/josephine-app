import { useState } from 'react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { InventoryHeader } from '@/components/inventory';
import { ReconciliationGrid } from '@/components/inventory/ReconciliationGrid';
import { AskJosephineDrawer } from '@/components/inventory/AskJosephineDrawer';
import { useReconciliationData } from '@/hooks/useReconciliationData';
import { useInventoryData } from '@/hooks/useInventoryData';
import type { DateMode, DateRangeValue } from '@/components/bi/DateRangePickerNoryLike';
import type { ViewMode } from '@/components/inventory/InventoryHeader';

export default function InventoryReconciliation() {
  const today = new Date();
  
  const [dateRange, setDateRange] = useState<DateRangeValue>({
    from: startOfMonth(today),
    to: endOfMonth(today)
  });
  const [dateMode, setDateMode] = useState<DateMode>('monthly');
  const [viewMode, setViewMode] = useState<ViewMode>('COGS');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [stockStatus, setStockStatus] = useState<'counted' | 'uncounted' | 'all'>('counted');
  const [josephineOpen, setJosephineOpen] = useState(false);

  const { isLoading, lastUpdated, lines, totals } = useReconciliationData(
    dateRange,
    selectedLocations,
    stockStatus
  );

  // Get inventory metrics for Josephine context
  const {
    metrics,
    categoryBreakdown,
    wasteByCategory,
    locationPerformance
  } = useInventoryData(dateRange, dateMode, viewMode, selectedLocations);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <InventoryHeader
        dateRange={dateRange}
        setDateRange={setDateRange}
        dateMode={dateMode}
        setDateMode={setDateMode}
        viewMode={viewMode}
        setViewMode={setViewMode}
        selectedLocations={selectedLocations}
        setSelectedLocations={setSelectedLocations}
        onAskJosephine={() => setJosephineOpen(true)}
        lastUpdated={lastUpdated}
        isLoading={isLoading}
        showViewToggle={false}
        breadcrumbs={[
          { label: 'Counts & Waste' },
          { label: 'Counts' },
          { label: 'Reconciliation report' }
        ]}
      />

      {/* Reconciliation Grid */}
      <ReconciliationGrid
        lines={lines}
        totals={totals}
        stockStatus={stockStatus}
        setStockStatus={setStockStatus}
        isLoading={isLoading}
      />

      {/* Ask Josephine Drawer */}
      <AskJosephineDrawer
        open={josephineOpen}
        onOpenChange={setJosephineOpen}
        metrics={metrics}
        categoryBreakdown={categoryBreakdown}
        wasteByCategory={wasteByCategory}
        locationPerformance={locationPerformance}
      />
    </div>
  );
}
