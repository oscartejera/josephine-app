import { useState, useEffect } from 'react';
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users, TrendingUp, Clock, XCircle, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

interface ReservationAnalyticsProps {
  locationId: string | null;
}

interface DailyStats {
  date: string;
  count: number;
  covers: number;
}

export function ReservationAnalytics({ locationId }: ReservationAnalyticsProps) {
  const [stats, setStats] = useState({
    totalReservations: 0,
    totalCovers: 0,
    noShowRate: 0,
    avgPartySize: 0,
    bySource: [] as { name: string; value: number }[],
    byHour: [] as { hour: string; count: number }[],
    weeklyTrend: [] as DailyStats[],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [locationId]);

  const fetchAnalytics = async () => {
    if (!locationId) return;

    const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');

    const { data: reservations } = await supabase
      .from('reservations')
      .select('*')
      .eq('location_id', locationId)
      .gte('reservation_date', thirtyDaysAgo);

    if (!reservations) {
      setLoading(false);
      return;
    }

    // Calculate stats
    const total = reservations.length;
    const covers = reservations.reduce((sum, r) => sum + r.party_size, 0);
    const noShows = reservations.filter(r => r.status === 'no_show').length;
    const avgParty = total > 0 ? covers / total : 0;

    // By source
    const sourceCount: Record<string, number> = {};
    reservations.forEach(r => {
      const src = r.source || 'manual';
      sourceCount[src] = (sourceCount[src] || 0) + 1;
    });
    const bySource = Object.entries(sourceCount).map(([name, value]) => ({
      name: getSourceLabel(name),
      value,
    }));

    // By hour
    const hourCount: Record<string, number> = {};
    reservations.forEach(r => {
      const hour = r.reservation_time?.substring(0, 2) || '00';
      hourCount[hour] = (hourCount[hour] || 0) + 1;
    });
    const byHour = Object.entries(hourCount)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([hour, count]) => ({ hour: `${hour}:00`, count }));

    // Weekly trend
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const weeklyTrend = weekDays.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayReservations = reservations.filter(r => r.reservation_date === dateStr);
      return {
        date: format(day, 'EEE', { locale: es }),
        count: dayReservations.length,
        covers: dayReservations.reduce((sum, r) => sum + r.party_size, 0),
      };
    });

    setStats({
      totalReservations: total,
      totalCovers: covers,
      noShowRate: total > 0 ? (noShows / total) * 100 : 0,
      avgPartySize: avgParty,
      bySource,
      byHour,
      weeklyTrend,
    });
    setLoading(false);
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'manual': return 'Manual';
      case 'phone': return 'Teléfono';
      case 'widget': return 'Web';
      case 'walk_in': return 'De paso';
      case 'google': return 'Google';
      default: return source;
    }
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalReservations}</p>
                <p className="text-xs text-muted-foreground">Reservas (30d)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Users className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalCovers}</p>
                <p className="text-xs text-muted-foreground">Comensales</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <TrendingUp className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.avgPartySize.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Comensales/Reserva</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.noShowRate.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Tasa No Show</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Reservas por Día</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats.weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-popover border rounded-lg p-2 shadow-lg text-sm">
                          <p className="font-medium">{payload[0].payload.date}</p>
                          <p>{payload[0].value} reservas</p>
                          <p className="text-muted-foreground">{payload[0].payload.covers} comensales</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* By Source */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Por Origen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-8">
              <ResponsiveContainer width={150} height={150}>
                <PieChart>
                  <Pie
                    data={stats.bySource}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                  >
                    {stats.bySource.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {stats.bySource.map((source, i) => (
                  <div key={source.name} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span className="text-sm">{source.name}</span>
                    <span className="text-sm text-muted-foreground ml-auto">{source.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* By Hour */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Distribución por Hora</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.byHour}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
