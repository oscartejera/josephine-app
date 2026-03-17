import { useEffect, useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { JosephineChat } from '@/components/ai/JosephineChat';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { getProductSalesDaily, buildQueryContext } from '@/data';
import { useKpiSummary } from '@/hooks/useKpiSummary';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { NarrativeInsightsPanel } from '@/components/dashboard/NarrativeInsightsPanel';
import { TopProductsCard } from '@/components/dashboard/TopProductsCard';
import { LowStockWidget } from '@/components/dashboard/LowStockWidget';
import { ExecutiveBriefing } from '@/components/dashboard/ExecutiveBriefing';
import { LocationHealthIndicators } from '@/components/dashboard/LocationHealthIndicators';
import { OnboardingWizard } from '@/components/onboarding';
import { OnboardingChecklist } from '@/components/onboarding/OnboardingChecklist';
import { AIImpactCard } from '@/components/forecast/AIImpactCard';
import { ForecastConfidenceBadge } from '@/components/forecast/ForecastConfidenceBadge';
import { FoodCostVarianceCard } from '@/components/dashboard/FoodCostVarianceCard';
import { LocationBenchmark } from '@/components/dashboard/LocationBenchmark';
import { DashboardTour } from '@/pages/OnboardingWizardV2';
import { DollarSign, Percent, Users, Receipt, TrendingUp, Flame, MapPin, AlertCircle, Bot } from 'lucide-react';
import { EstimatedLabel } from '@/components/ui/EstimatedLabel';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardMetricsForAI } from '@/hooks/useAINarratives';

function calculateDelta(current: number, previous: number): { value: number; positive: boolean } | undefined {
  if (previous === 0) return current > 0 ? { value: 100, positive: true } : undefined;
  const delta = ((current - previous) / previous) * 100;
  return { value: Math.round(delta * 10) / 10, positive: delta >= 0 };
}

export default function Dashboard() {
  const { selectedLocationId, accessibleLocations, getDateRangeValues, customDateRange, needsOnboarding, setOnboardingComplete, dataSource, loading: appLoading } = useApp();
  const { profile } = useAuth();
  const [topItems, setTopItems] = useState<any[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const { t } = useTranslation();

  // Build location IDs from selection
  const locationIds = useMemo(() => {
    if (!selectedLocationId || selectedLocationId === 'all') {
      return accessibleLocations.map(l => l.id);
    }
    return [selectedLocationId];
  }, [selectedLocationId, accessibleLocations]);

  // Get date range as ISO strings
  const { from: dateFrom, to: dateTo } = getDateRangeValues();
  const fromStr = dateFrom?.toISOString().split('T')[0] || '';
  const toStr = dateTo?.toISOString().split('T')[0] || '';

  // Single RPC call for all KPIs + previous period
  const { data: kpi, isLoading: kpiLoading, isError, error: kpiError, refetch } = useKpiSummary(fromStr, toStr);

  // Fetch top items (product breakdown still separate)
  useEffect(() => {
    const orgId = profile?.group_id;
    if (!orgId || locationIds.length === 0 || !fromStr || !toStr) return;

    const ctx = buildQueryContext(orgId, locationIds, dataSource);
    getProductSalesDaily(ctx, { from: fromStr, to: toStr }).then(productRows => {
      const itemMap = new Map<string, { name: string; category: string; quantity: number; sales: number; margin: number }>();
      productRows.forEach(row => {
        const existing = itemMap.get(row.productId) || { name: row.productName, category: row.productCategory || t('common.noData'), quantity: 0, sales: 0, margin: 0 };
        existing.quantity += row.unitsSold;
        existing.sales += row.netSales;
        existing.margin = row.marginPct;
        itemMap.set(row.productId, existing);
      });
      const sortedItems = Array.from(itemMap.values()).sort((a, b) => b.sales - a.sales).slice(0, 10);
      setTopItems(sortedItems.map((item, i) => ({ rank: i + 1, ...item })));
    }).catch(err => console.error('[Dashboard] top items error:', err));
  }, [profile?.group_id, locationIds, dataSource, fromStr, toStr]);

  // Derive KPI values from RPC result
  const current = kpi?.current;
  const previous = kpi?.previous;

  const netSales = current?.net_sales ?? 0;
  const prevNetSales = previous?.net_sales ?? 0;
  const ordersCount = current?.orders_count ?? 0;
  const avgCheck = current?.avg_check ?? 0;
  const prevAvgCheck = previous?.avg_check ?? 0;
  const labourCost = current?.labour_cost ?? 0;
  const prevLabourCost = previous?.labour_cost ?? 0;
  const cogs = current?.cogs ?? 0;
  const prevCogs = previous?.cogs ?? 0;
  const gpPercent = current?.gp_percent ?? 0;
  const prevGpPercent = previous?.gp_percent ?? 0;
  const colPercent = current?.col_percent ?? 0;
  const prevColPercent = previous?.col_percent ?? 0;
  const cogsSourceMixed = current?.cogs_source_mixed ?? true;
  const labourSourceMixed = current?.labour_source_mixed ?? true;

  // Calculate deltas from real previous period data
  const salesDelta = calculateDelta(netSales, prevNetSales);
  const gpDelta = calculateDelta(gpPercent, prevGpPercent);
  const cogsDelta = calculateDelta(cogs, prevCogs);
  const laborDelta = calculateDelta(labourCost, prevLabourCost);
  const colDelta = calculateDelta(colPercent, prevColPercent);
  if (colDelta) colDelta.positive = !colDelta.positive;
  const coversDelta = calculateDelta(ordersCount, previous?.orders_count ?? 0);
  const avgTicketDelta = calculateDelta(avgCheck, prevAvgCheck);

  // Build metrics object for AI narrative
  const loading = kpiLoading;
  const selectedLocName = selectedLocationId === 'all' ? 'Todos los locales' : 'Local seleccionado';
  const narrativeMetrics: DashboardMetricsForAI | null = useMemo(() => {
    if (loading || netSales === 0) return null;
    return {
      sales: netSales,
      salesDelta: salesDelta?.value || 0,
      covers: ordersCount,
      coversDelta: coversDelta?.value || 0,
      avgTicket: avgCheck,
      avgTicketDelta: avgTicketDelta?.value || 0,
      laborCost: labourCost,
      laborDelta: laborDelta?.value || 0,
      colPercent,
      colDelta: colDelta?.value || 0,
      cogsPercent: netSales > 0 ? (cogs / netSales) * 100 : 0,
      cogsDelta: cogsDelta?.value || 0,
      gpPercent,
      gpDelta: gpDelta?.value || 0,
      locationName: selectedLocName,
      periodLabel: 'actual vs forecast',
      topProducts: topItems.map(item => ({ name: item.name, sales: item.sales, margin: item.margin })),
    };
  }, [loading, netSales, salesDelta, coversDelta, avgTicketDelta, laborDelta, colPercent, colDelta, gpPercent, gpDelta, topItems, selectedLocName]);

  // Redirect new users to the fullscreen onboarding wizard
  if (needsOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  // Show loading skeleton while app context is initializing
  if (appLoading || (loading && !isError)) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-display font-bold">{t('nav.controlTower')}</h1>
          <p className="text-muted-foreground">Resumen de operaciones de hoy</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  // KPI error is now non-blocking — show inline warning instead of full-page error
  const kpiHasError = isError;

  // Onboarding checklist for returning users
  const showChecklist = !needsOnboarding && !appLoading;

  // Show CTA if no locations are configured
  if (!appLoading && accessibleLocations.length === 0 && profile?.group_id) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-display font-bold">{t('nav.controlTower')}</h1>
          <p className="text-muted-foreground">Resumen de operaciones de hoy</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MapPin className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-lg font-medium">{t("dashboard.noLocations")}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Crea tu primer local para empezar a ver datos en el dashboard.
            </p>
            <Button className="mt-4" onClick={() => window.location.href = '/settings'}>
              Configurar local
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-display font-bold">{t('nav.controlTower')}</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            Panel ejecutivo — Josephine Intelligence
            <ForecastConfidenceBadge compact />
          </p>
        </div>

        {/* Onboarding Checklist for users who haven't completed setup */}
        {showChecklist && <OnboardingChecklist />}

        {/* Executive Briefing — AI Morning Summary */}
        <ExecutiveBriefing />

        {/* Inline KPI error warning (non-blocking) */}
        {kpiHasError && (
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50">
            <CardContent className="flex items-center gap-3 py-3">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">KPIs temporalmente no disponibles</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">{kpiError instanceof Error ? kpiError.message : 'Error al cargar indicadores'}</p>
              </div>
              <Button variant="outline" size="sm" className="shrink-0" onClick={() => refetch()}>
                Reintentar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* KPI Cards */}
        <div data-tour="kpi-cards" className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {[
            <MetricCard
              key="sales"
              title={t('dashboard.netSales')}
              value={`€${netSales.toLocaleString('es-ES', { maximumFractionDigits: 0 })}`}
              icon={DollarSign}
              variant="success"
              trend={salesDelta ? { value: salesDelta.value, positive: salesDelta.positive, label: t('common.vsForecast') } : undefined}
            />,
            <MetricCard
              key="gp"
              title="GP%"
              value={gpPercent != null ? `${Number(gpPercent).toFixed(1)}%` : '—'}
              icon={Percent}
              variant={gpPercent != null && gpPercent >= 65 ? 'success' : 'warning'}
              trend={gpDelta ? { value: gpDelta.value, positive: gpDelta.positive, label: t('common.vsForecast') } : undefined}
            />,
            <MetricCard
              key="cogs"
              title={<span className="flex items-center gap-1">COGS {cogsSourceMixed && <EstimatedLabel reason="COGS parcialmente estimado. Conecta inventario o recetas para datos reales." />}</span>}
              value={`€${cogs.toLocaleString('es-ES', { maximumFractionDigits: 0 })}`}
              icon={Receipt}
              trend={cogsDelta ? { value: cogsDelta.value, positive: !cogsDelta.positive, label: t('common.vsForecast') } : undefined}
            />,
            <MetricCard
              key="labor"
              title={<span className="flex items-center gap-1">Labor {labourSourceMixed && <EstimatedLabel reason={t("dashboard.labourPartiallyEstimated")} />}</span>}
              value={`€${labourCost.toLocaleString('es-ES', { maximumFractionDigits: 0 })}`}
              icon={Users}
              trend={laborDelta ? { value: laborDelta.value, positive: !laborDelta.positive, label: t('common.vsForecast') } : undefined}
            />,
            <MetricCard
              key="col"
              title="COL%"
              value={colPercent != null ? `${Number(colPercent).toFixed(1)}%` : '—'}
              icon={TrendingUp}
              variant={colPercent != null && colPercent <= 25 ? 'success' : 'warning'}
              trend={colDelta ? { value: Math.abs(colDelta.value), positive: colDelta.positive, label: t('common.vsForecast') } : undefined}
            />,
            <MetricCard
              key="covers"
              title={t('dashboard.covers')}
              value={ordersCount}
              icon={Users}
              trend={coversDelta ? { value: coversDelta.value, positive: coversDelta.positive, label: t('common.vsForecast') } : undefined}
            />,
            <MetricCard
              key="ticket"
              title={t('dashboard.avgTicket')}
              value={`€${Number(avgCheck).toFixed(2)}`}
              icon={Flame}
              trend={avgTicketDelta ? { value: avgTicketDelta.value, positive: avgTicketDelta.positive, label: t('common.vsForecast') } : undefined}
            />,
          ].map((card, i) => (
            <div key={i} className="animate-slide-up" style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'backwards' }}>
              {card}
            </div>
          ))}
        </div>

        {/* Top 10 Products - full width */}
        <TopProductsCard />

        {/* AI Narrative, Health Indicators, and Low Stock */}
        <div className="grid lg:grid-cols-3 gap-6">
          <NarrativeInsightsPanel metrics={narrativeMetrics} />
          <AIImpactCard />
          <div className="space-y-6">
            <LocationHealthIndicators />
            <FoodCostVarianceCard />
            <LowStockWidget />
          </div>
        </div>

        {/* Multi-location benchmarking — only for owners with 2+ locations */}
        <LocationBenchmark />
      </div>

      {/* Josephine AI Chat — Floating Panel */}
      {chatOpen && (
        <div className={`fixed z-50 ${chatExpanded ? 'inset-4' : 'bottom-20 right-4 w-[380px]'} transition-all`}>
          <JosephineChat
            isExpanded={chatExpanded}
            onToggleExpand={() => setChatExpanded(!chatExpanded)}
            onClose={() => { setChatOpen(false); setChatExpanded(false); }}
          />
        </div>
      )}

      {/* Floating AI button */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
          title="Josephine AI"
        >
          <Bot className="h-6 w-6" />
        </button>
      )}
      {/* Product Tour (react-joyride) */}
      <DashboardTour />
    </>
  );
}
