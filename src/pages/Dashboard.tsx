import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { AlertsPanel, Alert } from '@/components/dashboard/AlertsPanel';
import { TopProductsCard } from '@/components/dashboard/TopProductsCard';
import { LowStockWidget } from '@/components/dashboard/LowStockWidget';
import { HourlyLaborChart } from '@/components/dashboard/Charts';
import { HourlyForecastChart } from '@/components/dashboard/HourlyForecastChart';
import { ForecastConfidencePanel } from '@/components/dashboard/ForecastConfidencePanel';
import { CategoryBreakdownChart } from '@/components/dashboard/CategoryBreakdownChart';
import { OnboardingWizard } from '@/components/onboarding';
import { useHourlyForecast, useGenerateForecast } from '@/hooks/useHourlyForecast';
import { DollarSign, Percent, Users, Receipt, TrendingUp, Flame } from 'lucide-react';
import { toast } from 'sonner';

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
  const { selectedLocationId, getDateRangeValues, customDateRange, needsOnboarding, setOnboardingComplete } = useApp();
  const [metrics, setMetrics] = useState<ComparisonMetrics>({
    current: { sales: 0, covers: 0, avgTicket: 0, laborCost: 0, cogsPercent: 30 },
    previous: { sales: 0, covers: 0, avgTicket: 0, laborCost: 0, cogsPercent: 30 }
  });
  const [topItems, setTopItems] = useState<any[]>([]);
  const [hourlyLabor, setHourlyLabor] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // AI Forecast hooks
  const { from: dateFrom } = getDateRangeValues();
  const { data: hourlyForecasts, isLoading: forecastLoading } = useHourlyForecast(selectedLocationId, dateFrom);
  const generateForecast = useGenerateForecast();

  const alerts: Alert[] = [
    { id: '1', type: 'warning', title: 'Labor alto', description: 'COL% por encima del objetivo en La Taberna Centro', metric: '28%', trend: 'up' },
    { id: '2', type: 'error', title: 'Margen bajo', description: 'GP% cayendo en los últimos 7 días', metric: '-3%', trend: 'down' },
    { id: '3', type: 'warning', title: 'Waste elevado', description: '€120 de waste ayer en Malasaña', metric: '€120' },
    { id: '4', type: 'info', title: 'Comps/Voids', description: '2.1% de líneas anuladas hoy', metric: '2.1%' },
    { id: '5', type: 'warning', title: 'Forecast desviación', description: 'Ventas 15% por debajo del forecast', metric: '-15%', trend: 'down' },
  ];

  useEffect(() => {
    fetchData();
  }, [selectedLocationId, customDateRange]);

  const getPreviousPeriod = (from: Date, to: Date): { from: Date; to: Date } => {
    const periodLength = to.getTime() - from.getTime();
    const previousTo = new Date(from.getTime() - 1); // 1ms before current from
    const previousFrom = new Date(previousTo.getTime() - periodLength);
    return { from: previousFrom, to: previousTo };
  };

  const fetchPeriodMetrics = async (from: Date, to: Date, locationId: string | null): Promise<Metrics> => {
    let query = supabase.from('tickets').select('gross_total, covers').eq('status', 'closed');
    if (locationId && locationId !== 'all') {
      query = query.eq('location_id', locationId);
    }
    query = query.gte('closed_at', from.toISOString()).lte('closed_at', to.toISOString());
    
    const { data: tickets } = await query;
    
    const sales = tickets?.reduce((sum, t) => sum + (Number(t.gross_total) || 0), 0) || 0;
    const covers = tickets?.reduce((sum, t) => sum + (t.covers || 0), 0) || 0;
    const avgTicket = tickets?.length ? sales / tickets.length : 0;

    // Get labor cost
    let laborQuery = supabase.from('timesheets').select('labor_cost');
    if (locationId && locationId !== 'all') {
      laborQuery = laborQuery.eq('location_id', locationId);
    }
    laborQuery = laborQuery.gte('clock_in', from.toISOString()).lte('clock_in', to.toISOString());
    const { data: timesheets } = await laborQuery;
    const laborCost = timesheets?.reduce((sum, t) => sum + (Number(t.labor_cost) || 0), 0) || 0;

    return { sales, covers, avgTicket, laborCost, cogsPercent: 30 };
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

    // Mock hourly labor data
    const hours = Array.from({ length: 14 }, (_, i) => ({ hour: `${10 + i}:00`, real: Math.random() * 80 + 20, recommended: Math.random() * 60 + 30 }));
    setHourlyLabor(hours);

    setLoading(false);
  };

  const handleRefreshForecast = async () => {
    if (!selectedLocationId || selectedLocationId === 'all') {
      toast.error('Selecciona una ubicación específica');
      return;
    }
    try {
      await generateForecast.mutateAsync({ locationId: selectedLocationId });
      toast.success('Forecast generado correctamente');
    } catch (error) {
      toast.error('Error generando forecast');
      console.error(error);
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

      {/* Charts */}
      <div className="grid lg:grid-cols-4 gap-6">
        <HourlyForecastChart 
          data={hourlyForecasts || []} 
          isLoading={forecastLoading}
          onRefresh={handleRefreshForecast}
          isRefreshing={generateForecast.isPending}
          className="lg:col-span-2" 
        />
        <ForecastConfidencePanel 
          forecasts={hourlyForecasts || []} 
          className="lg:col-span-1"
        />
        <CategoryBreakdownChart />
      </div>

      {/* Labor Chart */}
      <HourlyLaborChart data={hourlyLabor} title="Labor por Hora (Real vs Recomendado)" />

      {/* Top 10 Products - full width */}
      <TopProductsCard />

      {/* Alerts and Low Stock */}
      <div className="grid lg:grid-cols-2 gap-6">
        <AlertsPanel alerts={alerts} />
        <LowStockWidget />
      </div>
    </div>
  );
}
