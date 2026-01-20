/**
 * Labour Page - Nory-style labour analytics dashboard
 * Supports both all-locations view (/labour) and single location view (/labour/:locationId)
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { useLabourData, MetricMode, CompareMode, LabourDateRange } from '@/hooks/useLabourData';
import { LabourHeader, LabourKPICards, LabourChart, LabourLocationTable } from '@/components/labour';
import { AskJosephinePanel } from '@/components/bi/AskJosephinePanel';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { startOfWeek, endOfWeek, parseISO, isValid } from 'date-fns';

export default function Labour() {
  const { locationId } = useParams<{ locationId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { locations, loading: appLoading } = useApp();

  // Initialize date range from URL or default to current week
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
  }, [searchParams]);

  // State
  const [dateRange, setDateRange] = useState<LabourDateRange>(initialDateRange);
  const [metricMode, setMetricMode] = useState<MetricMode>(() => {
    const modeParam = searchParams.get('mode');
    if (modeParam === 'amount' || modeParam === 'hours' || modeParam === 'percentage') {
      return modeParam;
    }
    return 'percentage';
  });
  const [compareMode, setCompareMode] = useState<CompareMode>('forecast');
  const [askPanelOpen, setAskPanelOpen] = useState(false);

  // Find location name if in single location view
  const locationName = useMemo(() => {
    if (!locationId) return undefined;
    const loc = locations.find(l => l.id === locationId);
    return loc?.name;
  }, [locationId, locations]);

  // Fetch data
  const { data, isLoading, error } = useLabourData({
    dateRange,
    metricMode,
    compareMode,
    locationId
  });

  // Navigation back to all locations
  const handleBackToAll = useCallback(() => {
    navigate('/labour');
  }, [navigate]);

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-destructive">Something went wrong loading labour data</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      {/* Back button for single location view */}
      {locationId && (
        <Button 
          variant="ghost" 
          className="w-fit gap-2 -mb-2"
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
        locationName={locationName}
        onAskJosephine={() => setAskPanelOpen(true)}
      />

      {/* KPI Cards */}
      <LabourKPICards 
        data={data} 
        isLoading={isLoading || appLoading} 
        metricMode={metricMode} 
      />

      {/* Chart */}
      <LabourChart 
        data={data} 
        isLoading={isLoading || appLoading} 
        metricMode={metricMode}
      />

      {/* Location Table (only show for all locations view) */}
      {!locationId && (
        <LabourLocationTable
          data={data}
          isLoading={isLoading || appLoading}
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
