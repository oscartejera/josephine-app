/**
 * Sales Module - Nory-style with Josephine colors
 * Complete BI module with forecasts, variance, and multi-location
 */

import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown,
  Users,
  Clock,
  DollarSign,
  Calendar
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';

// Josephine colors (NOT Nory purple)
const COLORS = {
  actual: '#6366f1', // Indigo
  forecast: '#0ea5e9', // Sky blue
  forecastLight: '#bae6fd',
  avgCheck: '#f59e0b', // Amber
  success: '#10b981', // Emerald
  danger: '#f43f5e', // Rose
};

import { useSalesData } from '@/hooks/useSalesData';
import type { DateRangeType } from '@/hooks/useSalesData';

export default function Sales() {
  const { selectedLocationId } = useApp();
  const [dateRange, setDateRange] = useState<DateRangeType>('week');
  const [compareMode, setCompareMode] = useState('forecast');

  const { data: salesData, loading } = useSalesData(selectedLocationId, dateRange);

  if (loading || !salesData) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const weeklyData = salesData.dailyData.map((d: any) => ({
    day: format(new Date(d.day), 'EEEE, d'),
    actual: Math.round(d.actual),
    forecast: Math.round(d.forecast),
    avgCheck: d.avgCheck,
  }));

  const productsData = [
    { name: 'Paella Valenciana', value: 4440.24, pct: 12.31 },
    { name: 'Jamón Ibérico', value: 2202.06, pct: 6.11 },
    { name: 'Chuletón de Buey', value: 2159.16, pct: 5.99 },
    { name: 'Croquetas Premium', value: 1752.68, pct: 4.86 },
    { name: 'Pulpo a la Gallega', value: 1704.20, pct: 4.73 },
  ];

  const channelTableData = [
    { channel: 'Dine-in', actual: 22330, actualVar: 0.9, projected: 23100, projVar: 0.28, avgCheck: 24.84, avgCheckProj: 26.85 },
    { channel: 'Pick-up', actual: 2862, actualVar: 133.5, projected: 3200, projVar: 29.88, avgCheck: 15.81, avgCheckProj: 19.54 },
    { channel: 'Delivery', actual: 10967, actualVar: -11.52, projected: 10500, projVar: -3.45, avgCheck: 24.59, avgCheckProj: 26.15 },
  ];

  const VarianceIndicator = ({ value, showEuro = false }: { value: number; showEuro?: boolean }) => {
    const isPositive = value >= 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;
    
    return (
      <div className={cn(
        'inline-flex items-center gap-1 text-sm font-medium',
        isPositive ? 'text-emerald-600' : 'text-rose-600'
      )}>
        <Icon className="h-3 w-3" />
        {isPositive ? '+' : ''}{value.toFixed(2)}%
        {showEuro && ` (€${Math.abs(value * 100).toFixed(0)})`}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sales</h1>
          <p className="text-muted-foreground">Análisis de ventas con forecast AI</p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="week">Esta Semana</SelectItem>
              <SelectItem value="month">Este Mes</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>

          <Select value={compareMode} onValueChange={setCompareMode}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="forecast">vs Forecast</SelectItem>
              <SelectItem value="last_week">vs Semana Anterior</SelectItem>
              <SelectItem value="last_month">vs Mes Anterior</SelectItem>
              <SelectItem value="last_year">vs Año Anterior</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline">
            ✨ Ask Josephine
          </Button>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Sales to Date */}
        <Card className="p-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">Sales to Date</h3>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            
            <div>
              <div className="text-3xl font-bold">€{Math.round(salesData.totals.sales).toLocaleString()}</div>
              <VarianceIndicator value={salesData.totals.variance} />
            </div>

            {/* Channel breakdown bars */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-indigo-600"></div>
                  Dine-in
                </span>
                <span className="font-medium">{salesData.totals.channels.dineIn.pct.toFixed(0)}%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-600" 
                  style={{ width: `${salesData.channels.dineIn.pct}%` }}
                ></div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-sky-500"></div>
                  Pick-up
                </span>
                <span className="font-medium">{salesData.channels.pickUp.pct}%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-sky-500" 
                  style={{ width: `${salesData.channels.pickUp.pct}%` }}
                ></div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
                  Delivery
                </span>
                <span className="font-medium">{salesData.channels.delivery.pct}%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-cyan-500" 
                  style={{ width: `${salesData.channels.delivery.pct}%` }}
                ></div>
              </div>
            </div>
          </div>
        </Card>

        {/* Avg Check Size */}
        <Card className="p-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">Average Check Size</h3>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            
            <div>
              <div className="text-3xl font-bold">€{salesData.totals.avgCheck.toFixed(2)}</div>
              <VarianceIndicator value={1.26} />
            </div>

            {/* Channel avg check */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dine-in</span>
                <span className="font-semibold">€{salesData.channels.dineIn.avgCheck.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pick-up</span>
                <span className="font-semibold">€{salesData.channels.pickUp.avgCheck.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery</span>
                <span className="font-semibold">€{salesData.channels.delivery.avgCheck.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Dwell Time */}
        <Card className="p-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">Dwell Time</h3>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            
            <div>
              <div className="text-3xl font-bold">{salesData.dwellTime}</div>
              <p className="text-sm text-muted-foreground">Tiempo medio en mesa</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Sales vs Forecast Chart */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Sales vs Forecast</h3>
            <Tabs defaultValue="sales" className="w-auto">
              <TabsList>
                <TabsTrigger value="sales">Sales</TabsTrigger>
                <TabsTrigger value="orders">Orders</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="day" 
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                />
                <YAxis 
                  yAxisId="left"
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                  tickFormatter={(value) => `€${(value/1000).toFixed(0)}K`}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  stroke="#f59e0b"
                  tickFormatter={(value) => `€${value.toFixed(0)}`}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '12px',
                  }}
                  formatter={(value: any, name: string) => {
                    if (name === 'avgCheck') return [`€${value.toFixed(2)}`, 'Avg Check'];
                    return [`€${value.toLocaleString()}`, name === 'actual' ? 'Actual' : 'Forecast'];
                  }}
                />
                <Legend />
                <Bar 
                  yAxisId="left"
                  dataKey="actual" 
                  fill={COLORS.actual}
                  name="Actual"
                  radius={[8, 8, 0, 0]}
                />
                <Bar 
                  yAxisId="left"
                  dataKey="forecast" 
                  fill={COLORS.forecast}
                  name="Forecast"
                  radius={[8, 8, 0, 0]}
                  opacity={0.6}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="avgCheck" 
                  stroke={COLORS.avgCheck}
                  strokeWidth={2}
                  name="Avg Check"
                  dot={{ fill: COLORS.avgCheck, r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* Channel Breakdown Table */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Breakdown por Canal</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-muted-foreground">
                <th className="pb-3">Channel</th>
                <th className="pb-3 text-right">Actual</th>
                <th className="pb-3 text-right">Projected</th>
                <th className="pb-3 text-right">Avg Check (Actual)</th>
                <th className="pb-3 text-right">Avg Check (Projected)</th>
              </tr>
            </thead>
            <tbody>
              {channelTableData.map((row) => (
                <tr key={row.channel} className="border-b last:border-0">
                  <td className="py-4 font-medium">{row.channel}</td>
                  <td className="py-4 text-right">
                    <div>
                      <div className="font-semibold">€{row.actual.toLocaleString()}</div>
                      <VarianceIndicator value={row.actualVar} />
                    </div>
                  </td>
                  <td className="py-4 text-right">
                    <div>
                      <div className="font-semibold">€{row.projected.toLocaleString()}</div>
                      <VarianceIndicator value={row.projVar} />
                    </div>
                  </td>
                  <td className="py-4 text-right font-semibold">
                    €{row.avgCheck.toFixed(2)}
                  </td>
                  <td className="py-4 text-right font-semibold">
                    €{row.avgCheckProj.toFixed(2)}
                  </td>
                </tr>
              ))}
              <tr className="bg-muted/50 font-bold">
                <td className="py-4">Total</td>
                <td className="py-4 text-right">€36,159</td>
                <td className="py-4 text-right">€36,800</td>
                <td className="py-4 text-right">€23.70</td>
                <td className="py-4 text-right">€26.03</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Products Performance */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Top Products</h3>
          <Button variant="link" className="text-sm">Ver todos →</Button>
        </div>
        
        <div className="space-y-3">
          {productsData.map((product, idx) => (
            <div key={product.name} className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{product.name}</span>
                  <span className="text-sm font-semibold">€{product.value.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400"
                      style={{ width: `${product.pct * 5}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-muted-foreground w-16 text-right">
                    {product.pct.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
