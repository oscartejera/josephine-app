import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Calendar } from 'lucide-react';
import { format, addDays, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

interface ForecastData {
  hour: number;
  forecast_sales: number;
  forecast_covers: number | null;
  real_sales?: number;
}

export default function Forecast() {
  const { selectedLocationId } = useApp();
  const [hourlyData, setHourlyData] = useState<ForecastData[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchForecastData();
  }, [selectedLocationId]);

  const fetchForecastData = async () => {
    setLoading(true);
    const today = new Date();
    
    // Fetch today's forecast
    let query = supabase
      .from('forecasts')
      .select('hour, forecast_sales, forecast_covers')
      .eq('forecast_date', format(today, 'yyyy-MM-dd'))
      .order('hour');
    
    if (selectedLocationId && selectedLocationId !== 'all') {
      query = query.eq('location_id', selectedLocationId);
    }
    
    const { data: forecasts } = await query;
    
    // Get real sales for today grouped by hour
    let ticketsQuery = supabase
      .from('tickets')
      .select('closed_at, gross_total')
      .eq('status', 'closed')
      .gte('closed_at', format(today, 'yyyy-MM-dd'))
      .lt('closed_at', format(addDays(today, 1), 'yyyy-MM-dd'));
    
    if (selectedLocationId && selectedLocationId !== 'all') {
      ticketsQuery = ticketsQuery.eq('location_id', selectedLocationId);
    }
    
    const { data: tickets } = await ticketsQuery;
    
    // Group tickets by hour
    const hourlyReal: Record<number, number> = {};
    tickets?.forEach(t => {
      if (t.closed_at) {
        const hour = new Date(t.closed_at).getHours();
        hourlyReal[hour] = (hourlyReal[hour] || 0) + Number(t.gross_total);
      }
    });
    
    // Merge forecast with real data
    const hourlyMerged = (forecasts || []).map(f => ({
      ...f,
      real_sales: hourlyReal[f.hour] || 0
    }));
    
    setHourlyData(hourlyMerged);
    
    // Generate weekly heatmap data
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekly: any[] = [];
    for (let d = 0; d < 7; d++) {
      const day = addDays(weekStart, d);
      const dayData: any = { day: format(day, 'EEE', { locale: es }) };
      for (let h = 10; h <= 23; h++) {
        dayData[`h${h}`] = Math.random() * 400 + 50; // Mock data
      }
      weekly.push(dayData);
    }
    setWeeklyData(weekly);
    
    setLoading(false);
  };

  const chartData = hourlyData.map(d => ({
    hour: `${d.hour}:00`,
    forecast: d.forecast_sales,
    real: d.real_sales || 0,
    variance: ((d.real_sales || 0) - d.forecast_sales)
  }));

  const totalForecast = hourlyData.reduce((sum, d) => sum + d.forecast_sales, 0);
  const totalReal = hourlyData.reduce((sum, d) => sum + (d.real_sales || 0), 0);
  const variancePercent = totalForecast > 0 ? ((totalReal - totalForecast) / totalForecast) * 100 : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold">Forecast</h1>
        <p className="text-muted-foreground">Previsión de demanda y comparativa con ventas reales</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Forecast Hoy</p>
                <p className="text-2xl font-bold">€{totalForecast.toLocaleString('es-ES', { maximumFractionDigits: 0 })}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ventas Reales</p>
                <p className="text-2xl font-bold">€{totalReal.toLocaleString('es-ES', { maximumFractionDigits: 0 })}</p>
              </div>
              <Calendar className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Varianza</p>
                <p className="text-2xl font-bold">
                  <Badge variant={variancePercent >= 0 ? "default" : "destructive"}>
                    {variancePercent >= 0 ? '+' : ''}{variancePercent.toFixed(1)}%
                  </Badge>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="hourly">
        <TabsList>
          <TabsTrigger value="hourly">Por Hora</TabsTrigger>
          <TabsTrigger value="weekly">Semanal</TabsTrigger>
        </TabsList>

        <TabsContent value="hourly" className="space-y-6">
          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Forecast vs Real por Hora</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="hour" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tickFormatter={(v) => `€${v}`} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                      formatter={(value: number) => [`€${value.toFixed(2)}`, '']}
                    />
                    <Area type="monotone" dataKey="forecast" stroke="hsl(var(--muted-foreground))" fill="url(#colorForecast)" name="Forecast" strokeDasharray="5 5" />
                    <Area type="monotone" dataKey="real" stroke="hsl(var(--primary))" fill="url(#colorReal)" name="Real" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle>Detalle por Hora</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hora</TableHead>
                    <TableHead className="text-right">Forecast</TableHead>
                    <TableHead className="text-right">Real</TableHead>
                    <TableHead className="text-right">Varianza</TableHead>
                    <TableHead className="text-right">Covers Est.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hourlyData.map((row) => {
                    const variance = (row.real_sales || 0) - row.forecast_sales;
                    const variancePct = row.forecast_sales > 0 ? (variance / row.forecast_sales) * 100 : 0;
                    return (
                      <TableRow key={row.hour}>
                        <TableCell className="font-medium">{row.hour}:00</TableCell>
                        <TableCell className="text-right">€{row.forecast_sales.toFixed(0)}</TableCell>
                        <TableCell className="text-right">€{(row.real_sales || 0).toFixed(0)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={variancePct >= 0 ? "default" : "destructive"} className="text-xs">
                            {variancePct >= 0 ? '+' : ''}{variancePct.toFixed(0)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{row.forecast_covers || '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weekly">
          <Card>
            <CardHeader>
              <CardTitle>Heatmap de Demanda Semanal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="p-2 text-left">Día</th>
                      {Array.from({ length: 14 }, (_, i) => (
                        <th key={i} className="p-2 text-center">{10 + i}h</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyData.map((day, i) => (
                      <tr key={i}>
                        <td className="p-2 font-medium capitalize">{day.day}</td>
                        {Array.from({ length: 14 }, (_, h) => {
                          const value = day[`h${10 + h}`] || 0;
                          const intensity = Math.min(value / 400, 1);
                          return (
                            <td key={h} className="p-1">
                              <div 
                                className="w-8 h-8 rounded flex items-center justify-center text-xs"
                                style={{ 
                                  backgroundColor: `hsl(var(--primary) / ${0.1 + intensity * 0.6})`,
                                  color: intensity > 0.5 ? 'white' : 'inherit'
                                }}
                              >
                                {Math.round(value)}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
