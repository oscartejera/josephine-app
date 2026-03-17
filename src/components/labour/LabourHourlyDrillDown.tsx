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

interface HourlyLabourData {
  hour: string;
  actualCOL: number;
  plannedCOL: number;
  actualSPLH: number;
  plannedSPLH: number;
  actualHours: number;
  plannedHours: number;
  actualSales: number;
  variance: number;
}

interface LabourHourlyDrillDownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDay: string;
  selectedDate: string;
  hourlyData: HourlyLabourData[];
  totalActualCOL: number;
  totalPlannedCOL: number;
  totalActualSPLH: number;
  totalHours: number;
}

const COLORS = {
  actual: '#6366f1',
  planned: '#c7d2fe',
  splh: '#f97316',
  splhPlanned: '#fed7aa',
};

const VarianceIndicator = ({ value, inverted = false }: { value: number; inverted?: boolean }) => {
  const isPositive = inverted ? value <= 0 : value >= 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', isPositive ? 'text-emerald-600' : 'text-rose-600')}>
      <Icon className="h-3 w-3" />
      {isPositive ? '+' : ''}{value.toFixed(2)}%
    </span>
  );
};

export function LabourHourlyDrillDown({
  open,
  onOpenChange,
  selectedDay,
  selectedDate,
  hourlyData,
  totalActualCOL,
  totalPlannedCOL,
  totalActualSPLH,
  totalHours,
}: LabourHourlyDrillDownProps) {
  const colVariance = ((totalActualCOL - totalPlannedCOL) / totalPlannedCOL) * 100;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[800px] sm:w-[900px] sm:max-w-[900px] flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>
            Labour by Hour - {selectedDay}, {selectedDate}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Actual COL%</p>
                <p className="text-2xl font-bold">{totalActualCOL.toFixed(2)}%</p>
                <VarianceIndicator value={colVariance} inverted={true} />
              </div>
            </Card>
            <Card className="p-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Avg SPLH</p>
                <p className="text-2xl font-bold">€{totalActualSPLH.toFixed(0)}</p>
              </div>
            </Card>
            <Card className="p-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Hours</p>
                <p className="text-2xl font-bold">{totalHours.toFixed(1)}h</p>
              </div>
            </Card>
          </div>

          {/* Hourly Chart */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Labour by Hour</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis 
                    dataKey="hour" 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                  />
                  <YAxis 
                    yAxisId="left" 
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    tickFormatter={(v) => `€${v}`}
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white border rounded-lg shadow-lg p-3">
                            <p className="font-semibold mb-2">{payload[0].payload.hour}</p>
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center justify-between gap-4">
                                <span>COL% Actual:</span>
                                <span className="font-semibold">{payload[0].payload.actualCOL.toFixed(2)}%</span>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span>COL% Planned:</span>
                                <span className="font-semibold">{payload[0].payload.plannedCOL.toFixed(2)}%</span>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span>SPLH:</span>
                                <span className="font-semibold">€{payload[0].payload.actualSPLH.toFixed(0)}</span>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span>Hours:</span>
                                <span className="font-semibold">{payload[0].payload.actualHours.toFixed(1)}h</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="rect" iconSize={10} />
                  <Bar yAxisId="left" dataKey="actualCOL" fill={COLORS.actual} name="COL% Actual" radius={[3,3,0,0]} />
                  <Bar yAxisId="left" dataKey="plannedCOL" fill={COLORS.planned} name="COL% Planned" radius={[3,3,0,0]} />
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="actualSPLH" 
                    stroke={COLORS.splh} 
                    strokeWidth={2.5} 
                    name="SPLH"
                    dot={{ r: 4, fill: COLORS.splh, strokeWidth: 0 }}
                  />
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
                    <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">COL% Actual</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">COL% Planned</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">SPLH</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Hours</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {hourlyData.map((hour) => (
                    <tr key={hour.hour} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-3 font-medium">{hour.hour}</td>
                      <td className="py-2 px-3 text-right font-semibold">{hour.actualCOL.toFixed(2)}%</td>
                      <td className="py-2 px-3 text-right">{hour.plannedCOL.toFixed(2)}%</td>
                      <td className="py-2 px-3 text-right">€{hour.actualSPLH.toFixed(0)}</td>
                      <td className="py-2 px-3 text-right">{hour.actualHours.toFixed(1)}h</td>
                      <td className="py-2 px-3 text-right">€{hour.actualSales.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50 font-bold">
                    <td className="py-2 px-3">Total</td>
                    <td className="py-2 px-3 text-right">{totalActualCOL.toFixed(2)}%</td>
                    <td className="py-2 px-3 text-right">{totalPlannedCOL.toFixed(2)}%</td>
                    <td className="py-2 px-3 text-right">€{totalActualSPLH.toFixed(0)}</td>
                    <td className="py-2 px-3 text-right">{totalHours.toFixed(1)}h</td>
                    <td className="py-2 px-3 text-right">-</td>
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
