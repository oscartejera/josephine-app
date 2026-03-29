import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  WasteHeader,
  WasteKPICards,
  WasteTrendChart,
  WasteByReasonChart,
  WasteCategoryDonut,
  WasteLeaderboard,
  WasteItemsTable,
  WasteAlertBanner,
  WasteMECrossRef,
  WasteShiftAnalysis,
  WasteHeatmap,
  WastePatterns,
  WastePnLImpact,
  LogWasteDialog
} from '@/components/waste';
import { useWasteData } from '@/hooks/useWasteData';
import { useWasteAlerts } from '@/hooks/useWasteAlerts';
import { useWasteShiftAnalysis } from '@/hooks/useWasteShiftAnalysis';
import { useMenuEngineeringData } from '@/hooks/useMenuEngineeringData';
import { generateWastePDF } from '@/hooks/useWastePDF';
import { DemoDataBanner } from '@/components/ui/DemoDataBanner';
import type { DateMode, DateRangeValue } from '@/components/bi/DateRangePickerNoryLike';

export default function Waste() {
  const [searchParams] = useSearchParams();
  const today = new Date();
  const [refreshKey, setRefreshKey] = useState(0);

  // Initialize from query params if present
  const initialFrom = searchParams.get('start_date')
    ? parseISO(searchParams.get('start_date')!)
    : startOfMonth(today);
  const initialTo = searchParams.get('end_date')
    ? parseISO(searchParams.get('end_date')!)
    : endOfMonth(today);
  const initialLocation = searchParams.get('location_id');

  const [dateRange, setDateRange] = useState<DateRangeValue>({
    from: initialFrom,
    to: initialTo
  });
  const [dateMode, setDateMode] = useState<DateMode>('monthly');
  const [selectedLocations, setSelectedLocations] = useState<string[]>(
    initialLocation && initialLocation !== 'all' ? [initialLocation] : []
  );

  // Configurable waste target (default 3%)
  const [wasteTarget] = useState(3.0);

  const {
    isLoading,
    isConnected,
    metrics,
    prevMetrics,
    trendData,
    byReason,
    byCategory,
    leaderboard,
    items,
    rawEvents,
  } = useWasteData(dateRange, dateMode, selectedLocations);

  const handleWasteLogged = () => {
    setRefreshKey(k => k + 1);
  };

  // Spike detection alerts
  const alerts = useWasteAlerts({
    metrics,
    byReason,
    topItems: items,
  });

  // Menu Engineering data for cross-reference
  const { items: meItems, loading: meLoading } = useMenuEngineeringData();

  // Shift analysis, heatmap, and patterns (Sprint 3)
  const { shiftData, heatmapData, patterns } = useWasteShiftAnalysis(rawEvents);

  // PDF Export handler (Sprint 4)
  const handleExportPDF = useCallback(() => {
    try {
      generateWastePDF({
        metrics,
        wasteTarget,
        items,
        byReason,
        byCategory,
        shiftData,
        patterns,
        dateFrom: dateRange.from,
        dateTo: dateRange.to,
        locationName: 'Todos los locales',
      });
      toast.success('PDF generado', { description: 'El informe se ha descargado correctamente.' });
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('Error al generar PDF', { description: 'Inténtalo de nuevo.' });
    }
  }, [metrics, wasteTarget, items, byReason, byCategory, shiftData, patterns, dateRange]);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Demo Data Warning */}
      <DemoDataBanner />

      {/* Header with Log Waste + Export PDF buttons */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex-1">
          <WasteHeader
            dateRange={dateRange}
            setDateRange={setDateRange}
            dateMode={dateMode}
            setDateMode={setDateMode}
            selectedLocations={selectedLocations}
            setSelectedLocations={setSelectedLocations}
            isConnected={isConnected}
          />
        </div>
        <div className="flex-shrink-0 lg:pt-6 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={isLoading || items.length === 0}
            className="gap-1.5"
          >
            <FileDown className="h-4 w-4" />
            Exportar PDF
          </Button>
          <LogWasteDialog
            onSuccess={handleWasteLogged}
            defaultLocationId={selectedLocations[0]}
          />
        </div>
      </div>

      {/* KPI Cards Row — with target + period deltas */}
      <WasteKPICards
        totalSales={metrics.totalSales}
        totalAccountedWaste={metrics.totalAccountedWaste}
        wastePercentOfSales={metrics.wastePercentOfSales}
        wasteTarget={wasteTarget}
        prevTotalWaste={prevMetrics?.totalWaste}
        prevWastePercent={prevMetrics?.wastePercent}
        isLoading={isLoading}
      />

      {/* P&L Impact (Sprint 4) */}
      <WastePnLImpact
        metrics={metrics}
        wasteTarget={wasteTarget}
        isLoading={isLoading}
      />

      {/* Alert Banners — spike detection */}
      <WasteAlertBanner alerts={alerts} />

      {/* ME ↔ Waste Cross-Reference */}
      <WasteMECrossRef
        wasteItems={items}
        meItems={meItems}
        isLoading={isLoading || meLoading}
      />

      {/* Charts Row - Trend and By Reason Value */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WasteTrendChart
          trendData={trendData}
          byReason={byReason}
          isLoading={isLoading}
        />
        <WasteByReasonChart
          byReason={byReason}
          isLoading={isLoading}
        />
      </div>

      {/* Sprint 3: Heatmap (full width) */}
      <WasteHeatmap
        heatmapData={heatmapData}
        isLoading={isLoading}
      />

      {/* Sprint 3: Shift Analysis + Patterns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WasteShiftAnalysis
          shiftData={shiftData}
          isLoading={isLoading}
        />
        <WastePatterns
          patterns={patterns}
          isLoading={isLoading}
        />
      </div>

      {/* Category Donut and Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WasteCategoryDonut
          byCategory={byCategory}
          isLoading={isLoading}
        />
        <WasteLeaderboard
          leaderboard={leaderboard}
          isLoading={isLoading}
        />
      </div>

      {/* Items Table */}
      <WasteItemsTable
        items={items}
        totalWastePercent={metrics.wastePercentOfSales}
        isLoading={isLoading}
      />
    </div>
  );
}
