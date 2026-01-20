import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { startOfMonth, endOfMonth, parse, format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, ArrowLeft, AlertCircle, RefreshCw } from 'lucide-react';
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

// Validate locationId format (demo IDs or UUIDs)
function isValidLocationId(id: string | undefined): boolean {
  if (!id) return false;
  // Demo IDs like "loc-west-001" or UUIDs
  const demoPattern = /^loc-[a-z]+-\d{3}$/;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return demoPattern.test(id) || uuidPattern.test(id);
}

export default function InventoryLocation() {
  const navigate = useNavigate();
  const { locationId } = useParams<{ locationId: string }>();
  const [searchParams] = useSearchParams();
  
  // Stable initial date range - memoized to prevent re-computation
  const initialDateRange = useMemo((): DateRangeValue => {
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
    const today = new Date();
    return {
      from: startOfMonth(today),
      to: endOfMonth(today)
    };
  }, []); // Only compute once on mount

  const [dateRange, setDateRange] = useState<DateRangeValue>(initialDateRange);
  const [dateMode, setDateMode] = useState<DateMode>('monthly');
  const [viewMode, setViewMode] = useState<ViewMode>('GP');
  const [josephineOpen, setJosephineOpen] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Validate locationId
  const isValidLocation = isValidLocationId(locationId);

  // Stable selectedLocations array - only changes when locationId changes
  const selectedLocations = useMemo(() => {
    return locationId && isValidLocation ? [locationId] : [];
  }, [locationId, isValidLocation]);

  const {
    isLoading,
    lastUpdated,
    metrics,
    categoryBreakdown,
    wasteByCategory,
    wasteByLocation,
    locationPerformance,
    error: dataError
  } = useInventoryData(dateRange, dateMode, viewMode, selectedLocations);

  // Get location name for title - memoized to prevent unnecessary recalculations
  const currentLocation = useMemo(() => {
    if (!locationId || !isValidLocation) return null;
    try {
      const generator = getDemoGenerator(dateRange.from || new Date(), dateRange.to || new Date());
      return generator.getLocations().find(l => l.id === locationId) || null;
    } catch {
      return null;
    }
  }, [locationId, isValidLocation, dateRange.from, dateRange.to]);

  // Track errors
  useEffect(() => {
    if (dataError) {
      console.error('InventoryLocation error:', { locationId, dateRange, error: dataError });
      setHasError(true);
    }
  }, [dataError, locationId, dateRange]);

  // Stable handlers
  const handleBackToAllLocations = useCallback(() => {
    const params = new URLSearchParams();
    if (dateRange.from) {
      params.set('start', format(dateRange.from, 'yyyy-MM-dd'));
    }
    if (dateRange.to) {
      params.set('end', format(dateRange.to, 'yyyy-MM-dd'));
    }
    const queryString = params.toString();
    navigate(`/inventory${queryString ? `?${queryString}` : ''}`);
  }, [navigate, dateRange]);

  const handleNavigateToReconciliation = useCallback(() => {
    const params = new URLSearchParams();
    if (dateRange.from) {
      params.set('start', format(dateRange.from, 'yyyy-MM-dd'));
    }
    if (dateRange.to) {
      params.set('end', format(dateRange.to, 'yyyy-MM-dd'));
    }
    const queryString = params.toString();
    navigate(`/inventory/location/${locationId}/reconciliation${queryString ? `?${queryString}` : ''}`);
  }, [navigate, locationId, dateRange]);

  const handleRetry = useCallback(() => {
    setHasError(false);
    // Force a re-fetch by updating date range with same values
    setDateRange(prev => ({ ...prev }));
  }, []);

  const isCOGS = viewMode === 'COGS';

  // Invalid location guard - render error state
  if (!isValidLocation) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <div>
                <h2 className="text-lg font-semibold">Invalid Location</h2>
                <p className="text-muted-foreground mt-1">
                  The location "{locationId}" could not be found or is invalid.
                </p>
              </div>
              <Button onClick={handleBackToAllLocations} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to All Locations
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state guard
  if (hasError && !isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-amber-500" />
              <div>
                <h2 className="text-lg font-semibold">Something went wrong</h2>
                <p className="text-muted-foreground mt-1">
                  We couldn't load data for this location. Please try again.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleBackToAllLocations} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Inventory
                </Button>
                <Button onClick={handleRetry} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
