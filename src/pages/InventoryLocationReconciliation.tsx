import { useState, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { startOfMonth, endOfMonth, parse, format } from 'date-fns';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ReconciliationGrid } from '@/components/inventory/ReconciliationGrid';
import { useReconciliationData } from '@/hooks/useReconciliationData';
import { getDemoGenerator } from '@/lib/demoDataGenerator';
import { useApp } from '@/contexts/AppContext';
import { DateRangePickerNoryLike, type DateMode, type DateRangeValue } from '@/components/bi/DateRangePickerNoryLike';

// Validate locationId format (demo IDs or UUIDs)
function isValidLocationId(id: string | undefined): boolean {
  if (!id) return false;
  // Demo IDs like "loc-west-001" or UUIDs
  const demoPattern = /^loc-[a-z]+-\d{3}$/;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return demoPattern.test(id) || uuidPattern.test(id);
}

export default function InventoryLocationReconciliation() {
  const navigate = useNavigate();
  const { locationId } = useParams<{ locationId: string }>();
  const [searchParams] = useSearchParams();
  const { loading: appLoading } = useApp();
  
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
  const [stockStatus, setStockStatus] = useState<'counted' | 'uncounted' | 'all'>('counted');

  // Validate locationId
  const isValidLocation = useMemo(() => isValidLocationId(locationId), [locationId]);

  // Get location from demo generator
  const currentLocation = useMemo(() => {
    if (!locationId || !isValidLocation) return null;
    try {
      const generator = getDemoGenerator(dateRange.from || new Date(), dateRange.to || new Date());
      return generator.getLocations().find(l => l.id === locationId) || null;
    } catch {
      return null;
    }
  }, [locationId, isValidLocation, dateRange.from, dateRange.to]);

  const selectedLocations = useMemo(() => {
    return locationId && isValidLocation ? [locationId] : [];
  }, [locationId, isValidLocation]);
  
  const { isLoading, lines, totals, lastUpdated } = useReconciliationData(
    dateRange,
    selectedLocations,
    stockStatus
  );

  const handleBackToLocation = () => {
    const params = new URLSearchParams();
    if (dateRange.from) {
      params.set('start', format(dateRange.from, 'yyyy-MM-dd'));
    }
    if (dateRange.to) {
      params.set('end', format(dateRange.to, 'yyyy-MM-dd'));
    }
    const queryString = params.toString();
    navigate(`/inventory/location/${locationId}${queryString ? `?${queryString}` : ''}`);
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

  const dateRangeLabel = dateRange.from && dateRange.to
    ? `${format(dateRange.from, 'd')} - ${format(dateRange.to, 'd MMM')}`
    : '';

  // Loading state while app initializes
  if (appLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Card className="p-6">
          <Skeleton className="h-[400px] w-full" />
        </Card>
      </div>
    );
  }

  // Invalid location guard
  if (!isValidLocation) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md border-border/60">
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4">
        {/* Breadcrumbs */}
        <div className="flex items-center text-sm text-muted-foreground">
          <button 
            onClick={handleBackToAllLocations}
            className="hover:text-foreground transition-colors"
          >
            Counts & Waste
          </button>
          <span className="mx-2">›</span>
          <button 
            onClick={handleBackToLocation}
            className="hover:text-foreground transition-colors"
          >
            Counts
          </button>
          <span className="mx-2">›</span>
          <span className="text-foreground font-medium">Reconciliation report</span>
        </div>

        {/* Title row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleBackToLocation}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                Reconciliation report
              </h1>
              <p className="text-sm text-muted-foreground">
                {currentLocation?.name || 'Location'} • {dateRangeLabel}
                {lastUpdated && (
                  <span className="ml-2">
                    • Last updated {format(lastUpdated, 'HH:mm')}
                  </span>
                )}
              </p>
            </div>
          </div>

          <DateRangePickerNoryLike
            value={dateRange}
            onChange={setDateRange}
            mode={dateMode}
            onModeChange={setDateMode}
          />
        </div>
      </div>

      {/* Reconciliation Grid */}
      <ReconciliationGrid
        lines={lines}
        totals={totals}
        stockStatus={stockStatus}
        setStockStatus={setStockStatus}
        isLoading={isLoading}
      />
    </div>
  );
}
