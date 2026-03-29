import { useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { FileDown, BarChart3, LineChart, Building2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
  WasteForecastCard,
  WasteSmartActions,
  WastePrepOptimizer,
  WasteSupplierScore,
  WasteShelfLifeTracker,
  WasteTeamScore,
  WasteBenchmark,
  WasteThresholdConfig,
  WasteVarianceAnalysis,
  WasteImpactSimulator,
  WasteRecipeCost,
  WasteAnnualReport,
  WasteQuickLog,
  WasteEndOfDay,
  WasteDataQuality,
  LogWasteDialog
} from '@/components/waste';
import { useWasteData } from '@/hooks/useWasteData';
import { useWasteAlerts } from '@/hooks/useWasteAlerts';
import { useWasteShiftAnalysis } from '@/hooks/useWasteShiftAnalysis';
import { useMenuEngineeringData } from '@/hooks/useMenuEngineeringData';
import { generateWastePDF } from '@/hooks/useWastePDF';
import { useWasteForecast } from '@/hooks/useWasteForecast';
import { useWastePrepOptimization } from '@/hooks/useWastePrepOptimization';
import { useWasteSupplierScore } from '@/hooks/useWasteSupplierScore';
import { useWasteShelfLife } from '@/hooks/useWasteShelfLife';
import { useWasteTeamScore } from '@/hooks/useWasteTeamScore';
import { useWasteBenchmark } from '@/hooks/useWasteBenchmark';
import { useWasteAutoActions } from '@/hooks/useWasteAutoActions';
import { useWasteVariance } from '@/hooks/useWasteVariance';
import { useWasteSimulation } from '@/hooks/useWasteSimulation';
import { useWasteRecipeCost } from '@/hooks/useWasteRecipeCost';
import { useWasteAnnualReport } from '@/hooks/useWasteAnnualReport';
import { useWasteDataQuality } from '@/hooks/useWasteDataQuality';
import { differenceInDays } from 'date-fns';
import { useApp } from '@/contexts/AppContext';
import { DemoDataBanner } from '@/components/ui/DemoDataBanner';
import type { DateMode, DateRangeValue } from '@/components/bi/DateRangePickerNoryLike';

type ViewMode = 'simple' | 'advanced' | 'executive';

const VIEW_MODE_KEY = 'josephine_waste_view';
const VIEW_MODES: { value: ViewMode; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'simple',    label: 'Simple',    icon: <BarChart3 className="h-3.5 w-3.5" />,  desc: 'KPIs + tendencias + registro' },
  { value: 'advanced',  label: 'Avanzado',  icon: <LineChart className="h-3.5 w-3.5" />,  desc: '+ financiero + predicción + patrones' },
  { value: 'executive', label: 'Ejecutivo', icon: <Building2 className="h-3.5 w-3.5" />, desc: '+ informe anual + benchmarks' },
];

export default function Waste() {
  const [searchParams] = useSearchParams();
  const today = new Date();
  const [refreshKey, setRefreshKey] = useState(0);

  // Progressive disclosure — persisted view mode
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try { return (localStorage.getItem(VIEW_MODE_KEY) as ViewMode) || 'simple'; }
    catch { return 'simple'; }
  });
  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  };
  const showAdvanced = viewMode === 'advanced' || viewMode === 'executive';
  const showExecutive = viewMode === 'executive';

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

  // Waste Forecast — Phase 2: Predictive Intelligence
  const { dailyForecasts, summary: forecastSummary, isReliable: forecastReliable } = useWasteForecast(
    rawEvents,
    wasteTarget,
    metrics.totalSales,
  );

  // Prep Optimization — Phase 2
  const prepResult = useWastePrepOptimization(rawEvents, metrics.totalSales);

  // Supplier Quality Score — Phase 2
  const supplierResult = useWasteSupplierScore(rawEvents);

  // Shelf-Life Tracker — Phase 2 (complete version)
  const shelfLifeResult = useWasteShelfLife();

  // Team Waste Score — Phase 3 (gamification)
  const teamScoreResult = useWasteTeamScore(
    rawEvents,
    leaderboard.map(l => ({ id: l.employeeId || '', full_name: l.employeeName })),
  );

  // Cross-Location Benchmark — Phase 3
  const { locations: appLocations } = useApp();
  const benchmarkResult = useWasteBenchmark(rawEvents, appLocations);

  // Auto-Actions — Phase 3
  const autoActionsResult = useWasteAutoActions(
    metrics.wastePercentOfSales,
    wasteTarget,
    metrics.totalAccountedWaste,
  );

  // Phase 4 — Financial Intelligence
  const periodDays = Math.max(1, differenceInDays(dateRange.to, dateRange.from) + 1);

  // Variance Analysis
  const varianceResult = useWasteVariance(rawEvents, metrics.totalSales);

  // Impact Simulator
  const simulationResult = useWasteSimulation(
    metrics.wastePercentOfSales,
    metrics.totalAccountedWaste,
    metrics.totalSales,
    periodDays,
  );

  // Waste-Adjusted Recipe Cost
  const recipeCostResult = useWasteRecipeCost(
    rawEvents,
    meItems.map(m => ({
      name: m.name || '',
      selling_price: (m as any).selling_price || (m as any).price || 0,
      food_cost: (m as any).food_cost || 0,
      food_cost_pct: (m as any).food_cost_pct || 0,
      quantity_sold: (m as any).quantity_sold || (m as any).qty_sold || 0,
    })),
    metrics.totalSales,
  );

  // Annual Report
  const annualReportResult = useWasteAnnualReport(rawEvents, metrics.totalSales, periodDays);

  // P1 — Data Quality Score
  const dataQualityResult = useWasteDataQuality(rawEvents, dateRange);

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

  // Nudge: no data in 3+ days
  const lastEventDate = useMemo(() => {
    if (!rawEvents || rawEvents.length === 0) return null;
    const dates = rawEvents.map(e => new Date(e.created_at).getTime());
    return new Date(Math.max(...dates));
  }, [rawEvents]);
  const daysSinceLastLog = lastEventDate
    ? Math.floor((Date.now() - lastEventDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const showNudge = !isLoading && (rawEvents.length === 0 || (daysSinceLastLog !== null && daysSinceLastLog >= 3));

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Demo Data Warning */}
      <DemoDataBanner />

      {/* Header with view mode + action buttons */}
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
        <div className="flex-shrink-0 lg:pt-6 flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={isLoading || items.length === 0}
            className="gap-1.5"
          >
            <FileDown className="h-4 w-4" />
            PDF
          </Button>
          <WasteEndOfDay
            defaultLocationId={selectedLocations[0]}
            onSuccess={handleWasteLogged}
          />
          <WasteQuickLog
            defaultLocationId={selectedLocations[0]}
            onSuccess={handleWasteLogged}
          />
          <LogWasteDialog
            onSuccess={handleWasteLogged}
            defaultLocationId={selectedLocations[0]}
          />
        </div>
      </div>

      {/* View Mode Selector — Progressive Disclosure */}
      <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-xl w-fit">
        {VIEW_MODES.map(mode => (
          <button
            key={mode.value}
            onClick={() => handleViewChange(mode.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              viewMode === mode.value
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title={mode.desc}
          >
            {mode.icon}
            {mode.label}
          </button>
        ))}
      </div>

      {/* Nudge: no recent data */}
      {showNudge && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {rawEvents.length === 0
                  ? '⚠️ Sin registros de merma en este período'
                  : `⚠️ Sin registros en los últimos ${daysSinceLastLog} días`
                }
              </p>
              <p className="text-xs text-muted-foreground">
                Los datos de análisis dependen de registros regulares. Usa "Quick Log" o "Cierre de Merma" arriba para registrar rápidamente.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* P1: Data Quality Score — always visible */}
      <WasteDataQuality result={dataQualityResult} isLoading={isLoading} />

      {/* P&L Impact — always visible */}
      <WastePnLImpact
        metrics={metrics}
        wasteTarget={wasteTarget}
        isLoading={isLoading}
      />

      {/* ── ADVANCED+ ── */}
      {showAdvanced && (
        <>
          {/* Phase 4: Variance Analysis + Impact Simulator */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <WasteVarianceAnalysis result={varianceResult} isLoading={isLoading} />
            <WasteImpactSimulator result={simulationResult} isLoading={isLoading} />
          </div>
        </>
      )}

      {/* Alert Banners — always visible */}
      <WasteAlertBanner alerts={alerts} />

      {showAdvanced && (
        <>
          {/* Phase 2: Predictive Forecast + Smart Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <WasteForecastCard
              dailyForecasts={dailyForecasts}
              summary={forecastSummary}
              isReliable={forecastReliable}
              isLoading={isLoading}
            />
            <WasteSmartActions
              metrics={metrics}
              wasteTarget={wasteTarget}
              patterns={patterns}
              forecastSummary={forecastReliable ? forecastSummary : null}
              items={items}
              byReason={byReason}
              isLoading={isLoading}
            />
          </div>

          {/* Phase 2: Prep Optimization */}
          <WastePrepOptimizer result={prepResult} isLoading={isLoading} />

          {/* ME ↔ Waste Cross-Reference */}
          <WasteMECrossRef
            wasteItems={items}
            meItems={meItems}
            isLoading={isLoading || meLoading}
          />

          {/* Phase 4: Waste-Adjusted Recipe Cost */}
          <WasteRecipeCost result={recipeCostResult} isLoading={isLoading || meLoading} />
        </>
      )}

      {/* Charts — always visible in Simple */}
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

      {/* Items Table — always visible */}
      <WasteItemsTable
        items={items}
        totalWastePercent={metrics.wastePercentOfSales}
        isLoading={isLoading}
      />

      {/* Category Donut + Team Score — always visible */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WasteCategoryDonut
          byCategory={byCategory}
          isLoading={isLoading}
        />
        <WasteTeamScore result={teamScoreResult} isLoading={isLoading} />
      </div>

      {/* ── ADVANCED+ ── */}
      {showAdvanced && (
        <>
          <WasteHeatmap
            heatmapData={heatmapData}
            isLoading={isLoading}
          />

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

          <WasteSupplierScore result={supplierResult} isLoading={isLoading} />
          <WasteShelfLifeTracker result={shelfLifeResult} />
        </>
      )}

      {/* ── EXECUTIVE ONLY ── */}
      {showExecutive && (
        <>
          <WasteAnnualReport result={annualReportResult} isLoading={isLoading} />
          <WasteBenchmark result={benchmarkResult} isLoading={isLoading} />
        </>
      )}

      {/* Auto-Actions — always visible (config is lightweight) */}
      <WasteThresholdConfig autoActions={autoActionsResult} wasteTarget={wasteTarget} />

      {/* Upsell banner when in Simple mode */}
      {viewMode === 'simple' && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">¿Quieres más insights?</p>
              <p className="text-xs text-muted-foreground">Cambia a vista "Avanzado" para ver predicciones IA, varianza de coste y optimización de preparación.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => handleViewChange('advanced')} className="flex-shrink-0">
              Ver más →
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
