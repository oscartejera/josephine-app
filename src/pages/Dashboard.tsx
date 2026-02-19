import { useEffect, useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { getDashboardKpis, getProductSalesDaily, buildQueryContext, type DashboardKpis, EMPTY_DASHBOARD_KPIS } from '@/data';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { NarrativeInsightsPanel } from '@/components/dashboard/NarrativeInsightsPanel';
import { TopProductsCard } from '@/components/dashboard/TopProductsCard';
import { LowStockWidget } from '@/components/dashboard/LowStockWidget';
import { OnboardingWizard } from '@/components/onboarding';
import { DollarSign, Percent, Users, Receipt, TrendingUp, Flame, MapPin, AlertCircle } from 'lucide-react';
import { EstimatedLabel } from '@/components/ui/EstimatedLabel';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardMetricsForAI } from '@/hooks/useAINarratives';

interface Metrics {
  sales: number;
  covers: number;
  avgTicket: number;
  laborCost: number;
  cogsPercent: number;
}

interface ComparisonMetrics {
  current: Metrics;
  previous: Metrics;
}

function calculateDelta(current: number, previous: number): { value: number; positive: boolean } | undefined {
  if (previous === 0) return current > 0 ? { value: 100, positive: true } : undefined;
  const delta = ((current - previous) / previous) * 100;
  return { value: Math.round(delta * 10) / 10, positive: delta >= 0 };
}

export default function Dashboard() {
  const { selectedLocationId, accessibleLocations, getDateRangeValues, customDateRange, needsOnboarding, setOnboardingComplete, dataSource, loading: appLoading } = useApp();
  const { profile } = useAuth();
  const [metrics, setMetrics] = useState<ComparisonMetrics>({
    current: { sales: 0, covers: 0, avgTicket: 0, laborCost: 0, cogsPercent: 30 },
    previous: { sales: 0, covers: 0, avgTicket: 0, laborCost: 0, cogsPercent: 30 }
  });
  const [topItems, setTopItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Build location IDs from selection
  const locationIds = useMemo(() => {
    if (!selectedLocationId || selectedLocationId === 'all') {
      return accessibleLocations.map(l => l.id);
    }
    return [selectedLocationId];
  }, [selectedLocationId, accessibleLocations]);

  useEffect(() => {
    fetchData();
  }, [selectedLocationId, customDateRange, dataSource, profile?.group_id]);

  const getPreviousPeriod = (from: Date, to: Date): { from: Date; to: Date } => {
    const periodLength = to.getTime() - from.getTime();
    const previousTo = new Date(from.getTime() - 1);
    const previousFrom = new Date(previousTo.getTime() - periodLength);
    return { from: previousFrom, to: previousTo };
  };

  const fetchPeriodMetrics = async (from: Date, to: Date): Promise<Metrics> => {
    const orgId = profile?.group_id;
    if (!orgId || locationIds.length === 0) {
      return { sales: 0, covers: 0, avgTicket: 0, laborCost: 0, cogsPercent: 30 };
    }

    const ctx = buildQueryContext(orgId, locationIds, dataSource);
    const range = {
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0],
    };

    const kpis = await getDashboardKpis(ctx, range);

    return {
      sales: kpis.grossSales,
      covers: kpis.ordersCount,
      avgTicket: kpis.avgCheck,
      laborCost: kpis.laborCost,
      cogsPercent: 30,
    };
  };

  const fetchData = async () => {
    if (!profile?.group_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setFetchError(null);

    try {
      const { from, to } = getDateRangeValues();
      const { from: prevFrom, to: prevTo } = getPreviousPeriod(from, to);

      // Fetch current and previous period metrics in parallel
      const [currentMetrics, previousMetrics] = await Promise.all([
        fetchPeriodMetrics(from, to),
        fetchPeriodMetrics(prevFrom, prevTo)
      ]);

      setMetrics({ current: currentMetrics, previous: previousMetrics });

      // Top items from product_sales_daily_unified contract view
      const orgId = profile?.group_id;
      if (orgId) {
        const ctx = buildQueryContext(orgId, locationIds, dataSource);
        const range = { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] };
        const productRows = await getProductSalesDaily(ctx, range);

        const itemMap = new Map<string, { name: string; category: string; quantity: number; sales: number; margin: number }>();
        productRows.forEach(row => {
          const existing = itemMap.get(row.productId) || { name: row.productName, category: row.productCategory || 'Sin categoría', quantity: 0, sales: 0, margin: 0 };
          existing.quantity += row.unitsSold;
          existing.sales += row.netSales;
          existing.margin = row.marginPct;
          itemMap.set(row.productId, existing);
        });

        const sortedItems = Array.from(itemMap.values()).sort((a, b) => b.sales - a.sales).slice(0, 10);
        setTopItems(sortedItems.map((item, i) => ({ rank: i + 1, ...item })));
      }
    } catch (err) {
      console.error('[Dashboard] fetchData error:', err);
      setFetchError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const current = metrics.current;
  const previous = metrics.previous;
  
  const gpPercent = 100 - current.cogsPercent;
  const prevGpPercent = 100 - previous.cogsPercent;
  const colPercent = current.sales > 0 ? (current.laborCost / current.sales) * 100 : 0;
  const prevColPercent = previous.sales > 0 ? (previous.laborCost / previous.sales) * 100 : 0;
  const currentCogs = current.sales * current.cogsPercent / 100;
  const prevCogs = previous.sales * previous.cogsPercent / 100;

  // Calculate deltas
  const salesDelta = calculateDelta(current.sales, previous.sales);
  const gpDelta = calculateDelta(gpPercent, prevGpPercent);
  const cogsDelta = calculateDelta(currentCogs, prevCogs);
  const laborDelta = calculateDelta(current.laborCost, previous.laborCost);
  // For COL%, lower is better, so invert the positive flag
  const colDelta = calculateDelta(colPercent, prevColPercent);
  if (colDelta) colDelta.positive = !colDelta.positive;
  const coversDelta = calculateDelta(current.covers, previous.covers);
  const avgTicketDelta = calculateDelta(current.avgTicket, previous.avgTicket);

  // Build metrics object for AI narrative
  const selectedLocName = selectedLocationId === 'all' ? 'Todos los locales' : 'Local seleccionado';
  const narrativeMetrics: DashboardMetricsForAI | null = useMemo(() => {
    if (loading || current.sales === 0) return null;
    return {
      sales: current.sales,
      salesDelta: salesDelta?.value || 0,
      covers: current.covers,
      coversDelta: coversDelta?.value || 0,
      avgTicket: current.avgTicket,
      avgTicketDelta: avgTicketDelta?.value || 0,
      laborCost: current.laborCost,
      laborDelta: laborDelta?.value || 0,
      colPercent,
      colDelta: colDelta?.value || 0,
      cogsPercent: current.cogsPercent,
      cogsDelta: cogsDelta?.value || 0,
      gpPercent,
      gpDelta: gpDelta?.value || 0,
      locationName: selectedLocName,
      periodLabel: 'periodo actual vs anterior',
      topProducts: topItems.map(item => ({ name: item.name, sales: item.sales, margin: item.margin })),
    };
  }, [loading, current, salesDelta, coversDelta, avgTicketDelta, laborDelta, colPercent, colDelta, gpPercent, gpDelta, topItems, selectedLocName]);

  // Show onboarding wizard for new users
  if (needsOnboarding) {
    return <OnboardingWizard onComplete={setOnboardingComplete} />;
  }

  // Show loading skeleton while app context is initializing
  if (appLoading || (loading && !fetchError)) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-display font-bold">Dashboard</h1>
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

  // Show error fallback if data fetch failed
  if (fetchError) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-display font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Resumen de operaciones de hoy</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-10 w-10 text-destructive mb-3" />
            <p className="text-lg font-medium">Error al cargar el dashboard</p>
            <p className="text-sm text-muted-foreground mt-1">{fetchError}</p>
            <Button variant="outline" className="mt-4" onClick={() => fetchData()}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show CTA if no locations are configured
  if (!appLoading && accessibleLocations.length === 0 && profile?.group_id) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-display font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Resumen de operaciones de hoy</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MapPin className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-lg font-medium">No hay locales configurados</p>
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
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Resumen de operaciones de hoy</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <MetricCard 
          title="Ventas" 
          value={`€${current.sales.toLocaleString('es-ES', { maximumFractionDigits: 0 })}`} 
          icon={DollarSign} 
          variant="success"
          trend={salesDelta ? { value: salesDelta.value, positive: salesDelta.positive, label: 'vs anterior' } : undefined}
        />
        <MetricCard 
          title="GP%" 
          value={`${gpPercent.toFixed(1)}%`} 
          icon={Percent} 
          variant={gpPercent >= 65 ? 'success' : 'warning'}
          trend={gpDelta ? { value: gpDelta.value, positive: gpDelta.positive, label: 'vs anterior' } : undefined}
        />
        <MetricCard
          title={<span className="flex items-center gap-1">COGS <EstimatedLabel reason="COGS calculado con ratio fijo (30%). Conecta inventario para datos reales." /></span>}
          value={`€${currentCogs.toLocaleString('es-ES', { maximumFractionDigits: 0 })}`}
          icon={Receipt}
          trend={cogsDelta ? { value: cogsDelta.value, positive: !cogsDelta.positive, label: 'vs anterior' } : undefined}
        />
        <MetricCard 
          title="Labor" 
          value={`€${current.laborCost.toLocaleString('es-ES', { maximumFractionDigits: 0 })}`} 
          icon={Users}
          trend={laborDelta ? { value: laborDelta.value, positive: !laborDelta.positive, label: 'vs anterior' } : undefined}
        />
        <MetricCard 
          title="COL%" 
          value={`${colPercent.toFixed(1)}%`} 
          icon={TrendingUp} 
          variant={colPercent <= 25 ? 'success' : 'warning'}
          trend={colDelta ? { value: Math.abs(colDelta.value), positive: colDelta.positive, label: 'vs anterior' } : undefined}
        />
        <MetricCard 
          title="Covers" 
          value={current.covers} 
          icon={Users}
          trend={coversDelta ? { value: coversDelta.value, positive: coversDelta.positive, label: 'vs anterior' } : undefined}
        />
        <MetricCard 
          title="Avg Ticket" 
          value={`€${current.avgTicket.toFixed(2)}`} 
          icon={Flame}
          trend={avgTicketDelta ? { value: avgTicketDelta.value, positive: avgTicketDelta.positive, label: 'vs anterior' } : undefined}
        />
      </div>

      {/* Top 10 Products - full width */}
      <TopProductsCard />

      {/* AI Narrative and Low Stock */}
      <div className="grid lg:grid-cols-2 gap-6">
        <NarrativeInsightsPanel metrics={narrativeMetrics} />
        <LowStockWidget />
      </div>
    </div>
  );
}
