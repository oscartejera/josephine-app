import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import type { WasteTrendData, WasteByReason } from '@/hooks/useWasteDataNew';
import { REASON_COLORS, REASON_LABELS, type WasteReason } from '@/hooks/useWasteDataNew';

interface WasteTrendChartProps {
  trendData: WasteTrendData[];
  byReason: WasteByReason[];
  isLoading?: boolean;
}

export function WasteTrendChart({
  trendData,
  byReason,
  isLoading = false
}: WasteTrendChartProps) {
  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full mb-4" />
          <Skeleton className="h-28 w-full" />
        </CardContent>
      </Card>
    );
  }

  const chartData = trendData.map(d => ({
    ...d,
    dateLabel: format(parseISO(d.date), 'EEE')
  }));

  // Calculate max for Y axis
  const allValues = trendData.flatMap(d => [d.broken, d.end_of_day, d.expired, d.theft, d.other]);
  const maxValue = Math.max(...allValues, 1);
  const yAxisMax = Math.ceil(maxValue / 10) * 10 + 5;

  return (
    <Card className="border-border">
      <CardHeader className="pb-2 px-6 pt-5">
        <CardTitle className="text-sm font-medium text-foreground">Waste by Reason trend</CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-4">
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <XAxis 
                dataKey="dateLabel" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                domain={[0, yAxisMax]}
                tickCount={5}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: '12px',
                  padding: '8px 12px'
                }}
                formatter={(value: number, name: string) => [
                  `€${value.toFixed(2)}`,
                  REASON_LABELS[name as WasteReason] || name
                ]}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '8px', fontSize: '11px' }}
                formatter={(value) => (
                  <span style={{ color: 'hsl(var(--muted-foreground))', marginLeft: '2px', marginRight: '12px' }}>
                    {REASON_LABELS[value as WasteReason] || value}
                  </span>
                )}
                iconType="plainline"
                iconSize={14}
              />
              {(['broken', 'end_of_day', 'expired', 'theft', 'other'] as WasteReason[]).map(reason => (
                <Line
                  key={reason}
                  type="monotone"
                  dataKey={reason}
                  stroke={REASON_COLORS[reason]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Reason table - Logged count */}
        <div className="mt-4 border-t border-border pt-2">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b-0">
                <TableHead className="text-xs font-medium text-muted-foreground h-8 pl-0">Reason</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right h-8 pr-0">Logged</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byReason.filter(r => r.count > 0).sort((a, b) => b.count - a.count).map(item => (
                <TableRow key={item.reason} className="hover:bg-muted/30 border-b-0">
                  <TableCell className="py-2 pl-0">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2.5 h-2.5 rounded-sm flex-shrink-0" 
                        style={{ backgroundColor: REASON_COLORS[item.reason] }}
                      />
                      <span className="text-sm">{REASON_LABELS[item.reason]}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2 text-right text-sm pr-0">
                    {item.count}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
