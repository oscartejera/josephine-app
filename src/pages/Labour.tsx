/**
 * Labour Page - Nory-style labour analytics dashboard
 * Supports both all-locations view (/labour) and single location view (/labour/:locationId)
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { useLabourData, MetricMode, CompareMode, LabourDateRange } from '@/hooks/useLabourData';
import { 
  LabourHeader, 
  LabourKPICards, 
  LabourChart, 
  LabourLocationTable,
  DepartmentDistribution,
  ShiftTypes 
} from '@/components/labour';
import { AskJosephinePanel } from '@/components/bi/AskJosephinePanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, AlertCircle, RefreshCw } from 'lucide-react';
import { startOfWeek, endOfWeek, parseISO, isValid, format } from 'date-fns';
import { getDemoGenerator } from '@/lib/demoDataGenerator';

// Validate locationId format (demo IDs or UUIDs)
function isValidLocationId(id: string | undefined): boolean {
  if (!id) return false;
  // Demo IDs like "loc-west-001" or UUIDs
  const demoPattern = /^loc-[a-z]+-\d{3}$/;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return demoPattern.test(id) || uuidPattern.test(id);
}

export default function Labour() {
  const { locationId } = useParams<{ locationId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { locations, loading: appLoading } = useApp();

  // Initialize date range from URL or default to current week - memoized to prevent re-computation
  const initialDateRange = useMemo((): LabourDateRange => {
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    
    if (startParam && endParam) {
      const from = parseISO(startParam);
      const to = parseISO(endParam);
      if (isValid(from) && isValid(to)) {
        return { from, to };
      }
    }
    
    const today = new Date();
    return {
      from: startOfWeek(today, { weekStartsOn: 1 }),
      to: endOfWeek(today, { weekStartsOn: 1 })
    };
  }, []); // Only compute once on mount

  // Initialize metric mode from URL
  const initialMetricMode = useMemo((): MetricMode => {
    const modeParam = searchParams.get('mode');
    if (modeParam === 'amount' || modeParam === 'hours' || modeParam === 'percentage') {
      return modeParam;
    }
    return 'percentage';
  }, []);

  // State
  const [dateRange, setDateRange] = useState<LabourDateRange>(initialDateRange);
  const [metricMode, setMetricMode] = useState<MetricMode>(initialMetricMode);
  const [compareMode, setCompareMode] = useState<CompareMode>('forecast');
  const [askPanelOpen, setAskPanelOpen] = useState(false);

  // Validate locationId
  const isValidLocation = useMemo(() => {
    if (!locationId) return true; // No locationId means all locations view
    return isValidLocationId(locationId);
  }, [locationId]);

  // Find location name if in single location view
  const locationInfo = useMemo(() => {
    if (!locationId || !isValidLocation) return null;
    
    // First check real locations
    const realLoc = locations.find(l => l.id === locationId);
    if (realLoc) return { id: realLoc.id, name: realLoc.name };
    
    // Fall back to demo locations
    try {
      const generator = getDemoGenerator(dateRange.from, dateRange.to);
      const demoLoc = generator.getLocations().find(l => l.id === locationId);
      if (demoLoc) return { id: demoLoc.id, name: demoLoc.name };
    } catch {
      // Ignore errors
    }
    
    return null;
  }, [locationId, isValidLocation, locations, dateRange.from, dateRange.to]);

  // Only fetch data when we have valid inputs
  const shouldFetchData = isValidLocation && !appLoading;

  // Fetch data
  const { data, isLoading, error, refetch } = useLabourData({
    dateRange,
    metricMode,
    compareMode,
    locationId: shouldFetchData ? locationId : undefined
  });

  // Navigation back to all locations
  const handleBackToAll = useCallback(() => {
    const params = new URLSearchParams();
    params.set('start', format(dateRange.from, 'yyyy-MM-dd'));
    params.set('end', format(dateRange.to, 'yyyy-MM-dd'));
    params.set('mode', metricMode);
    navigate(`/labour?${params.toString()}`);
  }, [navigate, dateRange, metricMode]);

  // Show loading state while app is initializing
  if (appLoading) {
    return (
      <div className="flex flex-col gap-6 p-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="p-6">
              <Skeleton className="h-6 w-24 mb-4" />
              <Skeleton className="h-10 w-full" />
            </Card>
          ))}
        </div>
        <Card className="p-6">
          <Skeleton className="h-[350px] w-full" />
        </Card>
      </div>
    );
  }

  // Invalid location guard
  if (locationId && !isValidLocation) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-6">
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
              <Button onClick={handleBackToAll} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to All Locations
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-6">
        <Card className="max-w-md border-border/60">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-amber-500" />
              <div>
                <h2 className="text-lg font-semibold">Something went wrong</h2>
                <p className="text-muted-foreground mt-1">
                  Failed to load labour data. Please try again.
                </p>
              </div>
              <div className="flex gap-2">
                {locationId && (
                  <Button variant="outline" onClick={handleBackToAll} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Back to All Locations
                  </Button>
                )}
                <Button onClick={() => refetch()} className="gap-2">
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

  const isLocationView = !!locationId && isValidLocation;

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      {/* Back button for single location view */}
      {isLocationView && (
        <Button 
          variant="ghost" 
          className="w-fit gap-2 -mb-2 text-muted-foreground hover:text-foreground"
          onClick={handleBackToAll}
        >
          <ArrowLeft className="h-4 w-4" />
          All locations
        </Button>
      )}

      {/* Header */}
      <LabourHeader
        dateRange={dateRange}
        setDateRange={setDateRange}
        metricMode={metricMode}
        setMetricMode={setMetricMode}
        compareMode={compareMode}
        setCompareMode={setCompareMode}
        locationId={locationId}
        locationName={locationInfo?.name}
        onAskJosephine={() => setAskPanelOpen(true)}
      />

      {/* KPI Cards */}
      <LabourKPICards 
        data={data} 
        isLoading={isLoading} 
        metricMode={metricMode}
        dateRange={dateRange}
      />

      {/* Chart */}
      <LabourChart 
        data={data} 
        isLoading={isLoading} 
        metricMode={metricMode}
      />

      {/* Location-specific views: Department Distribution and Shift Types */}
      {isLocationView && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DepartmentDistribution 
            data={data?.departmentData} 
            isLoading={isLoading} 
          />
          <ShiftTypes 
            data={data?.shiftTypeData} 
            isLoading={isLoading} 
          />
        </div>
      )}

      {/* Location Table (only show for all locations view) */}
      {!isLocationView && (
        <LabourLocationTable
          data={data}
          isLoading={isLoading}
          dateRange={dateRange}
          metricMode={metricMode}
        />
      )}

      {/* Ask Josephine Panel */}
      <AskJosephinePanel 
        open={askPanelOpen} 
        onClose={() => setAskPanelOpen(false)}
        data={data as any}
      />
    </div>
  );
}
