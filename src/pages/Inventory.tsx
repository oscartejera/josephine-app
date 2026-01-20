import { useState } from 'react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { 
  InventoryHeader, 
  InventorySalesCard, 
  InventoryCOGSGPCard, 
  InventoryGapCard,
  InventoryBreakdownChart,
  InventoryWasteOverview,
  LocationPerformanceTable,
  type ViewMode
} from '@/components/inventory';
import { useInventoryData } from '@/hooks/useInventoryData';
import type { DateMode, DateRangeValue } from '@/components/bi/DateRangePickerNoryLike';

export default function Inventory() {
  const navigate = useNavigate();
  const today = new Date();
  
  const [dateRange, setDateRange] = useState<DateRangeValue>({
    from: startOfMonth(today),
    to: endOfMonth(today)
  });
  const [dateMode, setDateMode] = useState<DateMode>('monthly');
  const [viewMode, setViewMode] = useState<ViewMode>('COGS');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [josephineOpen, setJosephineOpen] = useState(false);

  const {
    isLoading,
    lastUpdated,
    metrics,
    categoryBreakdown,
    wasteByCategory,
    wasteByLocation,
    locationPerformance
  } = useInventoryData(dateRange, dateMode, viewMode, selectedLocations);

  const isCOGS = viewMode === 'COGS';

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
        breadcrumbs={[{ label: 'Insights' }, { label: 'Inventory' }]}
      />

      {/* Navigation to Reconciliation */}
      <div className="flex items-center gap-2">
        <Button 
          variant="outline" 
          onClick={() => navigate('/inventory/reconciliation')}
          className="gap-2"
        >
          <FileText className="h-4 w-4" />
          Reconciliation Report
        </Button>
      </div>

      {/* Top Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <InventorySalesCard
          totalSales={metrics.totalSales}
          assignedSales={metrics.assignedSales}
          unassignedSales={metrics.unassignedSales}
          isLoading={isLoading}
        />
        <InventoryCOGSGPCard
          viewMode={viewMode}
          actualPercent={isCOGS ? metrics.actualCOGSPercent : metrics.actualGPPercent}
          actualAmount={isCOGS ? metrics.actualCOGS : metrics.actualGP}
          theoreticalPercent={isCOGS ? metrics.theoreticalCOGSPercent : metrics.theoreticalGPPercent}
          theoreticalAmount={isCOGS ? metrics.theoreticalCOGS : metrics.theoreticalGP}
          gapPercent={isCOGS ? metrics.gapCOGSPercent : metrics.gapGPPercent}
          gapAmount={isCOGS ? metrics.gapCOGS : metrics.gapGP}
          totalSales={metrics.totalSales}
          isLoading={isLoading}
        />
        <InventoryGapCard
          viewMode={viewMode}
          gapPercent={isCOGS ? metrics.gapCOGSPercent : metrics.gapGPPercent}
          gapAmount={isCOGS ? metrics.gapCOGS : metrics.gapGP}
          accountedWaste={metrics.accountedWaste}
          unaccountedWaste={metrics.unaccountedWaste}
          surplus={metrics.surplus}
          isLoading={isLoading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <InventoryBreakdownChart
          viewMode={viewMode}
          data={categoryBreakdown}
          totalSales={metrics.totalSales}
          isLoading={isLoading}
        />
        <InventoryWasteOverview
          categoryData={wasteByCategory}
          locationData={wasteByLocation}
          isLoading={isLoading}
        />
      </div>

      {/* Location Performance */}
      <LocationPerformanceTable
        viewMode={viewMode}
        data={locationPerformance}
        isLoading={isLoading}
      />

      {/* Ask Josephine Drawer */}
      <Sheet open={josephineOpen} onOpenChange={setJosephineOpen}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle>Ask Josephine</SheetTitle>
          </SheetHeader>
          <div className="mt-6 text-center text-muted-foreground">
            <p>AI-powered inventory insights coming soon...</p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
