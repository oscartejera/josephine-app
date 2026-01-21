import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { AlertsPanel, Alert } from '@/components/dashboard/AlertsPanel';
import { TopProductsCard } from '@/components/dashboard/TopProductsCard';
import { LowStockWidget } from '@/components/dashboard/LowStockWidget';
import { HourlySalesChart, HourlyLaborChart } from '@/components/dashboard/Charts';
import { DollarSign, Percent, Users, Receipt, TrendingUp, Flame } from 'lucide-react';

export default function Dashboard() {
  const { selectedLocationId, getDateRangeValues } = useApp();
  const [metrics, setMetrics] = useState({ sales: 0, covers: 0, avgTicket: 0, laborCost: 0, cogsPercent: 30 });
  const [topItems, setTopItems] = useState<any[]>([]);
  const [hourlySales, setHourlySales] = useState<any[]>([]);
  const [hourlyLabor, setHourlyLabor] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const alerts: Alert[] = [
    { id: '1', type: 'warning', title: 'Labor alto', description: 'COL% por encima del objetivo en La Taberna Centro', metric: '28%', trend: 'up' },
    { id: '2', type: 'error', title: 'Margen bajo', description: 'GP% cayendo en los últimos 7 días', metric: '-3%', trend: 'down' },
    { id: '3', type: 'warning', title: 'Waste elevado', description: '€120 de waste ayer en Malasaña', metric: '€120' },
    { id: '4', type: 'info', title: 'Comps/Voids', description: '2.1% de líneas anuladas hoy', metric: '2.1%' },
    { id: '5', type: 'warning', title: 'Forecast desviación', description: 'Ventas 15% por debajo del forecast', metric: '-15%', trend: 'down' },
  ];

  useEffect(() => {
    fetchData();
  }, [selectedLocationId]);

  const fetchData = async () => {
    setLoading(true);
    const { from, to } = getDateRangeValues();
    
    let query = supabase.from('tickets').select('gross_total, covers').eq('status', 'closed');
    if (selectedLocationId && selectedLocationId !== 'all') {
      query = query.eq('location_id', selectedLocationId);
    }
    query = query.gte('closed_at', from.toISOString()).lte('closed_at', to.toISOString());
    
    const { data: tickets } = await query;
    
    const sales = tickets?.reduce((sum, t) => sum + (Number(t.gross_total) || 0), 0) || 0;
    const covers = tickets?.reduce((sum, t) => sum + (t.covers || 0), 0) || 0;
    const avgTicket = tickets?.length ? sales / tickets.length : 0;

    // Get labor cost
    let laborQuery = supabase.from('timesheets').select('labor_cost');
    if (selectedLocationId && selectedLocationId !== 'all') {
      laborQuery = laborQuery.eq('location_id', selectedLocationId);
    }
    laborQuery = laborQuery.gte('clock_in', from.toISOString()).lte('clock_in', to.toISOString());
    const { data: timesheets } = await laborQuery;
    const laborCost = timesheets?.reduce((sum, t) => sum + (Number(t.labor_cost) || 0), 0) || 0;

    setMetrics({ sales, covers, avgTicket, laborCost, cogsPercent: 30 });

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

    // Mock hourly data
    const hours = Array.from({ length: 14 }, (_, i) => ({ hour: `${10 + i}:00`, real: Math.random() * 300 + 50, forecast: Math.random() * 300 + 100 }));
    setHourlySales(hours);
    setHourlyLabor(hours.map(h => ({ hour: h.hour, real: Math.random() * 80 + 20, recommended: Math.random() * 60 + 30 })));

    setLoading(false);
  };

  const gpPercent = 100 - metrics.cogsPercent;
  const colPercent = metrics.sales > 0 ? (metrics.laborCost / metrics.sales) * 100 : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Resumen de operaciones de hoy</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <MetricCard title="Ventas" value={`€${metrics.sales.toLocaleString('es-ES', { maximumFractionDigits: 0 })}`} icon={DollarSign} variant="success" />
        <MetricCard title="GP%" value={`${gpPercent.toFixed(1)}%`} icon={Percent} variant={gpPercent >= 65 ? 'success' : 'warning'} />
        <MetricCard title="COGS" value={`€${(metrics.sales * metrics.cogsPercent / 100).toLocaleString('es-ES', { maximumFractionDigits: 0 })}`} icon={Receipt} />
        <MetricCard title="Labor" value={`€${metrics.laborCost.toLocaleString('es-ES', { maximumFractionDigits: 0 })}`} icon={Users} />
        <MetricCard title="COL%" value={`${colPercent.toFixed(1)}%`} icon={TrendingUp} variant={colPercent <= 25 ? 'success' : 'warning'} />
        <MetricCard title="Covers" value={metrics.covers} icon={Users} />
        <MetricCard title="Avg Ticket" value={`€${metrics.avgTicket.toFixed(2)}`} icon={Flame} />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <HourlySalesChart data={hourlySales} title="Ventas por Hora (Real vs Forecast)" />
        <HourlyLaborChart data={hourlyLabor} title="Labor por Hora (Real vs Recomendado)" />
      </div>

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
