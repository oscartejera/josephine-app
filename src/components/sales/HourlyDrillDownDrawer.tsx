import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HourlyData {
  hour: string;
  actual: number;
  forecast: number;
  avgCheck: number;
  orders: number;
  variance: number;
}

interface HourlyDrillDownDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDay: string;
  selectedDate: string;
  hourlyData: HourlyData[];
  totalSales: number;
  totalForecast: number;
  totalOrders: number;
}

const COLORS = {
  actual: '#6366f1',
  forecast: '#0ea5e9',
  avgCheck: '#f59e0b',
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

export function HourlyDrillDownDrawer({
  open,
  onOpenChange,
  selectedDay,
  selectedDate,
  hourlyData,
  totalSales,
  totalForecast,
  totalOrders,
}: HourlyDrillDownDrawerProps) {
  const totalVariance = ((totalSales - totalForecast) / totalForecast) * 100;
  const avgCheckSize = totalSales / totalOrders;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[800px] sm:w-[900px] sm:max-w-[900px] flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>
            Sales by Hour - {selectedDay}, {selectedDate}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Sales</p>
                <p className="text-2xl font-bold">€{totalSales.toLocaleString()}</p>
                <VarianceIndicator value={totalVariance} />
              </div>
            </Card>
            <Card className="p-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Avg Check</p>
                <p className="text-2xl font-bold">€{avgCheckSize.toFixed(2)}</p>
              </div>
            </Card>
            <Card className="p-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Orders</p>
                <p className="text-2xl font-bold">{totalOrders}</p>
              </div>
            </Card>
          </div>

          {/* Hourly Chart */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Sales v Forecast by Hour</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="hour" />
                  <YAxis yAxisId="left" tickFormatter={(v) => `€${v}`} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `€${v}`} />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white border rounded-lg shadow-lg p-3">
                            <p className="font-semibold mb-2">{payload[0].payload.hour}</p>
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center justify-between gap-4">
                                <span className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS.actual}}></div>
                                  Actual:
                                </span>
                                <span className="font-semibold">€{payload[0].value}</span>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS.forecast}}></div>
                                  Forecast:
                                </span>
                                <span className="font-semibold">€{payload[1].value}</span>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span>Avg Check:</span>
                                <span className="font-semibold">€{payload[0].payload.avgCheck.toFixed(2)}</span>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span>Orders:</span>
                                <span className="font-semibold">{payload[0].payload.orders}</span>
                              </div>
                              <div className="pt-1 border-t">
                                <VarianceIndicator value={payload[0].payload.variance} />
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="actual" fill={COLORS.actual} name="Actual" radius={[4,4,0,0]} />
                  <Bar yAxisId="left" dataKey="forecast" fill={COLORS.forecast} name="Forecast" radius={[4,4,0,0]} opacity={0.6} />
                  <Line yAxisId="right" type="monotone" dataKey="avgCheck" stroke={COLORS.avgCheck} strokeWidth={2} name="Avg Check" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Hourly Data Table */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Detailed Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Hour</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Actual</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Forecast</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Variance</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Orders</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Avg Check</th>
                  </tr>
                </thead>
                <tbody>
                  {hourlyData.map((hour) => (
                    <tr key={hour.hour} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-3 font-medium">{hour.hour}</td>
                      <td className="py-2 px-3 text-right font-semibold">€{hour.actual.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right">€{hour.forecast.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right">
                        <VarianceIndicator value={hour.variance} />
                      </td>
                      <td className="py-2 px-3 text-right">{hour.orders}</td>
                      <td className="py-2 px-3 text-right">€{hour.avgCheck.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50 font-bold">
                    <td className="py-2 px-3">Total</td>
                    <td className="py-2 px-3 text-right">€{totalSales.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right">€{totalForecast.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right">
                      <VarianceIndicator value={totalVariance} />
                    </td>
                    <td className="py-2 px-3 text-right">{totalOrders}</td>
                    <td className="py-2 px-3 text-right">€{avgCheckSize.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
