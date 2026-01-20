import { useState } from 'react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { InventoryHeader } from '@/components/inventory';
import { ReconciliationGrid } from '@/components/inventory/ReconciliationGrid';
import { useReconciliationData } from '@/hooks/useReconciliationData';
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
      <Sheet open={josephineOpen} onOpenChange={setJosephineOpen}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle>Ask Josephine</SheetTitle>
          </SheetHeader>
          <div className="mt-6 text-center text-muted-foreground">
            <p>AI-powered reconciliation insights coming soon...</p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
