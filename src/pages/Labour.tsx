/**
 * Labour - Complete Labour page with Nory-style design
 * Uses optimized RPCs for data fetching.
 * Includes labour readiness gate: shows Demo banner + CTA when no real data.
 */

import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { useApp } from '@/contexts/AppContext';
import { useLabourData, type MetricMode, type LabourDateRange } from '@/hooks/useLabourData';
import { useLabourReadiness } from '@/hooks/useLabourReadiness';
import { LabourHeader, type CompareMode } from '@/components/labour/LabourHeader';
import { LabourKPICards } from '@/components/labour/LabourKPICards';
import { LabourChart } from '@/components/labour/LabourChart';
import { LabourLocationsTable } from '@/components/labour/LabourLocationsTable';
import { LabourByRole } from '@/components/labour/LabourByRole';
import { AskJosephineLabourPanel } from '@/components/labour/AskJosephineLabourPanel';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Database, Link, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Validate UUID format
function isValidUUID(id: string | undefined): boolean {
  if (!id) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

export default function Labour() {
  const { t } = useTranslation();
  const { locationId } = useParams<{ locationId?: string }>();
  const { accessibleLocations, loading: appLoading } = useApp();

  // Initial date range: current month
  const initialDateRange = useMemo(() => ({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  }), []);

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

  // Labour readiness gate
  const readiness = useLabourReadiness({
    selectedLocationId: validLocationId ?? 'all',
    dateRange: {
      from: format(dateRange.from, 'yyyy-MM-dd'),
      to: format(dateRange.to, 'yyyy-MM-dd'),
    },
  });

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
      {/* Header + Demo Badge */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
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
        </div>
        {readiness.status === 'demo' && (
          <Badge variant="secondary" className="gap-1 flex-shrink-0">
            <Database className="h-3 w-3" />
            {t('labourReadiness.badgeDemo')}
          </Badge>
        )}
      </div>

      {/* Ask Josephine Panel */}
      <AskJosephineLabourPanel
        open={showJosephine}
        onClose={() => setShowJosephine(false)}
        kpis={kpis}
        locations={locations}
      />

      {/* Labour Readiness Banner — Demo */}
      {readiness.status === 'demo' && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <div className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 space-y-1">
              <p className="font-medium text-amber-900 dark:text-amber-200">
                {t('labourReadiness.demoTitle')}
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-300">
                {readiness.reason === 'pos_no_rows'
                  ? t('labourReadiness.demoDescriptionPosNoRows')
                  : t('labourReadiness.demoDescriptionSimulated')}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => { readiness.refetch(); refetch(); }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t('labourReadiness.refresh')}
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                asChild
              >
                <a href="/integrations">
                  <Link className="h-3.5 w-3.5" />
                  {t('labourReadiness.connectPosCta')}
                </a>
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Labour Readiness Banner — Error */}
      {readiness.status === 'error' && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
          <div className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 space-y-1">
              <p className="font-medium text-red-900 dark:text-red-200">
                {t('labourReadiness.errorTitle')}
              </p>
              <p className="text-sm text-red-800 dark:text-red-300">
                {t('labourReadiness.errorDescription')}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 flex-shrink-0"
              onClick={() => { readiness.refetch(); refetch(); }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t('labourReadiness.retry')}
            </Button>
          </div>
        </Card>
      )}

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
