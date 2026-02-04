/**
 * Sales Module - Nory-style with Real Data
 * Dynamic data from Supabase based on date range
 */

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown } from 'lucide-react';
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
import { useSalesData } from '@/hooks/useSalesData';

// Josephine colors matching Nory design
const COLORS = {
  actual: '#6366f1', // Indigo (dark purple)
  forecastLive: '#a5b4fc', // Light indigo (light purple)
  forecast: '#e0e7ff', // Very light indigo (lightest purple)
  avgCheck: '#fb923c', // Orange (dark)
  avgCheckForecast: '#fdba74', // Light orange
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

type LocationId = 'all' | 'salamanca' | 'chamberi' | 'malasana';

export default function Sales() {
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('week');
  const [startDate, setStartDate] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [endDate, setEndDate] = useState(endOfWeek(new Date(), { weekStartsOn: 1 }));
  const [compareMode, setCompareMode] = useState('forecast');
  const [selectedLocation, setSelectedLocation] = useState<LocationId>('all');
  const [askJosephineOpen, setAskJosephineOpen] = useState(false);
  const [hourlyDrillDownOpen, setHourlyDrillDownOpen] = useState(false);
  const [selectedDayData, setSelectedDayData] = useState<any>(null);

  // Determine location IDs for API call
  const locationIdsForQuery = useMemo(() => {
    if (selectedLocation === 'all') return ['all'];
    return [selectedLocation];
  }, [selectedLocation]);

  // Fetch real sales data
  const { data: salesData, loading } = useSalesData({
    locationIds: locationIdsForQuery,
    startDate,
    endDate,
  });

  // Format chart data for Recharts (Nory-style)
  const chartData = useMemo(() => {
    if (!salesData?.dailyData) return [];
    
    return salesData.dailyData.map(day => ({
      day: format(new Date(day.date), 'EEEE, d'),
      dayShort: format(new Date(day.date), 'EEE'),
      actual: day.actual,
      forecastLive: day.forecastLive,
      forecast: day.forecast,
      avgCheck: day.avgCheck,
      avgCheckForecast: day.avgCheckForecast,
      tickets: day.tickets,
      covers: day.covers,
    }));
  }, [salesData]);

  // Generate hourly data for drill-down
  const generateHourlyData = (dayData: any) => {
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
    let totalOrders = dayData.tickets || 0;

    const hourlyData = operatingHours.map((slot) => {
      const actual = Math.round(totalActual * slot.weight * (0.9 + Math.random() * 0.2));
      const forecast = Math.round(totalForecast * slot.weight * (0.95 + Math.random() * 0.1));
      const orders = Math.round(totalOrders * slot.weight);
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
      day: dayData.dayShort,
      date: dayData.day,
      hourlyData,
      totalSales: totalActual,
      totalForecast: totalForecast,
      totalOrders: totalOrders,
    };
  };

  // Handle chart bar click for hourly drill-down
  const handleBarClick = (data: any) => {
    if (!data || !data.activePayload || !data.activePayload[0]) return;
    
    const dayData = data.activePayload[0].payload;
    const drillDownData = generateHourlyData(dayData);
    setSelectedDayData(drillDownData);
    setHourlyDrillDownOpen(true);
  };

  // Mock channel data (TODO: Get from backend)
  const channelData = [
    { channel: 'Dine-in', actual: 22330, actualVar: 0.9, avgCheckActual: 24.84, avgCheckActualVar: 8.35 },
    { channel: 'Pick-up', actual: 2862, actualVar: 133.5, avgCheckActual: 15.81, avgCheckActualVar: -26.93 },
    { channel: 'Delivery', actual: 10967, actualVar: -11.52, avgCheckActual: 24.59, avgCheckActualVar: 0.55 },
  ];

  // Sales data for AI assistant
  const salesDataForAI = useMemo(() => ({
    salesToDate: salesData?.totals?.sales || 0,
    salesToDateDelta: salesData?.totals?.variance || 0,
    avgCheckSize: salesData?.totals?.avgCheck || 0,
    avgCheckSizeDelta: 1.26,
    dwellTime: 42,
    channels: channelData.map(ch => ({
      channel: ch.channel,
      sales: ch.actual,
      salesDelta: ch.actualVar
    })),
    categories: [
      { category: 'Food', amount: Math.round((salesData?.totals?.sales || 0) * 0.95), ratio: 95 },
      { category: 'Beverage', amount: Math.round((salesData?.totals?.sales || 0) * 0.05), ratio: 5 },
    ],
    topProducts: [
      { name: 'Paella Valenciana', value: 4440, percentage: 12.31 },
      { name: 'Jamón Ibérico', value: 2202, percentage: 6.11 },
    ],
  }), [salesData, channelData]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando datos de ventas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1800px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Sales - {selectedLocation === 'all' ? 'All Locations' : selectedLocation}</h1>
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
              <span className="text-xs text-muted-foreground">
                {format(startDate, 'd MMM')} - {format(endDate, 'd MMM')}
              </span>
            </div>
            
            <div>
              <div className="text-3xl font-bold">€{Math.round(salesData?.totals?.sales || 0).toLocaleString()}</div>
              <VarianceIndicator value={salesData?.totals?.variance || 0} />
            </div>

            {/* Channel bars (mock) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-600"></div>
                  Dine-in
                </span>
                <span className="font-medium">62%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-purple-600" style={{width: '62%'}}></div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-cyan-600"></div>
                  Pick-up
                </span>
                <span className="font-medium">8%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-600" style={{width: '8%'}}></div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                  Delivery
                </span>
                <span className="font-medium">30%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600" style={{width: '30%'}}></div>
              </div>
            </div>
          </div>
        </Card>

        {/* Avg Check */}
        <Card className="p-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">Average check size</h3>
              <span className="text-xs text-muted-foreground">
                {format(startDate, 'd MMM')} - {format(endDate, 'd MMM')}
              </span>
            </div>
            
            <div>
              <div className="text-3xl font-bold">€{(salesData?.totals?.avgCheck || 0).toFixed(2)}</div>
              <VarianceIndicator value={1.26} />
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-600"></div>
                  Dine-in
                </span>
                <span className="font-semibold">€24.84</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                  Pick-up
                </span>
                <span className="font-semibold">€15.81</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                  Delivery
                </span>
                <span className="font-semibold">€24.60</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Dwell Time */}
        <Card className="p-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">Dwell time</h3>
              <span className="text-xs text-muted-foreground">
                {format(startDate, 'd MMM')} - {format(endDate, 'd MMM')}
              </span>
            </div>
            <div className="text-3xl font-bold">42mins</div>
          </div>
        </Card>
      </div>

      {/* Chart Section - Nory Style */}
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
                <ComposedChart data={chartData} onClick={handleBarClick}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="dayShort" />
                  <YAxis yAxisId="left" tickFormatter={(v) => `£${(v/1000).toFixed(0)}K`} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `£${v}`} />
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
                                <span className="font-semibold">€{payload[2]?.value?.toLocaleString()}</span>
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
                  {/* Actual - Dark purple bar */}
                  <Bar 
                    yAxisId="left" 
                    dataKey="actual" 
                    fill={COLORS.actual} 
                    name="Actual" 
                    radius={[4,4,0,0]}
                    cursor="pointer"
                  />
                  {/* Forecast (Live) - Light purple bar */}
                  <Bar 
                    yAxisId="left" 
                    dataKey="forecastLive" 
                    fill={COLORS.forecastLive} 
                    name="Forecast (Live)" 
                    radius={[4,4,0,0]}
                    cursor="pointer"
                  />
                  {/* Forecast - Lightest purple bar */}
                  <Bar 
                    yAxisId="left" 
                    dataKey="forecast" 
                    fill={COLORS.forecast} 
                    name="Forecast" 
                    radius={[4,4,0,0]}
                    cursor="pointer"
                  />
                  {/* Avg Check Size - Dark orange line */}
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="avgCheck" 
                    stroke={COLORS.avgCheck} 
                    strokeWidth={2} 
                    name="Avg Check Size" 
                    dot={{ r: 3 }}
                  />
                  {/* Avg Check Forecast - Light orange line */}
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="avgCheckForecast" 
                    stroke={COLORS.avgCheckForecast} 
                    strokeWidth={2} 
                    name="Avg Check Forecast" 
                    dot={{ r: 3 }}
                    strokeDasharray="5 5"
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
              <TableHead>Actual<br/><span className="text-xs text-muted-foreground">
                {format(startDate, 'd MMM')} - {format(endDate, 'd MMM')}
              </span></TableHead>
              <TableHead>Avg Check (Actual)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {channelData.map((row) => (
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
                    <VarianceIndicator value={row.avgCheckActualVar} />
                    <div className="font-semibold">€{row.avgCheckActual.toFixed(2)}</div>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

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
