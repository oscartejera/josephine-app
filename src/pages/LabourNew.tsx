/**
 * LabourNew - Complete Labour page with Nory-style design
 * Uses new RPCs for optimized data fetching
 */

import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { startOfWeek, endOfWeek } from 'date-fns';
import { useApp } from '@/contexts/AppContext';
import { useLabourDataNew, type MetricMode, type LabourDateRange } from '@/hooks/useLabourDataNew';
import { LabourHeaderNew } from '@/components/labour/LabourHeaderNew';
import { LabourKPICardsNew } from '@/components/labour/LabourKPICardsNew';
import { LabourChartNew } from '@/components/labour/LabourChartNew';
import { LabourLocationsTableNew } from '@/components/labour/LabourLocationsTableNew';
import { LabourEmptyState } from '@/components/labour/LabourEmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

// Validate UUID format
function isValidUUID(id: string | undefined): boolean {
  if (!id) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

export default function LabourNew() {
  const { locationId } = useParams<{ locationId?: string }>();
  const { accessibleLocations, loading: appLoading } = useApp();

  // Initial date range: current week
  const initialDateRange = useMemo(() => ({
    from: startOfWeek(new Date(), { weekStartsOn: 1 }),
    to: endOfWeek(new Date(), { weekStartsOn: 1 }),
  }), []);

  const [dateRange, setDateRange] = useState<LabourDateRange>(initialDateRange);
  const [metricMode, setMetricMode] = useState<MetricMode>('percentage');

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
  } = useLabourDataNew({
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
      <LabourHeaderNew
        dateRange={dateRange}
        setDateRange={setDateRange}
        metricMode={metricMode}
        setMetricMode={setMetricMode}
        locationId={validLocationId}
        locationName={locationInfo?.name}
        onAskJosephine={() => toast.info('Ask Josephine coming soon for Labour insights!')}
      />

      {/* Empty State */}
      {isEmpty && !isLoading ? (
        <LabourEmptyState onDataSeeded={refetch} />
      ) : (
        <>
          {/* KPI Cards */}
          <LabourKPICardsNew
            kpis={kpis}
            isLoading={isLoading}
            metricMode={metricMode}
            dateRange={dateRange}
          />

          {/* Chart */}
          <LabourChartNew
            data={timeseries}
            isLoading={isLoading}
            metricMode={metricMode}
          />

          {/* Locations Table */}
          <LabourLocationsTableNew
            data={locations}
            isLoading={isLoading}
            metricMode={metricMode}
          />
        </>
      )}
    </div>
  );
}
