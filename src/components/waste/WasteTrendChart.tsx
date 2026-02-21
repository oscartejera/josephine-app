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
import type { WasteTrendData, WasteReason, WasteByReason } from '@/hooks/useWasteData';

const REASON_COLORS: Record<WasteReason, string> = {
  broken: '#22c55e',      // Green
  end_of_day: '#3b82f6',  // Blue
  expired: '#84cc16',     // Lime/yellow-green
  theft: '#f97316',       // Orange
  other: '#ef4444'        // Red
};

const REASON_LABELS: Record<WasteReason, string> = {
  broken: 'Broken',
  end_of_day: 'End of day',
  expired: 'Expired',
  theft: 'Theft',
  other: 'Other'
};

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
          <Skeleton className="h-[220px] w-full mb-4" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Convert data to show count per day (shows the number of logs trend)
  const chartData = trendData.map(d => ({
    ...d,
    dateLabel: format(parseISO(d.date), 'EEE')
  }));

  // Get max value for Y axis
  const allValues = trendData.flatMap(d => [d.broken, d.end_of_day, d.expired, d.theft, d.other]);
  const maxValue = Math.max(...allValues, 1);
  const yAxisMax = Math.ceil(maxValue / 10) * 10 + 10;

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-foreground">Waste by Reason trend</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
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
                  fontSize: '12px'
                }}
                formatter={(value: number, name: string) => [
                  value.toFixed(0),
                  REASON_LABELS[name as WasteReason] || name
                ]}
              />
              <Legend
                wrapperStyle={{ paddingTop: '8px', fontSize: '11px' }}
                formatter={(value) => (
                  <span style={{ color: 'hsl(var(--muted-foreground))', marginLeft: '2px' }}>
                    {REASON_LABELS[value as WasteReason] || value}
                  </span>
                )}
                iconType="plainline"
                iconSize={16}
              />
              {Object.keys(REASON_COLORS).map(reason => (
                <Line
                  key={reason}
                  type="monotone"
                  dataKey={reason}
                  stroke={REASON_COLORS[reason as WasteReason]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Reason table */}
        <div className="mt-4 border-t border-border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-medium text-muted-foreground h-9">Reason</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right h-9">Logged</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byReason.filter(r => r.count > 0).map(item => (
                <TableRow key={item.reason} className="hover:bg-muted/30">
                  <TableCell className="py-2.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-sm"
                        style={{ backgroundColor: REASON_COLORS[item.reason] }}
                      />
                      <span className="text-sm">{REASON_LABELS[item.reason]}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5 text-right text-sm">
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
