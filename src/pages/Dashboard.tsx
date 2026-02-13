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
import { useTopProductsHonest } from '@/hooks/useTopProductsHonest';
import { useLowStockAlerts } from '@/hooks/useLowStockAlerts';
import type { LowStockItem } from '@/lib/buildDashboardInsights';

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

  const current = data?.current ?? null;
  const previous = data?.previous ?? null;

  // Top products for insights engine (reuses same query as TopProductsCard when metric=share)
  const { data: topProducts } = useTopProductsHonest({ dateRange, metric: 'share' });

  // Low stock alerts (RPC-based, only when single location selected)
  const { data: lowStockAlerts } = useLowStockAlerts(selectedLocationId);

  // Map low stock alerts to the LowStockItem shape for insights engine
  const lowStockItems: LowStockItem[] | null = lowStockAlerts
    ? lowStockAlerts.map(a => ({
        name: a.name,
        percentOfPar: a.reorder_point > 0
          ? (a.on_hand / a.reorder_point) * 100
          : null,
      }))
    : null;

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

      {/* Josephine Insights and Low Stock */}
      <div className="grid lg:grid-cols-2 gap-6">
        <NarrativeInsightsPanel
          kpis={current}
          previousKpis={previous}
          topProducts={topProducts ?? null}
          lowStockItems={lowStockItems}
          loading={isLoading}
        />
        <LowStockWidget locationId={selectedLocationId} />
      </div>
    </div>
  );
}
