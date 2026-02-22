/**
 * Sales Module - Real Data Implementation
 * Uses useBISalesData hook for real Supabase data with realtime updates.
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, BarChart,
} from 'recharts';
import { cn } from '@/lib/utils';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { AskJosephineSalesDrawer } from '@/components/sales';
import { DateRangePickerNoryLike, type DateMode, type DateRangeValue, type ChartGranularity } from '@/components/bi/DateRangePickerNoryLike';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useApp } from '@/contexts/AppContext';
import { useBISalesData, type CompareMode, type GranularityMode } from '@/hooks/useBISalesData';

// Josephine colors
const COLORS = {
  actual: '#6366f1',
  forecast: '#c7d2fe',
  avgCheck: '#f97316',
  avgCheckForecast: '#fed7aa',
  dineIn: '#8b5cf6',
  pickUp: '#06b6d4',
  delivery: '#3b82f6',
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
  const [dateMode, setDateMode] = useState<DateMode>('monthly');
  const [startDate, setStartDate] = useState(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState(endOfMonth(new Date()));
  const [compareMode, setCompareMode] = useState<CompareMode>('forecast');
  const [askJosephineOpen, setAskJosephineOpen] = useState(false);
  const [productsDisplayCount, setProductsDisplayCount] = useState(10);
  const { t } = useTranslation();

  const { selectedLocationId, accessibleLocations, loading: appLoading } = useApp();

  // Map global location to locationIds array for the hook
  const locationIds = useMemo(() => {
    if (!selectedLocationId || selectedLocationId === 'all') return [];
    return [selectedLocationId];
  }, [selectedLocationId]);

  // Map dateMode to granularity
  const granularity: GranularityMode = dateMode === 'daily' ? 'daily' : dateMode === 'weekly' ? 'weekly' : 'monthly';

  // Fetch REAL data from Supabase
  const { data: salesData, isLoading, isError, isConnected } = useBISalesData({
    dateRange: { from: startDate, to: endDate },
    granularity,
    compareMode,
    locationIds,
  });

  const handleDateChange = (range: DateRangeValue, mode: DateMode, _granularity: ChartGranularity) => {
    setStartDate(range.from);
    setEndDate(range.to);
    setDateMode(mode);
  };

  // Extract data from hook (with safe defaults)
  const kpis = salesData?.kpis;
  const chartData = salesData?.chartData || [];
  const channels = salesData?.channels || [];
  const categories = salesData?.categories || [];
  const products = salesData?.products || [];

  const dateLabel = `${format(startDate, 'd MMM')} - ${format(endDate, 'd MMM')}`;

  // Sales data for AI assistant
  const salesDataForAI = useMemo(() => ({
    salesToDate: kpis?.salesToDate || 0,
    salesToDateDelta: kpis?.salesToDateDelta || 0,
    avgCheckSize: kpis?.avgCheckSize || 0,
    avgCheckSizeDelta: kpis?.avgCheckSizeDelta || 0,
    dwellTime: kpis?.dwellTime ?? null,
    channels: channels.map(ch => ({ channel: ch.channel, sales: ch.sales, salesDelta: ch.salesDelta })),
    categories: categories.map(cat => ({ category: cat.category, amount: cat.amount, ratio: cat.ratio })),
    topProducts: products.slice(0, 5).map(p => ({ name: p.name, value: p.value, percentage: p.percentage })),
  }), [kpis, channels, categories, products]);

  if (appLoading || isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-[1800px]">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-96" />
        </div>
        <div className="grid grid-cols-3 gap-6">
          <Skeleton className="h-48" /><Skeleton className="h-48" /><Skeleton className="h-48" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 space-y-6 max-w-[1800px]">
        <h1 className="text-3xl font-bold">{t('sales.title')}</h1>
        <Card className="p-8 flex flex-col items-center justify-center text-center gap-3">
          <p className="text-lg font-medium text-destructive">{t('sales.failedToLoad')}</p>
          <p className="text-sm text-muted-foreground">{t('sales.tryRefreshing')}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1800px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{t('sales.title')}</h1>
          {isConnected && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <DateRangePickerNoryLike
            value={{ from: startDate, to: endDate }}
            onChange={handleDateChange}
            mode={dateMode}
            onModeChange={setDateMode}
          />
          <Select value={compareMode} onValueChange={(v) => setCompareMode(v as CompareMode)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="forecast">{t('common.vsForecast')}</SelectItem>
              <SelectItem value="previous_period">{t('common.vsLastPeriod')}</SelectItem>
              <SelectItem value="previous_year">{t('common.vsLastYear')}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setAskJosephineOpen(true)}>
            {t('sales.askJosephine')}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-6">
        {/* Sales to date */}
        <Card className="p-5 bg-white">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-normal text-gray-700">{t('sales.salesToDate')}</h3>
              <span className="text-xs text-gray-500">{dateLabel}</span>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-bold text-gray-900">
                {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(kpis?.salesToDate || 0)}
              </div>
              <div className="flex items-center gap-2">
                <VarianceIndicator value={kpis?.salesToDateDelta || 0} />
                <span className="text-xs text-gray-500">{t('common.vsForecast')}</span>
              </div>
            </div>
            {/* Channel breakdown — only if POS provides channel data */}
            {(kpis?.channelBreakdown?.length ?? 0) > 0 ? (
              <div className="space-y-2.5 pt-2">
                <div className="grid grid-cols-3 gap-4 text-xs">
                  {kpis!.channelBreakdown.map(ch => (
                    <div key={ch.channel} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-gray-400" />
                      <span className="text-gray-700">{ch.channel}</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm font-medium text-gray-900">
                  {kpis!.channelBreakdown.map(ch => (
                    <div key={ch.channel}>{ch.percentage}%</div>
                  ))}
                </div>
                <div className="w-full h-3 flex rounded-sm overflow-hidden">
                  {kpis!.channelBreakdown.map(ch => (
                    <div key={ch.channel} className="h-full bg-gray-400" style={{ width: `${ch.percentage}%` }} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="pt-2 text-xs text-gray-400 italic">
                Channel split requires POS channel tracking
              </div>
            )}
          </div>
        </Card>

        {/* Average check size */}
        <Card className="p-5 bg-white">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-normal text-gray-700">{t('sales.avgCheckSize')}</h3>
              <span className="text-xs text-gray-500">{dateLabel}</span>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-bold text-gray-900">
                {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(kpis?.avgCheckSize || 0)}
              </div>
              <div className="flex items-center gap-2">
                <VarianceIndicator value={kpis?.avgCheckSizeDelta || 0} />
                <span className="text-xs text-gray-500">{t('common.vsForecast')}</span>
              </div>
            </div>
            {/* ACS by channel */}
            <div className="space-y-2.5 pt-2">
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-orange-600" /><span className="text-gray-700">{t('sales.dineIn')}</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-orange-400" /><span className="text-gray-700">{t('sales.pickUp')}</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-orange-200" /><span className="text-gray-700">{t('sales.delivery')}</span></div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm font-medium text-gray-900">
                {(kpis?.acsBreakdown || []).map(ch => (
                  <div key={ch.channel}>{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(ch.value)}</div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Dwell time */}
        <Card className="p-5 bg-white">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-normal text-gray-700">{t('sales.dwellTime')}</h3>
              <span className="text-xs text-gray-500">{dateLabel}</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">42mins</div>
          </div>
        </Card>
      </div>

      {/* Chart */}
      <Card className="p-6">
        <Tabs defaultValue="sales">
          <TabsList><TabsTrigger value="sales">{t('sales.title')}</TabsTrigger></TabsList>
          <TabsContent value="sales" className="mt-6">
            <h3 className="text-base font-semibold mb-4">{t('sales.salesVsForecast')}</h3>
            <div className="h-[360px]">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} barGap={2} barCategoryGap="15%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                    <YAxis yAxisId="left" tickFormatter={(v) => `€${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `€${v.toFixed(0)}`} tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-white border rounded-lg shadow-xl p-3 text-sm">
                          <p className="font-semibold mb-2">{d.label}</p>
                          <p>{t('common.actual')}: <strong>{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(d.actual)}</strong></p>
                          <p>{t('common.forecast')}: <strong>{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(d.forecast)}</strong></p>
                          <p>{t('sales.avgCheck')}: <strong>{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(d.avgCheckSize)}</strong></p>
                        </div>
                      );
                    }} />
                    <Legend verticalAlign="bottom" height={36} iconType="rect" iconSize={10} wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} />
                    <Bar yAxisId="left" dataKey="actual" fill={COLORS.actual} name="Actual" radius={[3, 3, 0, 0]} maxBarSize={50} />
                    <Bar yAxisId="left" dataKey="forecast" fill={COLORS.forecast} name="Forecast" radius={[3, 3, 0, 0]} maxBarSize={50} />
                    <Line yAxisId="right" type="monotone" dataKey="avgCheckSize" stroke={COLORS.avgCheck} strokeWidth={2.5} name="Avg Check" dot={{ r: 4, fill: COLORS.avgCheck, strokeWidth: 0 }} />
                    <Line yAxisId="right" type="monotone" dataKey="avgCheckForecast" stroke={COLORS.avgCheckForecast} strokeWidth={2.5} name="Avg Check Forecast" dot={{ r: 4, fill: COLORS.avgCheckForecast, strokeWidth: 0 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  {t('sales.noSalesData')}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Channel Breakdown */}
      {channels.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">{t('sales.channelBreakdown')}</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('sales.channel')}</TableHead>
                <TableHead>{t('common.actual')}</TableHead>
                <TableHead>{t('sales.projected')}</TableHead>
                <TableHead>{t('sales.avgCheck')}</TableHead>
                <TableHead>{t('sales.orders')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channels.map(ch => (
                <TableRow key={ch.channel}>
                  <TableCell className="font-medium">{ch.channel}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <VarianceIndicator value={ch.salesDelta} />
                      <div className="font-semibold">{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(ch.sales)}</div>
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold">{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(ch.projectedSales)}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <VarianceIndicator value={ch.acsDelta} />
                      <div className="font-semibold">{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(ch.acs)}</div>
                    </div>
                  </TableCell>
                  <TableCell>{ch.orders.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Categories + Products */}
      <div className="grid grid-cols-2 gap-6">
        {/* Categories */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">{t('sales.salesPerCategory')}</h3>
          <div className="h-[200px] mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categories} layout="vertical">
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="category" width={80} />
                <Bar dataKey="ratio" fill={COLORS.actual} radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common.category')}</TableHead>
                <TableHead>{t('sales.ratio')}</TableHead>
                <TableHead>{t('common.amount')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map(cat => (
                <TableRow key={cat.category}>
                  <TableCell className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.actual }} />
                    {cat.category}
                  </TableCell>
                  <TableCell>{cat.ratio}%</TableCell>
                  <TableCell>{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(cat.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Products */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">{t('sales.topProducts')}</h3>
          <div className="space-y-3">
            {products.slice(0, productsDisplayCount).map(product => (
              <div key={product.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{product.name}</span>
                  <span className="text-sm font-semibold">{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(product.value)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400" style={{ width: `${Math.min(product.percentage * 5, 100)}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground w-14 text-right">{product.percentage.toFixed(1)}%</span>
                </div>
              </div>
            ))}
            {products.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">{t('sales.noProductData')}</p>
            )}
          </div>
        </Card>
      </div>

      {/* Ask Josephine */}
      <AskJosephineSalesDrawer
        open={askJosephineOpen}
        onOpenChange={setAskJosephineOpen}
        salesData={salesDataForAI}
      />
    </div>
  );
}
