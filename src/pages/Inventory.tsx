import { useState, useEffect } from 'react';
import { startOfMonth, endOfMonth, parse, format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { 
  InventoryHeader, 
  InventorySalesCard, 
  InventoryCOGSGPCard, 
  InventoryGapCard,
  InventoryBreakdownChart,
  InventoryWasteOverview,
  LocationPerformanceTable,
  StockCountReport,
  type ViewMode
} from '@/components/inventory';
import { AskJosephineDrawer } from '@/components/inventory/AskJosephineDrawer';
import { useInventoryData } from '@/hooks/useInventoryData';
import { getDemoGenerator } from '@/lib/demoDataGenerator';
import type { DateMode, DateRangeValue } from '@/components/bi/DateRangePickerNoryLike';

export default function Inventory() {
  const navigate = useNavigate();
  const { locationId } = useParams<{ locationId: string }>();
  const [searchParams] = useSearchParams();
  const today = new Date();
  
  // Parse date range from URL params
  const getInitialDateRange = (): DateRangeValue => {
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    if (startDate && endDate) {
      try {
        return {
          from: parse(startDate, 'yyyy-MM-dd', new Date()),
          to: parse(endDate, 'yyyy-MM-dd', new Date())
        };
      } catch {
        // Fall back to default
      }
    }
    return {
      from: startOfMonth(today),
      to: endOfMonth(today)
    };
  };

  const [dateRange, setDateRange] = useState<DateRangeValue>(getInitialDateRange);
  const [dateMode, setDateMode] = useState<DateMode>('monthly');
  const [viewMode, setViewMode] = useState<ViewMode>('GP');
  const [selectedLocations, setSelectedLocations] = useState<string[]>(locationId ? [locationId] : []);
  const [josephineOpen, setJosephineOpen] = useState(false);
  const [reseedTrigger, setReseedTrigger] = useState(0);

  // Update selected locations when locationId changes
  useEffect(() => {
    if (locationId) {
      setSelectedLocations([locationId]);
    } else {
      setSelectedLocations([]);
    }
  }, [locationId]);

  const {
    isLoading,
    lastUpdated,
    metrics,
    categoryBreakdown,
    wasteByCategory,
    wasteByLocation,
    locationPerformance
  } = useInventoryData(dateRange, dateMode, viewMode, selectedLocations);

  // Get stock count data for venue view
  const stockCountData = locationId && dateRange.from && dateRange.to
    ? getDemoGenerator(dateRange.from, dateRange.to).getStockCountData(locationId)
    : [];

  // Get location name for title
  const currentLocation = locationId 
    ? getDemoGenerator(dateRange.from || today, dateRange.to || today).getLocations().find(l => l.id === locationId)
    : null;

  // Force refetch when reseed is triggered
  const handleReseedData = () => {
    setReseedTrigger(prev => prev + 1);
    setTimeout(() => {
      setDateRange({ ...dateRange });
    }, 100);
  };

  const isCOGS = viewMode === 'COGS';

  const breadcrumbs = locationId 
    ? [{ label: 'Insights' }, { label: 'Inventory', path: '/inventory' }, { label: currentLocation?.name || 'Location' }]
    : [{ label: 'Insights' }, { label: 'Inventory' }];

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
        onReseedData={handleReseedData}
        lastUpdated={lastUpdated}
        isLoading={isLoading}
        breadcrumbs={breadcrumbs}
      />

      {/* Navigation to Reconciliation - only on main view */}
      {!locationId && (
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
      )}

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
          dateRange={dateRange}
          selectedLocations={selectedLocations}
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

      {/* Location Performance - only on main view */}
      {!locationId && (
        <LocationPerformanceTable
          viewMode={viewMode}
          data={locationPerformance}
          isLoading={isLoading}
          dateRange={dateRange}
        />
      )}

      {/* Stock Count Report - only on venue view */}
      {locationId && stockCountData.length > 0 && (
        <StockCountReport
          dateRange={dateRange}
          data={stockCountData}
          isLoading={isLoading}
          lastUpdated={lastUpdated}
        />
      )}

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
