/**
 * Labour - Complete Labour page with Nory-style design
 * Uses optimized RPCs for data fetching
 */

import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { useApp } from '@/contexts/AppContext';
import { useLabourData, type MetricMode, type LabourDateRange } from '@/hooks/useLabourData';
import { LabourHeader, type CompareMode } from '@/components/labour/LabourHeader';
import { LabourKPICards } from '@/components/labour/LabourKPICards';
import { LabourChart } from '@/components/labour/LabourChart';
import { LabourLocationsTable } from '@/components/labour/LabourLocationsTable';
import { LabourByRole } from '@/components/labour/LabourByRole';
import { AskJosephineLabourPanel } from '@/components/labour/AskJosephineLabourPanel';
import { Skeleton } from '@/components/ui/skeleton';

// Validate UUID format
function isValidUUID(id: string | undefined): boolean {
  if (!id) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

export default function Labour() {
  const { locationId } = useParams<{ locationId?: string }>();
  const { accessibleLocations, loading: appLoading } = useApp();

  // Initial date range: last complete week (always has data)
  const initialDateRange = useMemo(() => {
    const lastWeek = subWeeks(new Date(), 1);
    return {
      from: startOfWeek(lastWeek, { weekStartsOn: 1 }),
      to: endOfWeek(lastWeek, { weekStartsOn: 1 }),
    };
  }, []);

  const [dateRange, setDateRange] = useState<LabourDateRange>(initialDateRange);
  const [metricMode, setMetricMode] = useState<MetricMode>('percentage');
  const [compareMode, setCompareMode] = useState<CompareMode>('forecast');
  const [showJosephine, setShowJosephine] = useState(false);

  // Validate location ID
  const validLocationId = isValidUUID(locationId) ? locationId : null;
  
  // Find location name if we have a location ID
  const locationInfo = useMemo(() => {
    if (!validLocationId) return null;
    const loc = accessibleLocations.find(l => l.id === validLocationId);
    return loc ? { id: loc.id, name: loc.name } : null;
  }, [validLocationId, accessibleLocations]);

  // Fetch data
  const { 
    kpis, 
    timeseries, 
    locations, 
    isLoading, 
    isError,
    isEmpty,
    refetch 
  } = useLabourData({
    dateRange,
    locationId: validLocationId,
  });

  // Loading state
  if (appLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Invalid location ID
  if (locationId && !validLocationId) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Invalid Location</h2>
          <p className="text-muted-foreground">The location ID is not valid.</p>
        </div>
      </div>
    );
  }

  // Location not accessible
  if (validLocationId && !locationInfo && !isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You don't have access to this location.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
        <LabourHeader
          dateRange={dateRange}
          setDateRange={setDateRange}
          metricMode={metricMode}
          setMetricMode={setMetricMode}
          compareMode={compareMode}
          setCompareMode={setCompareMode}
          locationId={validLocationId}
          locationName={locationInfo?.name}
          onAskJosephine={() => setShowJosephine(true)}
        />

        {/* Ask Josephine Panel */}
        <AskJosephineLabourPanel
          open={showJosephine}
          onClose={() => setShowJosephine(false)}
          kpis={kpis}
          locations={locations}
        />

      {/* KPI Cards */}
      <LabourKPICards
        kpis={kpis}
        isLoading={isLoading}
        metricMode={metricMode}
        dateRange={dateRange}
      />

      {/* Chart */}
      <LabourChart
        data={timeseries}
        isLoading={isLoading}
        metricMode={metricMode}
      />

      {/* Labour by Role */}
      <LabourByRole
        isLoading={isLoading}
        metricMode={metricMode}
      />

      {/* Locations Table */}
      <LabourLocationsTable
        data={locations}
        isLoading={isLoading}
        metricMode={metricMode}
      />
    </div>
  );
}
