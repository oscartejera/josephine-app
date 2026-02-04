/**
 * Sales Module - Complete Nory-style Implementation
 * All sections: KPIs, Chart, Channel Table, Products, Locations
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Josephine colors
const COLORS = {
  actual: '#6366f1', // Indigo
  forecast: '#0ea5e9', // Sky blue  
  avgCheck: '#f59e0b', // Amber
  success: '#10b981',
  danger: '#f43f5e',
  dineIn: '#8b5cf6', // Purple
  pickUp: '#06b6d4', // Cyan
  delivery: '#3b82f6', // Blue
};

const VarianceIndicator = ({ value }: { value: number }) => {
  const isPositive = value >= 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', isPositive ? 'text-emerald-600' : 'text-rose-600')}>
      <Icon className="h-3 w-3" />
      {isPositive ? '+' : ''}{value.toFixed(2)}%
    </span>
  );
};

export default function Sales() {
  const [dateRange, setDateRange] = useState('week');
  const [compareMode, setCompareMode] = useState('forecast');

  // Realistic data matching Nory structure
  const kpiData = {
    salesToDate: { value: 36066, variance: 0.94, dateRange: '29 Sep - 1 Oct' },
    avgCheck: { value: 23.70, variance: 1.26, dateRange: '29 Sep - 1 Oct' },
    dwellTime: { value: '42mins', dateRange: '29 Sep - 1 Oct' },
    channels: {
      dineIn: { pct: 62, avgCheck: 24.84 },
      pickUp: { pct: 8, avgCheck: 15.81 },
      delivery: { pct: 30, avgCheck: 24.60 },
    },
  };

  const weeklyChartData = [
    { day: 'Mon', actual: 12500, forecast: 12200, avgCheck: 24.20 },
    { day: 'Tue', actual: 13800, forecast: 13200, avgCheck: 24.50 },
    { day: 'Wed', actual: 10421, forecast: 10194, avgCheck: 24.41 },
    { day: 'Thu', actual: 0, forecast: 15200, avgCheck: 24.80 },
    { day: 'Fri', actual: 0, forecast: 18500, avgCheck: 25.20 },
    { day: 'Sat', actual: 0, forecast: 22300, avgCheck: 26.50 },
    { day: 'Sun', actual: 0, forecast: 16800, avgCheck: 25.00 },
  ];

  const channelTableData = [
    { 
      channel: 'Dine-in', 
      actual: 22330, actualVar: 0.9, 
      projected: 71845, projVar: 0.28,
      avgCheckActual: 24.84, avgCheckActualVar: 8.35,
      avgCheckProj: 26.85, avgCheckProjVar: 2.77,
    },
    { 
      channel: 'Pick-up', 
      actual: 2862, actualVar: 133.5, 
      projected: 7113, projVar: 29.88,
      avgCheckActual: 15.81, avgCheckActualVar: -26.93,
      avgCheckProj: 19.54, avgCheckProjVar: -14.49,
    },
    { 
      channel: 'Delivery', 
      actual: 10967, actualVar: -11.52, 
      projected: 39965, projVar: -3.45,
      avgCheckActual: 24.59, avgCheckActualVar: 0.55,
      avgCheckProj: 26.15, avgCheckProjVar: 0.4,
    },
  ];

  const productsData = [
    { name: 'Paella Valenciana', value: 4440.24, pct: 12.31 },
    { name: 'Jamón Ibérico', value: 2202.06, pct: 6.11 },
    { name: 'Chuletón de Buey', value: 2159.16, pct: 5.99 },
    { name: 'Pulpo a la Gallega', value: 1752.68, pct: 4.86 },
    { name: 'Croquetas Premium', value: 1704.20, pct: 4.73 },
    { name: 'Bacalao Pil-Pil', value: 1515.05, pct: 4.20 },
    { name: 'Cochinillo Asado', value: 1249.02, pct: 3.46 },
    { name: 'Tortilla Española', value: 1032.55, pct: 2.86 },
  ];

  const categoryData = [
    { name: 'Food', value: 94.76, amount: 32740 },
    { name: 'Beverage', value: 5.24, amount: 1811 },
    { name: 'Other', value: 0, amount: 0 },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1800px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Sales</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 border rounded-lg p-1">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" className="h-8 px-3">
              <Calendar className="h-4 w-4 mr-2" />
              This Week
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <Select value={compareMode} onValueChange={setCompareMode}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="forecast">vs Forecast</SelectItem>
              <SelectItem value="last_week">vs Last Week</SelectItem>
              <SelectItem value="last_month">vs Last Month</SelectItem>
              <SelectItem value="last_year">vs Last Year</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline">
            ✨ Ask Josephine
          </Button>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        {/* Sales to Date */}
        <Card className="p-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">Sales to Date</h3>
              <span className="text-xs text-muted-foreground">{kpiData.salesToDate.dateRange}</span>
            </div>
            
            <div>
              <div className="text-3xl font-bold">€{kpiData.salesToDate.value.toLocaleString()}</div>
              <VarianceIndicator value={kpiData.salesToDate.variance} />
            </div>

            {/* Channel bars */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS.dineIn}}></div>
                  Dine-in
                </span>
                <span className="font-medium">{kpiData.channels.dineIn.pct}%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full" style={{backgroundColor: COLORS.dineIn, width: `${kpiData.channels.dineIn.pct}%`}}></div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS.pickUp}}></div>
                  Pick-up
                </span>
                <span className="font-medium">{kpiData.channels.pickUp.pct}%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full" style={{backgroundColor: COLORS.pickUp, width: `${kpiData.channels.pickUp.pct}%`}}></div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS.delivery}}></div>
                  Delivery
                </span>
                <span className="font-medium">{kpiData.channels.delivery.pct}%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full" style={{backgroundColor: COLORS.delivery, width: `${kpiData.channels.delivery.pct}%`}}></div>
              </div>
            </div>
          </div>
        </Card>

        {/* Avg Check */}
        <Card className="p-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">Avg Check</h3>
              <span className="text-xs text-muted-foreground">{kpiData.avgCheck.dateRange}</span>
            </div>
            
            <div>
              <div className="text-3xl font-bold">€{kpiData.avgCheck.value.toFixed(2)}</div>
              <VarianceIndicator value={kpiData.avgCheck.variance} />
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                  Dine-in
                </span>
                <span className="font-semibold">€{kpiData.channels.dineIn.avgCheck.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                  Pick-up
                </span>
                <span className="font-semibold">€{kpiData.channels.pickUp.avgCheck.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                  Delivery
                </span>
                <span className="font-semibold">€{kpiData.channels.delivery.avgCheck.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Dwell Time */}
        <Card className="p-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">Dwell Time</h3>
              <span className="text-xs text-muted-foreground">{kpiData.dwellTime.dateRange}</span>
            </div>
            <div className="text-3xl font-bold">{kpiData.dwellTime.value}</div>
          </div>
        </Card>
      </div>

      {/* Chart Section */}
      <Card className="p-6">
        <Tabs defaultValue="sales">
          <TabsList>
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="sales" className="mt-6">
            <h3 className="text-lg font-semibold mb-4">Sales v Forecast</h3>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={weeklyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="day" />
                  <YAxis yAxisId="left" tickFormatter={(v) => `€${(v/1000).toFixed(0)}K`} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `€${v}`} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="actual" fill={COLORS.actual} name="Actual" radius={[8,8,0,0]} />
                  <Bar yAxisId="left" dataKey="forecast" fill={COLORS.forecast} name="Forecast" radius={[8,8,0,0]} opacity={0.6} />
                  <Line yAxisId="right" type="monotone" dataKey="avgCheck" stroke={COLORS.avgCheck} strokeWidth={2} name="Avg Check" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Channel Breakdown Table */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Channel Breakdown</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Channel</TableHead>
              <TableHead>Actual<br/><span className="text-xs text-muted-foreground">29 Sep - 1 Oct</span></TableHead>
              <TableHead>Projected<br/><span className="text-xs text-muted-foreground">29 Sep - 5 Oct</span></TableHead>
              <TableHead>Avg Check (Actual)</TableHead>
              <TableHead>Avg Check (Projected)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {channelTableData.map((row) => (
              <TableRow key={row.channel}>
                <TableCell className="font-medium">{row.channel}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <VarianceIndicator value={row.actualVar} />
                    <div className="font-semibold">€{row.actual.toLocaleString()}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <VarianceIndicator value={row.projVar} />
                    <div className="font-semibold">€{row.projected.toLocaleString()}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <VarianceIndicator value={row.avgCheckActualVar} />
                    <div className="font-semibold">€{row.avgCheckActual.toFixed(2)}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <VarianceIndicator value={row.avgCheckProjVar} />
                    <div className="font-semibold">€{row.avgCheckProj.toFixed(2)}</div>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/50 font-bold">
              <TableCell>Total</TableCell>
              <TableCell>
                <div className="space-y-1">
                  <VarianceIndicator value={1.14} />
                  <div>€36,159</div>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <VarianceIndicator value={0.34} />
                  <div>€118,923</div>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <VarianceIndicator value={0.41} />
                  <div>€23.70 <span className="text-xs text-muted-foreground">AVG</span></div>
                </div>
              </TableCell>
              <TableCell>€26.03</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>

      {/* Product Categories + Products */}
      <div className="grid grid-cols-2 gap-6">
        {/* Categories */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Sales per Product Categories</h3>
          
          <div className="h-[200px] mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical">
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" />
                <Bar dataKey="value" fill={COLORS.actual} radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Ratio</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categoryData.map((cat) => (
                <TableRow key={cat.name}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS.actual}}></div>
                      {cat.name}
                    </span>
                  </TableCell>
                  <TableCell>{cat.value.toFixed(2)}%</TableCell>
                  <TableCell>€{cat.amount.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Products */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Products</h3>
            <Select defaultValue="sales">
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="qty">Quantity</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            {productsData.map((product) => (
              <div key={product.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{product.name}</span>
                  <span className="text-sm font-semibold">€{product.value.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400"
                      style={{ width: `${Math.min(product.pct * 8, 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-muted-foreground w-14 text-right">
                    {product.pct.toFixed(2)}%
                  </span>
                </div>
              </div>
            ))}
            <Button variant="link" className="w-full text-sm">
              Scroll to See More ↓
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
