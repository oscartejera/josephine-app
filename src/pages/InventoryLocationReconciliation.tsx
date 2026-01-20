import { useState, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { startOfMonth, endOfMonth, parse, format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReconciliationGrid } from '@/components/inventory/ReconciliationGrid';
import { useReconciliationData } from '@/hooks/useReconciliationData';
import { getDemoGenerator } from '@/lib/demoDataGenerator';
import { DateRangePickerNoryLike, type DateMode, type DateRangeValue } from '@/components/bi/DateRangePickerNoryLike';

export default function InventoryLocationReconciliation() {
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
  const [stockStatus, setStockStatus] = useState<'counted' | 'uncounted' | 'all'>('counted');

  const selectedLocations = locationId ? [locationId] : [];
  
  const { isLoading, lines, totals, lastUpdated } = useReconciliationData(
    dateRange,
    selectedLocations,
    stockStatus
  );

  // Get location name for title
  const currentLocation = locationId 
    ? getDemoGenerator(dateRange.from || today, dateRange.to || today).getLocations().find(l => l.id === locationId)
    : null;

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
                {currentLocation?.name || 'All locations'} • {dateRangeLabel}
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
