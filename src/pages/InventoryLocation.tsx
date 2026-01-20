import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { startOfMonth, endOfMonth, parse, format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { FileText, ArrowLeft } from 'lucide-react';
import { 
  InventoryHeader, 
  InventorySalesCard, 
  InventoryCOGSGPCard, 
  InventoryGapCard,
  InventoryBreakdownChart,
  InventoryWasteOverview,
  type ViewMode
} from '@/components/inventory';
import { AskJosephineDrawer } from '@/components/inventory/AskJosephineDrawer';
import { useInventoryData } from '@/hooks/useInventoryData';
import { getDemoGenerator } from '@/lib/demoDataGenerator';
import type { DateMode, DateRangeValue } from '@/components/bi/DateRangePickerNoryLike';

export default function InventoryLocation() {
  const navigate = useNavigate();
  const { locationId } = useParams<{ locationId: string }>();
  const [searchParams] = useSearchParams();
  const today = new Date();
  
  // Parse date range from URL params
  const getInitialDateRange = (): DateRangeValue => {
    const startDate = searchParams.get('start') || searchParams.get('start_date');
    const endDate = searchParams.get('end') || searchParams.get('end_date');
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
  const [josephineOpen, setJosephineOpen] = useState(false);
  const [reseedTrigger, setReseedTrigger] = useState(0);

  const selectedLocations = locationId ? [locationId] : [];

  const {
    isLoading,
    lastUpdated,
    metrics,
    categoryBreakdown,
    wasteByCategory,
    wasteByLocation,
    locationPerformance
  } = useInventoryData(dateRange, dateMode, viewMode, selectedLocations);

  // Get location name for title
  const currentLocation = locationId 
    ? getDemoGenerator(dateRange.from || today, dateRange.to || today).getLocations().find(l => l.id === locationId)
    : null;

  const handleReseedData = () => {
    setReseedTrigger(prev => prev + 1);
    setTimeout(() => {
      setDateRange({ ...dateRange });
    }, 100);
  };

  const handleBackToAllLocations = () => {
    const params = new URLSearchParams();
    if (dateRange.from) {
      params.set('start', format(dateRange.from, 'yyyy-MM-dd'));
    }
    if (dateRange.to) {
      params.set('end', format(dateRange.to, 'yyyy-MM-dd'));
    }
    const queryString = params.toString();
    navigate(`/inventory${queryString ? `?${queryString}` : ''}`);
  };

  const handleNavigateToReconciliation = () => {
    const params = new URLSearchParams();
    if (dateRange.from) {
      params.set('start', format(dateRange.from, 'yyyy-MM-dd'));
    }
    if (dateRange.to) {
      params.set('end', format(dateRange.to, 'yyyy-MM-dd'));
    }
    const queryString = params.toString();
    navigate(`/inventory/location/${locationId}/reconciliation${queryString ? `?${queryString}` : ''}`);
  };

  const isCOGS = viewMode === 'COGS';

  const breadcrumbs = [
    { label: 'Insights' },
    { label: 'Inventory', path: '/inventory' },
    { label: currentLocation?.name || 'Location' }
  ];

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
        setSelectedLocations={() => {}}
        onAskJosephine={() => setJosephineOpen(true)}
        onReseedData={handleReseedData}
        lastUpdated={lastUpdated}
        isLoading={isLoading}
        breadcrumbs={breadcrumbs}
      />

      {/* Actions row */}
      <div className="flex items-center justify-between gap-4">
        <Button 
          variant="ghost" 
          onClick={handleBackToAllLocations}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          All locations
        </Button>
        
        <Button 
          variant="outline" 
          onClick={handleNavigateToReconciliation}
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
