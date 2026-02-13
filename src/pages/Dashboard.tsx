import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { NarrativeInsightsPanel } from '@/components/dashboard/NarrativeInsightsPanel';
import { TopProductsCard } from '@/components/dashboard/TopProductsCard';
import { LowStockWidget } from '@/components/dashboard/LowStockWidget';
import { OnboardingWizard } from '@/components/onboarding';
import { DollarSign, Percent, Users, Receipt, TrendingUp, Flame } from 'lucide-react';
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
  const { selectedLocationId, getDateRangeValues, customDateRange, needsOnboarding, setOnboardingComplete, dataSource } = useApp();
  const [metrics, setMetrics] = useState<ComparisonMetrics>({
    current: { sales: 0, covers: 0, avgTicket: 0, laborCost: 0, cogsPercent: 30 },
    previous: { sales: 0, covers: 0, avgTicket: 0, laborCost: 0, cogsPercent: 30 }
  });
  const [topItems, setTopItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [selectedLocationId, customDateRange, dataSource]);

  const getPreviousPeriod = (from: Date, to: Date): { from: Date; to: Date } => {
    const periodLength = to.getTime() - from.getTime();
    const previousTo = new Date(from.getTime() - 1); // 1ms before current from
    const previousFrom = new Date(previousTo.getTime() - periodLength);
    return { from: previousFrom, to: previousTo };
  };

  const fetchPeriodMetrics = async (from: Date, to: Date, locationId: string | null): Promise<Metrics> => {
    const fromDate = from.toISOString().split('T')[0];
    const toDate = to.toISOString().split('T')[0];

    // Get sales from pos_daily_finance (aggregated daily data)
    let query = supabase.from('pos_daily_finance').select('gross_sales, net_sales, orders_count').eq('data_source', dataSource);
    if (locationId && locationId !== 'all') {
      query = query.eq('location_id', locationId);
    }
    query = query.gte('date', fromDate).lte('date', toDate);
    const { data: dailyFinance } = await query;

    const sales = dailyFinance?.reduce((sum, d) => sum + (Number(d.gross_sales) || 0), 0) || 0;
    const orders = dailyFinance?.reduce((sum, d) => sum + (Number(d.orders_count) || 0), 0) || 0;
    const avgTicket = orders > 0 ? sales / orders : 0;

    // Get labor cost from labour_daily
    let laborQuery = supabase.from('labour_daily').select('labour_cost');
    if (locationId && locationId !== 'all') {
      laborQuery = laborQuery.eq('location_id', locationId);
    }
    laborQuery = laborQuery.gte('date', fromDate).lte('date', toDate);
    const { data: labourData } = await laborQuery;
    const laborCost = labourData?.reduce((sum, d) => sum + (Number(d.labour_cost) || 0), 0) || 0;

    return { sales, covers: orders, avgTicket, laborCost, cogsPercent: 30 };
  };

  const fetchData = async () => {
    setLoading(true);
    const { from, to } = getDateRangeValues();
    const { from: prevFrom, to: prevTo } = getPreviousPeriod(from, to);
    
    // Fetch current and previous period metrics in parallel
    const [currentMetrics, previousMetrics] = await Promise.all([
      fetchPeriodMetrics(from, to, selectedLocationId),
      fetchPeriodMetrics(prevFrom, prevTo, selectedLocationId)
    ]);

    setMetrics({ current: currentMetrics, previous: previousMetrics });

    // Get top items
    let linesQuery = supabase.from('ticket_lines').select('item_name, category_name, quantity, gross_line_total');
    const { data: lines } = await linesQuery.limit(500);
    
    const itemMap = new Map<string, { name: string; category: string; quantity: number; sales: number }>();
    lines?.forEach(line => {
      const existing = itemMap.get(line.item_name) || { name: line.item_name, category: line.category_name || 'Sin categoría', quantity: 0, sales: 0 };
      existing.quantity += Number(line.quantity) || 0;
      existing.sales += Number(line.gross_line_total) || 0;
      itemMap.set(line.item_name, existing);
    });
    
    const sortedItems = Array.from(itemMap.values()).sort((a, b) => b.sales - a.sales).slice(0, 10);
    setTopItems(sortedItems.map((item, i) => ({ rank: i + 1, ...item, margin: Math.floor(55 + Math.random() * 20) })));

    setLoading(false);
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
          title="COGS" 
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
