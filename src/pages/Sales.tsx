/**
 * Sales Module - Complete Nory-style Implementation
 * All sections: KPIs, Chart, Channel Table, Products, Locations
 */

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown,
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
import { AskJosephineSalesDrawer, HourlyDrillDownDrawer, DateRangePicker, DateRangePreset } from '@/components/sales';
import { startOfWeek, endOfWeek, format } from 'date-fns';

// Josephine colors - Nory style
const COLORS = {
  actual: '#6366f1', // Dark indigo/purple for Actual
  forecastLive: '#a5b4fc', // Medium indigo/purple for Forecast (Live)
  forecast: '#e0e7ff', // Light indigo/purple for Forecast
  avgCheck: '#fb923c', // Dark orange for Avg Check Size
  avgCheckForecast: '#fdba74', // Light orange for Avg Check Forecast
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

// Types for location data
type LocationId = 'all' | 'salamanca' | 'chamberi' | 'malasana';

interface LocationData {
  id: LocationId;
  name: string;
  kpiData: any;
  weeklyChartData: any[];
  channelTableData: any[];
  productsData: Array<{ name: string; value: number; pct: number; qty: number; qtyPct: number }>;
  categoryData: any[];
}

export default function Sales() {
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('week');
  const [startDate, setStartDate] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [endDate, setEndDate] = useState(endOfWeek(new Date(), { weekStartsOn: 1 }));
  const [compareMode, setCompareMode] = useState('forecast');
  const [selectedLocation, setSelectedLocation] = useState<LocationId>('all');
  const [productViewMode, setProductViewMode] = useState<'sales' | 'qty'>('sales');
  const [productsDisplayCount, setProductsDisplayCount] = useState(10);
  const [askJosephineOpen, setAskJosephineOpen] = useState(false);
  const [hourlyDrillDownOpen, setHourlyDrillDownOpen] = useState(false);
  const [selectedDayData, setSelectedDayData] = useState<{
    day: string;
    date: string;
    hourlyData: any[];
    totalSales: number;
    totalForecast: number;
    totalOrders: number;
  } | null>(null);

  // Location-specific data
  const locationsData: Record<LocationId, Omit<LocationData, 'id'>> = {
    all: {
      name: 'All Locations',
      kpiData: {
        salesToDate: { value: 36066, variance: 0.94, dateRange: '29 Sep - 1 Oct' },
        avgCheck: { value: 23.70, variance: 1.26, dateRange: '29 Sep - 1 Oct' },
        dwellTime: { value: '42mins', dateRange: '29 Sep - 1 Oct' },
        channels: {
          dineIn: { pct: 62, avgCheck: 24.84 },
          pickUp: { pct: 8, avgCheck: 15.81 },
          delivery: { pct: 30, avgCheck: 24.60 },
        },
      },
      weeklyChartData: [
        { day: 'Mon', actual: 12500, forecastLive: 12350, forecast: 12200, avgCheck: 24.20, avgCheckForecast: 24.00 },
        { day: 'Tue', actual: 13800, forecastLive: 13500, forecast: 13200, avgCheck: 24.50, avgCheckForecast: 24.30 },
        { day: 'Wed', actual: 10421, forecastLive: 10300, forecast: 10194, avgCheck: 24.41, avgCheckForecast: 24.20 },
        { day: 'Thu', actual: 0, forecastLive: 15350, forecast: 15200, avgCheck: 24.80, avgCheckForecast: 24.60 },
        { day: 'Fri', actual: 0, forecastLive: 18650, forecast: 18500, avgCheck: 25.20, avgCheckForecast: 25.00 },
        { day: 'Sat', actual: 0, forecastLive: 22450, forecast: 22300, avgCheck: 26.50, avgCheckForecast: 26.30 },
        { day: 'Sun', actual: 0, forecastLive: 16950, forecast: 16800, avgCheck: 25.00, avgCheckForecast: 24.80 },
      ],
      channelTableData: [
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
      ],
      productsData: [
        { name: 'Paella Valenciana', value: 4440.24, pct: 12.31, qty: 240, qtyPct: 15.2 },
        { name: 'Jamón Ibérico', value: 2202.06, pct: 6.11, qty: 180, qtyPct: 11.4 },
        { name: 'Chuletón de Buey', value: 2159.16, pct: 5.99, qty: 85, qtyPct: 5.4 },
        { name: 'Pulpo a la Gallega', value: 1752.68, pct: 4.86, qty: 120, qtyPct: 7.6 },
        { name: 'Croquetas Premium', value: 1704.20, pct: 4.73, qty: 220, qtyPct: 13.9 },
        { name: 'Bacalao Pil-Pil', value: 1515.05, pct: 4.20, qty: 95, qtyPct: 6.0 },
        { name: 'Cochinillo Asado', value: 1249.02, pct: 3.46, qty: 48, qtyPct: 3.0 },
        { name: 'Tortilla Española', value: 1032.55, pct: 2.86, qty: 165, qtyPct: 10.4 },
        { name: 'Gazpacho Andaluz', value: 892.40, pct: 2.47, qty: 145, qtyPct: 9.2 },
        { name: 'Rabo de Toro', value: 825.60, pct: 2.29, qty: 52, qtyPct: 3.3 },
        { name: 'Calamares Romana', value: 768.90, pct: 2.13, qty: 98, qtyPct: 6.2 },
        { name: 'Solomillo Wellington', value: 715.20, pct: 1.98, qty: 28, qtyPct: 1.8 },
        { name: 'Merluza Vasca', value: 682.50, pct: 1.89, qty: 65, qtyPct: 4.1 },
        { name: 'Ensalada Mixta', value: 445.80, pct: 1.24, qty: 112, qtyPct: 7.1 },
        { name: 'Carrilleras Ibéricas', value: 398.40, pct: 1.10, qty: 35, qtyPct: 2.2 },
      ],
      categoryData: [
        { name: 'Food', value: 94.76, amount: 32740 },
        { name: 'Beverage', value: 5.24, amount: 1811 },
        { name: 'Other', value: 0, amount: 0 },
      ],
    },
    salamanca: {
      name: 'La Taberna Centro (Salamanca)',
      kpiData: {
        salesToDate: { value: 12580, variance: 2.1, dateRange: '29 Sep - 1 Oct' },
        avgCheck: { value: 26.50, variance: 3.2, dateRange: '29 Sep - 1 Oct' },
        dwellTime: { value: '48mins', dateRange: '29 Sep - 1 Oct' },
        channels: {
          dineIn: { pct: 75, avgCheck: 28.20 },
          pickUp: { pct: 5, avgCheck: 18.50 },
          delivery: { pct: 20, avgCheck: 22.80 },
        },
      },
      weeklyChartData: [
        { day: 'Mon', actual: 4200, forecastLive: 4150, forecast: 4100, avgCheck: 26.80, avgCheckForecast: 26.60 },
        { day: 'Tue', actual: 4650, forecastLive: 4525, forecast: 4400, avgCheck: 27.20, avgCheckForecast: 27.00 },
        { day: 'Wed', actual: 3730, forecastLive: 3665, forecast: 3600, avgCheck: 26.10, avgCheckForecast: 25.90 },
        { day: 'Thu', actual: 0, forecastLive: 5150, forecast: 5100, avgCheck: 27.50, avgCheckForecast: 27.30 },
        { day: 'Fri', actual: 0, forecastLive: 6250, forecast: 6200, avgCheck: 28.00, avgCheckForecast: 27.80 },
        { day: 'Sat', actual: 0, forecastLive: 7550, forecast: 7500, avgCheck: 29.00, avgCheckForecast: 28.80 },
        { day: 'Sun', actual: 0, forecastLive: 5650, forecast: 5600, avgCheck: 27.80, avgCheckForecast: 27.60 },
      ],
      channelTableData: [
        { 
          channel: 'Dine-in', 
          actual: 9435, actualVar: 2.5, 
          projected: 30120, projVar: 1.8,
          avgCheckActual: 28.20, avgCheckActualVar: 9.2,
          avgCheckProj: 29.50, avgCheckProjVar: 3.5,
        },
        { 
          channel: 'Pick-up', 
          actual: 629, actualVar: 150.0, 
          projected: 1890, projVar: 35.0,
          avgCheckActual: 18.50, avgCheckActualVar: -20.0,
          avgCheckProj: 21.00, avgCheckProjVar: -10.0,
        },
        { 
          channel: 'Delivery', 
          actual: 2516, actualVar: -8.0, 
          projected: 10080, projVar: -2.5,
          avgCheckActual: 22.80, avgCheckActualVar: 1.2,
          avgCheckProj: 24.00, avgCheckProjVar: 0.8,
        },
      ],
      productsData: [
        { name: 'Chuletón de Buey', value: 1850.50, pct: 14.71, qty: 72, qtyPct: 16.8 },
        { name: 'Jamón Ibérico', value: 1520.80, pct: 12.09, qty: 125, qtyPct: 29.2 },
        { name: 'Paella Valenciana', value: 1380.25, pct: 10.97, qty: 75, qtyPct: 17.5 },
        { name: 'Solomillo Wellington', value: 980.60, pct: 7.80, qty: 38, qtyPct: 8.9 },
        { name: 'Bacalao Pil-Pil', value: 850.40, pct: 6.76, qty: 53, qtyPct: 12.4 },
      ],
      categoryData: [
        { name: 'Food', value: 96.2, amount: 12102 },
        { name: 'Beverage', value: 3.8, amount: 478 },
        { name: 'Other', value: 0, amount: 0 },
      ],
    },
    chamberi: {
      name: 'Chamberí (Madrid)',
      kpiData: {
        salesToDate: { value: 11720, variance: 1.2, dateRange: '29 Sep - 1 Oct' },
        avgCheck: { value: 22.80, variance: 0.8, dateRange: '29 Sep - 1 Oct' },
        dwellTime: { value: '40mins', dateRange: '29 Sep - 1 Oct' },
        channels: {
          dineIn: { pct: 58, avgCheck: 23.50 },
          pickUp: { pct: 10, avgCheck: 16.20 },
          delivery: { pct: 32, avgCheck: 25.10 },
        },
      },
      weeklyChartData: [
        { day: 'Mon', actual: 4050, forecastLive: 4025, forecast: 4000, avgCheck: 23.10, avgCheckForecast: 22.90 },
        { day: 'Tue', actual: 4480, forecastLive: 4390, forecast: 4300, avgCheck: 23.50, avgCheckForecast: 23.30 },
        { day: 'Wed', actual: 3190, forecastLive: 3155, forecast: 3120, avgCheck: 22.20, avgCheckForecast: 22.00 },
        { day: 'Thu', actual: 0, forecastLive: 5000, forecast: 4950, avgCheck: 23.80, avgCheckForecast: 23.60 },
        { day: 'Fri', actual: 0, forecastLive: 6100, forecast: 6050, avgCheck: 24.50, avgCheckForecast: 24.30 },
        { day: 'Sat', actual: 0, forecastLive: 7350, forecast: 7300, avgCheck: 25.20, avgCheckForecast: 25.00 },
        { day: 'Sun', actual: 0, forecastLive: 5530, forecast: 5480, avgCheck: 24.00, avgCheckForecast: 23.80 },
      ],
      channelTableData: [
        { 
          channel: 'Dine-in', 
          actual: 6798, actualVar: 1.5, 
          projected: 22050, projVar: 0.8,
          avgCheckActual: 23.50, avgCheckActualVar: 7.8,
          avgCheckProj: 25.20, avgCheckProjVar: 2.5,
        },
        { 
          channel: 'Pick-up', 
          actual: 1172, actualVar: 120.0, 
          projected: 2890, projVar: 28.0,
          avgCheckActual: 16.20, avgCheckActualVar: -28.0,
          avgCheckProj: 18.80, avgCheckProjVar: -16.0,
        },
        { 
          channel: 'Delivery', 
          actual: 3750, actualVar: -10.0, 
          projected: 13680, projVar: -3.2,
          avgCheckActual: 25.10, avgCheckActualVar: 0.8,
          avgCheckProj: 26.50, avgCheckProjVar: 0.5,
        },
      ],
      productsData: [
        { name: 'Paella Valenciana', value: 1680.50, pct: 14.33, qty: 91, qtyPct: 18.5 },
        { name: 'Croquetas Premium', value: 980.30, pct: 8.36, qty: 126, qtyPct: 25.6 },
        { name: 'Pulpo a la Gallega', value: 850.20, pct: 7.25, qty: 58, qtyPct: 11.8 },
        { name: 'Tortilla Española', value: 620.80, pct: 5.30, qty: 99, qtyPct: 20.1 },
        { name: 'Gazpacho Andaluz', value: 550.40, pct: 4.70, qty: 89, qtyPct: 18.1 },
      ],
      categoryData: [
        { name: 'Food', value: 93.8, amount: 10993 },
        { name: 'Beverage', value: 6.2, amount: 727 },
        { name: 'Other', value: 0, amount: 0 },
      ],
    },
    malasana: {
      name: 'Malasaña (Madrid)',
      kpiData: {
        salesToDate: { value: 11766, variance: -0.5, dateRange: '29 Sep - 1 Oct' },
        avgCheck: { value: 21.90, variance: 0.2, dateRange: '29 Sep - 1 Oct' },
        dwellTime: { value: '38mins', dateRange: '29 Sep - 1 Oct' },
        channels: {
          dineIn: { pct: 55, avgCheck: 22.80 },
          pickUp: { pct: 12, avgCheck: 14.50 },
          delivery: { pct: 33, avgCheck: 24.20 },
        },
      },
      weeklyChartData: [
        { day: 'Mon', actual: 4250, forecastLive: 4175, forecast: 4100, avgCheck: 22.50, avgCheckForecast: 22.30 },
        { day: 'Tue', actual: 4670, forecastLive: 4585, forecast: 4500, avgCheck: 22.80, avgCheckForecast: 22.60 },
        { day: 'Wed', actual: 2501, forecastLive: 2487, forecast: 2474, avgCheck: 20.50, avgCheckForecast: 20.30 },
        { day: 'Thu', actual: 0, forecastLive: 5200, forecast: 5150, avgCheck: 22.30, avgCheckForecast: 22.10 },
        { day: 'Fri', actual: 0, forecastLive: 6300, forecast: 6250, avgCheck: 23.70, avgCheckForecast: 23.50 },
        { day: 'Sat', actual: 0, forecastLive: 7550, forecast: 7500, avgCheck: 24.80, avgCheckForecast: 24.60 },
        { day: 'Sun', actual: 0, forecastLive: 5770, forecast: 5720, avgCheck: 23.20, avgCheckForecast: 23.00 },
      ],
      channelTableData: [
        { 
          channel: 'Dine-in', 
          actual: 6471, actualVar: -0.8, 
          projected: 19675, projVar: -0.5,
          avgCheckActual: 22.80, avgCheckActualVar: 8.1,
          avgCheckProj: 24.80, avgCheckProjVar: 2.2,
        },
        { 
          channel: 'Pick-up', 
          actual: 1412, actualVar: 128.0, 
          projected: 2333, projVar: 24.5,
          avgCheckActual: 14.50, avgCheckActualVar: -32.0,
          avgCheckProj: 17.20, avgCheckProjVar: -18.0,
        },
        { 
          channel: 'Delivery', 
          actual: 3883, actualVar: -14.2, 
          projected: 16205, projVar: -4.8,
          avgCheckActual: 24.20, avgCheckActualVar: -0.2,
          avgCheckProj: 25.80, avgCheckProjVar: 0.1,
        },
      ],
      productsData: [
        { name: 'Paella Valenciana', value: 1379.49, pct: 11.73, qty: 74, qtyPct: 14.2 },
        { name: 'Jamón Ibérico', value: 681.26, pct: 5.79, qty: 55, qtyPct: 10.5 },
        { name: 'Croquetas Premium', value: 723.90, pct: 6.15, qty: 94, qtyPct: 18.0 },
        { name: 'Pulpo a la Gallega', value: 902.48, pct: 7.67, qty: 62, qtyPct: 11.9 },
        { name: 'Calamares Romana', value: 530.20, pct: 4.51, qty: 68, qtyPct: 13.0 },
      ],
      categoryData: [
        { name: 'Food', value: 94.1, amount: 11072 },
        { name: 'Beverage', value: 5.9, amount: 694 },
        { name: 'Other', value: 0, amount: 0 },
      ],
    },
  };

  // Get current location data
  const currentLocationData = useMemo(() => {
    return locationsData[selectedLocation];
  }, [selectedLocation]);

  const kpiData = currentLocationData.kpiData;

  const weeklyChartData = currentLocationData.weeklyChartData;
  const channelTableData = currentLocationData.channelTableData;
  const productsData = currentLocationData.productsData;
  const categoryData = currentLocationData.categoryData;

  // Products to display based on pagination
  const displayedProducts = productsData.slice(0, productsDisplayCount);
  const hasMoreProducts = productsDisplayCount < productsData.length;

  // Generate hourly data for a specific day
  const generateHourlyData = (dayData: any, dayName: string, dayDate: string) => {
    const operatingHours = [
      { hour: '10:00', weight: 0.02 },
      { hour: '11:00', weight: 0.04 },
      { hour: '12:00', weight: 0.08 },
      { hour: '13:00', weight: 0.12 },
      { hour: '14:00', weight: 0.14 },
      { hour: '15:00', weight: 0.08 },
      { hour: '16:00', weight: 0.04 },
      { hour: '17:00', weight: 0.05 },
      { hour: '18:00', weight: 0.07 },
      { hour: '19:00', weight: 0.10 },
      { hour: '20:00', weight: 0.12 },
      { hour: '21:00', weight: 0.10 },
      { hour: '22:00', weight: 0.04 },
    ];

    const totalActual = dayData.actual || 0;
    const totalForecast = dayData.forecast || 0;
    let totalOrders = 0;

    const hourlyData = operatingHours.map((slot, index) => {
      const actual = Math.round(totalActual * slot.weight * (0.9 + Math.random() * 0.2));
      const forecast = Math.round(totalForecast * slot.weight * (0.95 + Math.random() * 0.1));
      const orders = Math.round(actual / (dayData.avgCheck || 24));
      totalOrders += orders;
      const variance = forecast > 0 ? ((actual - forecast) / forecast) * 100 : 0;

      return {
        hour: slot.hour,
        actual,
        forecast,
        avgCheck: orders > 0 ? actual / orders : dayData.avgCheck || 24,
        orders,
        variance,
      };
    });

    return {
      day: dayName,
      date: dayDate,
      hourlyData,
      totalSales: totalActual,
      totalForecast: totalForecast,
      totalOrders,
    };
  };

  // Handle chart bar click
  const handleBarClick = (data: any) => {
    if (!data || !data.activePayload || !data.activePayload[0]) return;
    
    const dayData = data.activePayload[0].payload;
    const dayName = dayData.day;
    const dayDate = '1 Oct 2024'; // You could calculate this based on the actual date
    
    const drillDownData = generateHourlyData(dayData, dayName, dayDate);
    setSelectedDayData(drillDownData);
    setHourlyDrillDownOpen(true);
  };

  // Sales data for AI assistant
  const salesDataForAI = useMemo(() => ({
    salesToDate: kpiData.salesToDate.value,
    salesToDateDelta: kpiData.salesToDate.variance,
    avgCheckSize: kpiData.avgCheck.value,
    avgCheckSizeDelta: kpiData.avgCheck.variance,
    dwellTime: kpiData.dwellTime.value === '42mins' ? 42 : (kpiData.dwellTime.value === '48mins' ? 48 : (kpiData.dwellTime.value === '40mins' ? 40 : 38)),
    channels: channelTableData.map(ch => ({
      channel: ch.channel,
      sales: ch.actual,
      salesDelta: ch.actualVar
    })),
    categories: categoryData.map(cat => ({
      category: cat.name,
      amount: cat.amount,
      ratio: cat.value
    })),
    topProducts: productsData.slice(0, 5).map(p => ({
      name: p.name,
      value: p.value,
      percentage: p.pct
    }))
  }), [kpiData, channelTableData, categoryData, productsData]);

  return (
    <div className="p-6 space-y-6 max-w-[1800px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Sales</h1>
        <div className="flex items-center gap-3">
          {/* Location Selector */}
          <Select value={selectedLocation} onValueChange={(value) => setSelectedLocation(value as LocationId)}>
            <SelectTrigger className="w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">✓ All Locations</SelectItem>
              <SelectItem value="salamanca">La Taberna Centro (Salamanca)</SelectItem>
              <SelectItem value="chamberi">Chamberí (Madrid)</SelectItem>
              <SelectItem value="malasana">Malasaña (Madrid)</SelectItem>
            </SelectContent>
          </Select>

          <DateRangePicker
            selectedPreset={dateRangePreset}
            onPresetChange={setDateRangePreset}
            startDate={startDate}
            endDate={endDate}
            onDateRangeChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
            }}
          />
          
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

          <Button variant="outline" onClick={() => setAskJosephineOpen(true)}>
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
                <ComposedChart data={weeklyChartData} onClick={handleBarClick}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="day" />
                  <YAxis yAxisId="left" tickFormatter={(v) => `€${(v/1000).toFixed(0)}K`} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `€${v}`} />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white border rounded-lg shadow-lg p-3">
                            <p className="font-semibold mb-2">{payload[0].payload.day}</p>
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center justify-between gap-4">
                                <span>Actual:</span>
                                <span className="font-semibold">€{payload[0].value?.toLocaleString()}</span>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span>Forecast:</span>
                                <span className="font-semibold">€{payload[1].value?.toLocaleString()}</span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-2 border-t pt-1">
                                Click para ver detalles por hora
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  {/* 3 Barras - Nory Style */}
                  <Bar 
                    yAxisId="left" 
                    dataKey="actual" 
                    fill={COLORS.actual} 
                    name="Actual" 
                    radius={[4,4,0,0]}
                    cursor="pointer"
                  />
                  <Bar 
                    yAxisId="left" 
                    dataKey="forecastLive" 
                    fill={COLORS.forecastLive} 
                    name="Forecast (Live)" 
                    radius={[4,4,0,0]}
                    cursor="pointer"
                  />
                  <Bar 
                    yAxisId="left" 
                    dataKey="forecast" 
                    fill={COLORS.forecast} 
                    name="Forecast" 
                    radius={[4,4,0,0]}
                    cursor="pointer"
                  />
                  {/* 2 Líneas de Avg Check - Nory Style */}
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="avgCheck" 
                    stroke={COLORS.avgCheck} 
                    strokeWidth={2} 
                    name="Avg Check Size"
                    dot={{ r: 3 }}
                  />
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="avgCheckForecast" 
                    stroke={COLORS.avgCheckForecast} 
                    strokeWidth={2} 
                    name="Avg Check Forecast"
                    strokeDasharray="5 5"
                    dot={{ r: 3 }}
                  />
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
            <Select value={productViewMode} onValueChange={(value: 'sales' | 'qty') => setProductViewMode(value)}>
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
            {displayedProducts.map((product) => {
              const displayValue = productViewMode === 'sales' ? product.value : product.qty;
              const displayPct = productViewMode === 'sales' ? product.pct : product.qtyPct;
              const formattedValue = productViewMode === 'sales' 
                ? `€${product.value.toLocaleString()}` 
                : `${product.qty} units`;
              
              return (
                <div key={product.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{product.name}</span>
                    <span className="text-sm font-semibold">{formattedValue}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400"
                        style={{ width: `${Math.min(displayPct * 5, 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-muted-foreground w-14 text-right">
                      {displayPct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
            {hasMoreProducts && (
              <Button 
                variant="link" 
                className="w-full text-sm"
                onClick={() => setProductsDisplayCount(prev => Math.min(prev + 10, productsData.length))}
              >
                Scroll to See More ↓
              </Button>
            )}
          </div>
        </Card>
      </div>

      {/* Ask Josephine Drawer */}
      <AskJosephineSalesDrawer 
        open={askJosephineOpen}
        onOpenChange={setAskJosephineOpen}
        salesData={salesDataForAI}
      />

      {/* Hourly Drill-Down Drawer */}
      {selectedDayData && (
        <HourlyDrillDownDrawer
          open={hourlyDrillDownOpen}
          onOpenChange={setHourlyDrillDownOpen}
          selectedDay={selectedDayData.day}
          selectedDate={selectedDayData.date}
          hourlyData={selectedDayData.hourlyData}
          totalSales={selectedDayData.totalSales}
          totalForecast={selectedDayData.totalForecast}
          totalOrders={selectedDayData.totalOrders}
        />
      )}
    </div>
  );
}
