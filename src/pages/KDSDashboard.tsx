import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useKDSDashboardData } from '@/hooks/useKDSDashboardData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  ChefHat, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp,
  Wine,
  Timer,
  ExternalLink,
  RefreshCw,
  Zap,
  Snail
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { cn } from '@/lib/utils';

function formatTime(minutes: number): string {
  if (minutes < 1) return '<1 min';
  return `${minutes.toFixed(1)} min`;
}

function getTimeColor(minutes: number, threshold = 8): string {
  if (minutes <= threshold * 0.6) return 'text-emerald-500';
  if (minutes <= threshold) return 'text-amber-500';
  return 'text-red-500';
}

export default function KDSDashboard() {
  const { selectedLocationId, locations } = useApp();
  const [selectedDate] = useState(new Date());

  const locationIds = selectedLocationId ? [selectedLocationId] : undefined;
  const { data, loading, refetch } = useKDSDashboardData({ 
    date: selectedDate,
    locationIds 
  });

  const getBarColor = (avgTime: number) => {
    if (avgTime <= 5) return 'hsl(var(--chart-2))'; // Green
    if (avgTime <= 8) return 'hsl(var(--chart-4))'; // Amber
    return 'hsl(var(--chart-1))'; // Red
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">KDS Dashboard</h1>
            <p className="text-muted-foreground">Métricas de cocina del día</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-4 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <ChefHat className="h-6 w-6" />
            KDS Dashboard
          </h1>
          <p className="text-muted-foreground">
            {format(selectedDate, "EEEE, d 'de' MMMM", { locale: es })} • 
            {selectedLocationId 
              ? ` ${locations.find(l => l.id === selectedLocationId)?.name}`
              : ' Todos los locales'
            }
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">Comandas</span>
            </div>
            <p className="text-3xl font-bold">{data?.totalOrdersCompleted || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {data?.totalItemsCompleted || 0} items
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Tiempo Medio</span>
            </div>
            <p className={cn("text-3xl font-bold", getTimeColor(data?.avgPrepTime || 0))}>
              {formatTime(data?.avgPrepTime || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">En Tiempo</span>
            </div>
            <p className={cn(
              "text-3xl font-bold",
              (data?.onTimePercentage || 0) >= 90 ? 'text-emerald-500' : 
              (data?.onTimePercentage || 0) >= 75 ? 'text-amber-500' : 'text-red-500'
            )}>
              {(data?.onTimePercentage || 0).toFixed(0)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">Alertas</span>
            </div>
            <p className={cn(
              "text-3xl font-bold",
              (data?.overdueAlerts || 0) === 0 ? 'text-emerald-500' : 'text-red-500'
            )}>
              {data?.overdueAlerts || 0}
            </p>
            <p className="text-xs text-muted-foreground mt-1">tiempos excedidos</p>
          </CardContent>
        </Card>

        <Card className="md:col-span-1">
          <CardContent className="p-6">
            <div className="text-sm text-muted-foreground mb-2">Por Estación</div>
            <div className="space-y-1">
              {data?.locationStats[0]?.byDestination && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1">
                      <ChefHat className="h-3 w-3 text-orange-500" /> Cocina
                    </span>
                    <span className={getTimeColor(data.locationStats[0].byDestination.kitchen.avgTime)}>
                      {formatTime(data.locationStats[0].byDestination.kitchen.avgTime)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1">
                      <Wine className="h-3 w-3 text-purple-500" /> Bar
                    </span>
                    <span className={getTimeColor(data.locationStats[0].byDestination.bar.avgTime, 3)}>
                      {formatTime(data.locationStats[0].byDestination.bar.avgTime)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1">
                      <Timer className="h-3 w-3 text-blue-500" /> Prep
                    </span>
                    <span className={getTimeColor(data.locationStats[0].byDestination.prep.avgTime, 5)}>
                      {formatTime(data.locationStats[0].byDestination.prep.avgTime)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Hourly Performance Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rendimiento por Hora</CardTitle>
            <CardDescription>Tiempo medio de preparación a lo largo del día</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.hourlyData?.filter(h => h.orders > 0) || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="hour" 
                    tickFormatter={(h) => `${h}:00`}
                    className="text-xs"
                  />
                  <YAxis 
                    tickFormatter={(v) => `${v}m`}
                    className="text-xs"
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-popover border rounded-lg p-3 shadow-lg">
                          <p className="font-medium">{d.hour}:00 - {d.hour + 1}:00</p>
                          <p className="text-sm text-muted-foreground">
                            {d.orders} comandas • {formatTime(d.avgPrepTime)} avg
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="avgPrepTime" radius={[4, 4, 0, 0]}>
                    {data?.hourlyData?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getBarColor(entry.avgPrepTime)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Products Performance */}
        <div className="grid gap-6">
          {/* Slowest Products */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Snail className="h-4 w-4 text-red-500" />
                Productos Más Lentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data?.topSlowProducts?.length ? (
                <div className="space-y-2">
                  {data.topSlowProducts.map((product, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm truncate max-w-[200px]">{product.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{product.count}x</Badge>
                        <span className={cn("text-sm font-medium", getTimeColor(product.avgTime))}>
                          {formatTime(product.avgTime)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Sin datos suficientes
                </p>
              )}
            </CardContent>
          </Card>

          {/* Fastest Products */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-500" />
                Productos Más Rápidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data?.fastestProducts?.length ? (
                <div className="space-y-2">
                  {data.fastestProducts.map((product, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm truncate max-w-[200px]">{product.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{product.count}x</Badge>
                        <span className="text-sm font-medium text-emerald-500">
                          {formatTime(product.avgTime)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Sin datos suficientes
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Location Performance Table */}
      {!selectedLocationId && data?.locationStats && data.locationStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rendimiento por Local</CardTitle>
            <CardDescription>Comparativa de métricas KDS entre locales</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Local</TableHead>
                  <TableHead className="text-right">Comandas</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Tiempo Medio</TableHead>
                  <TableHead className="text-right">En Tiempo</TableHead>
                  <TableHead className="text-right">Alertas</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.locationStats.map((loc) => (
                  <TableRow key={loc.locationId}>
                    <TableCell className="font-medium">{loc.locationName}</TableCell>
                    <TableCell className="text-right">{loc.ordersCompleted}</TableCell>
                    <TableCell className="text-right">{loc.itemsCompleted}</TableCell>
                    <TableCell className={cn("text-right font-medium", getTimeColor(loc.avgPrepTime))}>
                      {formatTime(loc.avgPrepTime)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge 
                        variant={loc.onTimePercentage >= 90 ? 'default' : 'destructive'}
                        className={loc.onTimePercentage >= 90 ? 'bg-emerald-500' : ''}
                      >
                        {loc.onTimePercentage.toFixed(0)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {loc.overdueCount > 0 ? (
                        <span className="text-red-500 font-medium">{loc.overdueCount}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/kds/${loc.locationId}`}>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Accesos Rápidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {locations.map((loc) => (
              <Button key={loc.id} variant="outline" asChild>
                <Link to={`/kds/${loc.id}`}>
                  <ChefHat className="h-4 w-4 mr-2" />
                  KDS {loc.name}
                </Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
