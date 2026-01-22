import { useState, useEffect, useCallback } from 'react';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  BarChart3, 
  Clock, 
  ChefHat, 
  Wine, 
  Timer,
  TrendingUp,
  TrendingDown,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface DestinationStats {
  destination: 'kitchen' | 'bar' | 'prep';
  avgPrepTime: number;
  totalItems: number;
  trend: number; // % change vs previous period
}

interface ProductStats {
  productName: string;
  avgPrepTime: number;
  count: number;
  destination: string;
}

interface HourlyStats {
  hour: string;
  avgTime: number;
  count: number;
}

interface KDSStatsPanelProps {
  locationId: string;
  onClose: () => void;
}

const destinationConfig = {
  kitchen: { icon: ChefHat, label: 'Cocina', color: '#f97316' },
  bar: { icon: Wine, label: 'Bar', color: '#a855f7' },
  prep: { icon: Timer, label: 'Prep', color: '#3b82f6' },
};

export function KDSStatsPanel({ locationId, onClose }: KDSStatsPanelProps) {
  const [destinationStats, setDestinationStats] = useState<DestinationStats[]>([]);
  const [productStats, setProductStats] = useState<ProductStats[]>([]);
  const [hourlyStats, setHourlyStats] = useState<HourlyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week'>('today');

  const fetchStats = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);

    try {
      const startDate = period === 'today' 
        ? new Date(new Date().setHours(0, 0, 0, 0))
        : subDays(new Date(), 7);
      
      const prevStartDate = period === 'today'
        ? subDays(startDate, 1)
        : subDays(startDate, 7);

      // Fetch completed items with prep times
      const { data: items, error } = await supabase
        .from('ticket_lines')
        .select(`
          id,
          item_name,
          destination,
          prep_started_at,
          ready_at,
          tickets!inner (location_id)
        `)
        .eq('tickets.location_id', locationId)
        .not('prep_started_at', 'is', null)
        .not('ready_at', 'is', null)
        .gte('ready_at', startDate.toISOString())
        .order('ready_at', { ascending: false });

      if (error) {
        console.error('Error fetching stats:', error);
        return;
      }

      // Fetch previous period for trend calculation
      const { data: prevItems } = await supabase
        .from('ticket_lines')
        .select(`
          id,
          destination,
          prep_started_at,
          ready_at,
          tickets!inner (location_id)
        `)
        .eq('tickets.location_id', locationId)
        .not('prep_started_at', 'is', null)
        .not('ready_at', 'is', null)
        .gte('ready_at', prevStartDate.toISOString())
        .lt('ready_at', startDate.toISOString());

      // Calculate destination stats
      const destMap = new Map<string, { totalTime: number; count: number }>();
      const prevDestMap = new Map<string, { totalTime: number; count: number }>();
      const productMap = new Map<string, { totalTime: number; count: number; destination: string }>();
      const hourMap = new Map<number, { totalTime: number; count: number }>();

      // Current period
      (items || []).forEach((item: any) => {
        const prepTime = (new Date(item.ready_at).getTime() - new Date(item.prep_started_at).getTime()) / 60000; // minutes
        if (prepTime < 0 || prepTime > 120) return; // Filter invalid data
        
        const dest = item.destination || 'kitchen';
        
        // Destination stats
        const destStats = destMap.get(dest) || { totalTime: 0, count: 0 };
        destStats.totalTime += prepTime;
        destStats.count += 1;
        destMap.set(dest, destStats);

        // Product stats
        const productKey = item.item_name || 'Desconocido';
        const prodStats = productMap.get(productKey) || { totalTime: 0, count: 0, destination: dest };
        prodStats.totalTime += prepTime;
        prodStats.count += 1;
        productMap.set(productKey, prodStats);

        // Hourly stats
        const hour = new Date(item.ready_at).getHours();
        const hourStats = hourMap.get(hour) || { totalTime: 0, count: 0 };
        hourStats.totalTime += prepTime;
        hourStats.count += 1;
        hourMap.set(hour, hourStats);
      });

      // Previous period
      (prevItems || []).forEach((item: any) => {
        const prepTime = (new Date(item.ready_at).getTime() - new Date(item.prep_started_at).getTime()) / 60000;
        if (prepTime < 0 || prepTime > 120) return;
        
        const dest = item.destination || 'kitchen';
        const destStats = prevDestMap.get(dest) || { totalTime: 0, count: 0 };
        destStats.totalTime += prepTime;
        destStats.count += 1;
        prevDestMap.set(dest, destStats);
      });

      // Build destination stats with trends
      const destinations: DestinationStats[] = ['kitchen', 'bar', 'prep'].map(dest => {
        const current = destMap.get(dest);
        const prev = prevDestMap.get(dest);
        const currentAvg = current ? current.totalTime / current.count : 0;
        const prevAvg = prev ? prev.totalTime / prev.count : 0;
        const trend = prevAvg > 0 ? ((currentAvg - prevAvg) / prevAvg) * 100 : 0;

        return {
          destination: dest as 'kitchen' | 'bar' | 'prep',
          avgPrepTime: Math.round(currentAvg * 10) / 10,
          totalItems: current?.count || 0,
          trend: Math.round(trend),
        };
      });

      // Build product stats (top 10 slowest)
      const products: ProductStats[] = Array.from(productMap.entries())
        .map(([name, stats]) => ({
          productName: name,
          avgPrepTime: Math.round((stats.totalTime / stats.count) * 10) / 10,
          count: stats.count,
          destination: stats.destination,
        }))
        .sort((a, b) => b.avgPrepTime - a.avgPrepTime)
        .slice(0, 10);

      // Build hourly stats
      const hourly: HourlyStats[] = Array.from(hourMap.entries())
        .map(([hour, stats]) => ({
          hour: `${hour.toString().padStart(2, '0')}:00`,
          avgTime: Math.round((stats.totalTime / stats.count) * 10) / 10,
          count: stats.count,
        }))
        .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));

      setDestinationStats(destinations);
      setProductStats(products);
      setHourlyStats(hourly);
    } catch (error) {
      console.error('Error in fetchStats:', error);
    } finally {
      setLoading(false);
    }
  }, [locationId, period]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const formatTime = (mins: number) => {
    if (mins < 1) return `${Math.round(mins * 60)}s`;
    return `${mins.toFixed(1)}m`;
  };

  return (
    <div className="fixed inset-0 bg-zinc-950/95 z-50 flex flex-col">
      {/* Header */}
      <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-emerald-500" />
          <h2 className="text-lg font-semibold text-zinc-100">Estadísticas de Preparación</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-zinc-800 rounded-lg p-1">
            <button
              onClick={() => setPeriod('today')}
              className={cn(
                "px-3 py-1.5 rounded text-sm font-medium transition-colors",
                period === 'today' ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              Hoy
            </button>
            <button
              onClick={() => setPeriod('week')}
              className={cn(
                "px-3 py-1.5 rounded text-sm font-medium transition-colors",
                period === 'week' ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              7 días
            </button>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-zinc-800">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-8">
            {/* Destination KPIs */}
            <div>
              <h3 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wider">
                Tiempo medio por estación
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {destinationStats.map((stat) => {
                  const config = destinationConfig[stat.destination];
                  const Icon = config.icon;
                  return (
                    <div
                      key={stat.destination}
                      className="bg-zinc-900 border border-zinc-800 rounded-xl p-5"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Icon className="h-5 w-5" style={{ color: config.color }} />
                          <span className="font-medium text-zinc-200">{config.label}</span>
                        </div>
                        {stat.trend !== 0 && (
                          <div className={cn(
                            "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded",
                            stat.trend > 0 
                              ? "bg-red-500/20 text-red-400" 
                              : "bg-emerald-500/20 text-emerald-400"
                          )}>
                            {stat.trend > 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {Math.abs(stat.trend)}%
                          </div>
                        )}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-zinc-100">
                          {formatTime(stat.avgPrepTime)}
                        </span>
                        <span className="text-sm text-zinc-500">
                          ({stat.totalItems} items)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hourly Chart */}
            {hourlyStats.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wider">
                  Tiempo medio por hora
                </h3>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourlyStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                      <XAxis 
                        dataKey="hour" 
                        stroke="#71717a" 
                        fontSize={12}
                        tickLine={false}
                      />
                      <YAxis 
                        stroke="#71717a" 
                        fontSize={12}
                        tickLine={false}
                        tickFormatter={(v) => `${v}m`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#18181b',
                          border: '1px solid #3f3f46',
                          borderRadius: '8px',
                        }}
                        labelStyle={{ color: '#e4e4e7' }}
                        formatter={(value: number) => [`${value.toFixed(1)} min`, 'Tiempo medio']}
                      />
                      <Bar dataKey="avgTime" radius={[4, 4, 0, 0]}>
                        {hourlyStats.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.avgTime > 8 ? '#ef4444' : entry.avgTime > 5 ? '#f59e0b' : '#10b981'} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Top Products Table */}
            <div>
              <h3 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wider">
                Productos más lentos
              </h3>
              {productStats.length === 0 ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
                  No hay datos de preparación disponibles
                </div>
              ) : (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-zinc-800">
                        <th className="text-left p-4 text-sm font-medium text-zinc-400">Producto</th>
                        <th className="text-left p-4 text-sm font-medium text-zinc-400">Estación</th>
                        <th className="text-right p-4 text-sm font-medium text-zinc-400">Preparaciones</th>
                        <th className="text-right p-4 text-sm font-medium text-zinc-400">Tiempo medio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productStats.map((product, idx) => (
                        <tr key={idx} className="border-b border-zinc-800/50 last:border-0">
                          <td className="p-4 text-zinc-200">{product.productName}</td>
                          <td className="p-4">
                            <span className={cn(
                              "text-xs px-2 py-1 rounded",
                              product.destination === 'bar' ? 'bg-purple-500/20 text-purple-400' :
                              product.destination === 'prep' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-orange-500/20 text-orange-400'
                            )}>
                              {product.destination === 'bar' ? 'Bar' : 
                               product.destination === 'prep' ? 'Prep' : 'Cocina'}
                            </span>
                          </td>
                          <td className="p-4 text-right text-zinc-400">{product.count}</td>
                          <td className="p-4 text-right">
                            <span className={cn(
                              "font-medium",
                              product.avgPrepTime > 10 ? 'text-red-400' :
                              product.avgPrepTime > 6 ? 'text-amber-400' :
                              'text-emerald-400'
                            )}>
                              {formatTime(product.avgPrepTime)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
