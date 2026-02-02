/**
 * Reservations Analytics Page
 * Analítica completa del módulo de reservas
 */

import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useReservations } from '@/contexts/ReservationsContext';
import { ReservationsProvider } from '@/contexts/ReservationsContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Calendar,
  Users,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Award,
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';

const COLORS = {
  primary: 'hsl(var(--chart-1))',
  success: 'hsl(var(--chart-2))',
  warning: 'hsl(var(--chart-3))',
  danger: 'hsl(var(--chart-5))',
  info: 'hsl(var(--chart-4))',
};

function ReservationsAnalyticsContent() {
  const { selectedLocationId, locations } = useApp();
  const { dataLayer } = useReservations();
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>(null);

  const locationId = selectedLocationId === 'all' ? null : selectedLocationId;

  useEffect(() => {
    async function loadAnalytics() {
      if (!locationId) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const endDate = new Date();
        const startDate = period === 'week' ? subDays(endDate, 7) : startOfMonth(endDate);

        const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
        
        // Fetch reservations for the period
        const allReservations = await dataLayer.reservations.findByDateRange(
          locationId,
          format(startDate, 'yyyy-MM-dd'),
          format(endDate, 'yyyy-MM-dd')
        );

        // Calculate metrics
        const totalReservations = allReservations.length;
        const totalCovers = allReservations.reduce((sum, r) => sum + r.party_size, 0);
        const confirmedCount = allReservations.filter(r => 
          ['confirmed', 'reconfirmed', 'seated', 'completed'].includes(r.status)
        ).length;
        const noShowCount = allReservations.filter(r => r.status === 'no_show').length;
        const cancelledCount = allReservations.filter(r => r.status === 'cancelled').length;

        const noShowRate = totalReservations > 0 ? (noShowCount / totalReservations) * 100 : 0;
        const cancellationRate = totalReservations > 0 ? (cancelledCount / totalReservations) * 100 : 0;
        const avgPartySize = totalReservations > 0 ? totalCovers / totalReservations : 0;

        // Reservations by day
        const byDay = dateRange.map(date => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const dayReservations = allReservations.filter(r => r.reservation_date === dateStr);
          return {
            date: format(date, 'dd MMM', { locale: es }),
            reservations: dayReservations.length,
            covers: dayReservations.reduce((sum, r) => sum + r.party_size, 0),
          };
        });

        // Reservations by hour
        const hourCounts: Record<string, number> = {};
        allReservations.forEach(r => {
          const hour = r.reservation_time.substring(0, 2);
          hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });

        const byHour = Object.entries(hourCounts)
          .map(([hour, count]) => ({
            hour: `${hour}:00`,
            count,
          }))
          .sort((a, b) => a.hour.localeCompare(b.hour));

        // Reservations by source
        const sourceCounts: Record<string, number> = {};
        allReservations.forEach(r => {
          const source = r.source || 'manual';
          sourceCounts[source] = (sourceCounts[source] || 0) + 1;
        });

        const bySource = Object.entries(sourceCounts).map(([name, value]) => ({
          name: name === 'manual' ? 'Teléfono' : 
                name === 'online' ? 'Online' :
                name === 'google' ? 'Google' : 'Walk-in',
          value,
        }));

        // Status distribution
        const statusCounts: Record<string, number> = {};
        allReservations.forEach(r => {
          statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
        });

        const byStatus = Object.entries(statusCounts).map(([name, value]) => ({
          name: name === 'confirmed' ? 'Confirmadas' :
                name === 'pending' ? 'Pendientes' :
                name === 'seated' ? 'Sentados' :
                name === 'completed' ? 'Completadas' :
                name === 'cancelled' ? 'Canceladas' : 'No-shows',
          value,
        }));

        // Top customers
        const customers = await dataLayer.customers.findAll();
        const topCustomers = customers
          .sort((a, b) => b.total_visits - a.total_visits)
          .slice(0, 5)
          .map(c => ({
            id: c.id,
            name: c.name,
            visits: c.total_visits,
            spent: c.total_spent,
          }));

        // Calculate deposit revenue (mock for now)
        const depositRevenue = allReservations
          .filter(r => r.deposit_id)
          .length * 10; // Assuming 10 EUR average deposit

        setAnalytics({
          summary: {
            totalReservations,
            totalCovers,
            confirmedCount,
            noShowCount,
            cancelledCount,
            noShowRate,
            cancellationRate,
            avgPartySize,
            depositRevenue,
          },
          charts: {
            byDay,
            byHour,
            bySource,
            byStatus,
          },
          topCustomers,
        });
      } catch (error) {
        console.error('Error loading analytics:', error);
      } finally {
        setLoading(false);
      }
    }

    loadAnalytics();
  }, [locationId, period, dataLayer]);

  if (!locationId) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <p>Selecciona una ubicación para ver analítica</p>
        </div>
      </div>
    );
  }

  if (loading || !analytics) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  const { summary, charts, topCustomers } = analytics;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6" />
            Analítica de Reservas
          </h1>
          <p className="text-muted-foreground">
            {locations.find(l => l.id === locationId)?.name}
          </p>
        </div>

        <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Última Semana</SelectItem>
            <SelectItem value="month">Este Mes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">Reservas</span>
            </div>
            <p className="text-3xl font-bold">{summary.totalReservations}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.totalCovers} cubiertos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-sm">Promedio</span>
            </div>
            <p className="text-3xl font-bold">{summary.avgPartySize.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground mt-1">personas/reserva</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">No-Shows</span>
            </div>
            <p className="text-3xl font-bold text-red-500">
              {summary.noShowRate.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.noShowCount} reservas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm">Depósitos</span>
            </div>
            <p className="text-3xl font-bold text-emerald-500">
              €{summary.depositRevenue}
            </p>
            <p className="text-xs text-muted-foreground mt-1">ingresos</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <Tabs defaultValue="trends" className="w-full">
        <TabsList>
          <TabsTrigger value="trends">Tendencias</TabsTrigger>
          <TabsTrigger value="distribution">Distribución</TabsTrigger>
          <TabsTrigger value="customers">Clientes</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-6">
          {/* Reservations over time */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reservas por Día</CardTitle>
              <CardDescription>
                Evolución de reservas y cubiertos en el período
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={charts.byDay}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '0.5rem',
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="reservations"
                      name="Reservas"
                      stroke={COLORS.primary}
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="covers"
                      name="Cubiertos"
                      stroke={COLORS.success}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Reservations by hour */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reservas por Hora</CardTitle>
              <CardDescription>Distribución horaria de reservas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.byHour}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="hour" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '0.5rem',
                      }}
                    />
                    <Bar dataKey="count" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* By Source */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por Fuente</CardTitle>
                <CardDescription>Origen de las reservas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={charts.bySource}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name}: ${entry.value}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {charts.bySource.map((entry: any, index: number) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={Object.values(COLORS)[index % Object.values(COLORS).length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* By Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por Estado</CardTitle>
                <CardDescription>Distribución de estados</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={charts.byStatus}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name}: ${entry.value}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {charts.byStatus.map((entry: any, index: number) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={Object.values(COLORS)[index % Object.values(COLORS).length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Métricas de Rendimiento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-emerald-500" />
                    <span className="text-sm font-medium">Confirmadas</span>
                  </div>
                  <div className="text-2xl font-bold">{summary.confirmedCount}</div>
                  <div className="text-xs text-muted-foreground">
                    {((summary.confirmedCount / summary.totalReservations) * 100).toFixed(1)}% del total
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-500" />
                    <span className="text-sm font-medium">Canceladas</span>
                  </div>
                  <div className="text-2xl font-bold">{summary.cancelledCount}</div>
                  <div className="text-xs text-muted-foreground">
                    {summary.cancellationRate.toFixed(1)}% tasa
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <span className="text-sm font-medium">No-Shows</span>
                  </div>
                  <div className="text-2xl font-bold">{summary.noShowCount}</div>
                  <div className="text-xs text-muted-foreground">
                    {summary.noShowRate.toFixed(1)}% tasa
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="h-5 w-5" />
                Top 5 Clientes
              </CardTitle>
              <CardDescription>Clientes más frecuentes del período</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topCustomers.map((customer: any, index: number) => (
                  <div
                    key={customer.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold">
                        #{index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {customer.visits} visitas
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-600">
                        €{customer.spent.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">gastado</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ReservationsAnalytics() {
  return (
    <ReservationsProvider>
      <ReservationsAnalyticsContent />
    </ReservationsProvider>
  );
}
