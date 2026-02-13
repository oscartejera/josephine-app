import { useMemo, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { HonestKpiCard } from '@/components/dashboard/HonestKpiCard';
import { DateRangeSelector } from '@/components/dashboard/DateRangeSelector';
import { NarrativeInsightsPanel } from '@/components/dashboard/NarrativeInsightsPanel';
import { TopProductsCard } from '@/components/dashboard/TopProductsCard';
import { LowStockWidget } from '@/components/dashboard/LowStockWidget';
import { OnboardingWizard } from '@/components/onboarding';
import { DollarSign, Percent, Users, Receipt, TrendingUp, Flame, UtensilsCrossed } from 'lucide-react';
import {
  useDashboardMetrics,
  presetToDateRange,
  type DateRangePreset,
} from '@/hooks/useDashboardMetrics';
import type { DashboardMetricsForAI } from '@/hooks/useAINarratives';

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

const fmtEur = (v: number) => `€${v.toLocaleString('es-ES', { maximumFractionDigits: 0 })}`;
const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const fmtNum = (v: number) => v.toLocaleString('es-ES', { maximumFractionDigits: 0 });
const fmtEur2 = (v: number) => `€${v.toFixed(2)}`;

// ---------------------------------------------------------------------------
// Period labels
// ---------------------------------------------------------------------------

const periodLabels: Record<DateRangePreset, string> = {
  today: 'hoy vs ayer',
  '7d': 'últimos 7 días vs 7 días anteriores',
  '30d': 'últimos 30 días vs 30 días anteriores',
  custom: 'periodo actual vs anterior',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const {
    selectedLocationId,
    needsOnboarding,
    setOnboardingComplete,
    dataSource,
  } = useApp();

  // Local date range state (decoupled from AppContext to keep it Dashboard-only)
  const [preset, setPreset] = useState<DateRangePreset>('today');
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date } | null>(null);

  const dateRange = useMemo(
    () => presetToDateRange(preset, customRange ?? undefined),
    [preset, customRange],
  );

  const { data, isLoading } = useDashboardMetrics({
    locationId: selectedLocationId,
    dateRange,
    dataSource,
  });

  const current = data?.current;
  const previous = data?.previous;

  // Build metrics for AI narrative panel
  const narrativeMetrics: DashboardMetricsForAI | null = useMemo(() => {
    if (!current || isLoading) return null;
    if (!current.sales.available) return null;

    const val = (kpi: typeof current.sales) => (kpi.available ? kpi.value : 0);

    const sales = val(current.sales);
    const prevSales = previous ? val(previous.sales) : 0;
    const laborCost = val(current.labor);
    const prevLabor = previous ? val(previous.labor) : 0;
    const covers = val(current.covers);
    const prevCovers = previous ? val(previous.covers) : 0;
    const avgTicket = val(current.avgTicket);
    const prevAvgTicket = previous ? val(previous.avgTicket) : 0;
    const cogsPercent = current.cogs.available && sales > 0
      ? (current.cogs.value / sales) * 100
      : 0;
    const prevCogsPercent = previous?.cogs.available && prevSales > 0
      ? (previous.cogs.value / prevSales) * 100
      : 0;
    const gpPercent = val(current.gpPercent);
    const prevGpPercent = previous ? val(previous.gpPercent) : 0;
    const colPercent = val(current.colPercent);
    const prevColPercent = previous ? val(previous.colPercent) : 0;

    const delta = (c: number, p: number) => (p === 0 ? 0 : Math.round(((c - p) / p) * 1000) / 10);

    return {
      sales,
      salesDelta: delta(sales, prevSales),
      covers,
      coversDelta: delta(covers, prevCovers),
      avgTicket,
      avgTicketDelta: delta(avgTicket, prevAvgTicket),
      laborCost,
      laborDelta: delta(laborCost, prevLabor),
      colPercent,
      colDelta: delta(colPercent, prevColPercent),
      cogsPercent,
      cogsDelta: delta(cogsPercent, prevCogsPercent),
      gpPercent,
      gpDelta: delta(gpPercent, prevGpPercent),
      locationName: selectedLocationId === 'all' ? 'Todos los locales' : 'Local seleccionado',
      periodLabel: periodLabels[preset],
      topProducts: [],
    };
  }, [current, previous, isLoading, selectedLocationId, preset]);

  if (needsOnboarding) {
    return <OnboardingWizard onComplete={setOnboardingComplete} />;
  }

  const subtitleLabel = preset === 'today' ? 'Resumen de operaciones de hoy' : `Resumen: ${periodLabels[preset]}`;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header + Date Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Dashboard</h1>
          <p className="text-muted-foreground">{subtitleLabel}</p>
        </div>
        <DateRangeSelector
          value={preset}
          customRange={customRange}
          onChange={setPreset}
          onCustomChange={setCustomRange}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <HonestKpiCard
          title="Ventas"
          kpi={current?.sales ?? { available: false, reason: 'Cargando…' }}
          previousKpi={previous?.sales}
          format={fmtEur}
          icon={DollarSign}
          variant="success"
          loading={isLoading}
        />
        <HonestKpiCard
          title="GP%"
          kpi={current?.gpPercent ?? { available: false, reason: 'Cargando…' }}
          previousKpi={previous?.gpPercent}
          format={fmtPct}
          icon={Percent}
          variant={current?.gpPercent.available && current.gpPercent.value >= 65 ? 'success' : 'warning'}
          loading={isLoading}
        />
        <HonestKpiCard
          title="COGS"
          kpi={current?.cogs ?? { available: false, reason: 'Cargando…' }}
          previousKpi={previous?.cogs}
          format={fmtEur}
          icon={Receipt}
          invertDelta
          loading={isLoading}
        />
        <HonestKpiCard
          title="Labor"
          kpi={current?.labor ?? { available: false, reason: 'Cargando…' }}
          previousKpi={previous?.labor}
          format={fmtEur}
          icon={Users}
          invertDelta
          loading={isLoading}
        />
        <HonestKpiCard
          title="COL%"
          kpi={current?.colPercent ?? { available: false, reason: 'Cargando…' }}
          previousKpi={previous?.colPercent}
          format={fmtPct}
          icon={TrendingUp}
          variant={current?.colPercent.available && current.colPercent.value <= 25 ? 'success' : 'warning'}
          invertDelta
          loading={isLoading}
        />
        <HonestKpiCard
          title="Covers"
          kpi={current?.covers ?? { available: false, reason: 'Cargando…' }}
          previousKpi={previous?.covers}
          format={fmtNum}
          icon={UtensilsCrossed}
          loading={isLoading}
        />
        <HonestKpiCard
          title="Avg Ticket"
          kpi={current?.avgTicket ?? { available: false, reason: 'Cargando…' }}
          previousKpi={previous?.avgTicket}
          format={fmtEur2}
          icon={Flame}
          loading={isLoading}
        />
      </div>

      {/* Top 10 Products */}
      <TopProductsCard dateRange={dateRange} />

      {/* AI Narrative and Low Stock */}
      <div className="grid lg:grid-cols-2 gap-6">
        <NarrativeInsightsPanel metrics={narrativeMetrics} />
        <LowStockWidget />
      </div>
    </div>
  );
}
