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
  broken: 'hsl(var(--chart-5))',
  end_of_day: 'hsl(var(--chart-1))',
  expired: 'hsl(var(--warning))',
  theft: 'hsl(var(--destructive))',
  other: 'hsl(var(--muted-foreground))'
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
      <Card className="border-[hsl(var(--bi-border))]">
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full mb-4" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const chartData = trendData.map(d => ({
    ...d,
    dateLabel: format(parseISO(d.date), 'EEE')
  }));

  return (
    <Card className="border-[hsl(var(--bi-border))]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Waste by Reason trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis 
                dataKey="dateLabel" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v) => `€${v.toFixed(0)}`}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: 'var(--shadow-md)'
                }}
                formatter={(value: number, name: string) => [
                  `€${value.toFixed(2)}`,
                  REASON_LABELS[name as WasteReason] || name
                ]}
                labelFormatter={(label) => `Day: ${label}`}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '10px' }}
                formatter={(value) => REASON_LABELS[value as WasteReason] || value}
              />
              {Object.keys(REASON_COLORS).map(reason => (
                <Line
                  key={reason}
                  type="monotone"
                  dataKey={reason}
                  stroke={REASON_COLORS[reason as WasteReason]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Reason table */}
        <Table className="mt-4">
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Reason</TableHead>
              <TableHead className="text-xs text-right">Logged</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {byReason.map(item => (
              <TableRow key={item.reason}>
                <TableCell className="py-2">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: REASON_COLORS[item.reason] }}
                    />
                    <span className="text-sm">{REASON_LABELS[item.reason]}</span>
                  </div>
                </TableCell>
                <TableCell className="py-2 text-right text-sm font-medium">
                  {item.count}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
