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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { WasteReason, WasteByReason } from '@/hooks/useWasteData';

const REASON_COLORS: Record<WasteReason, string> = {
  broken: '#22c55e',      // Green
  end_of_day: '#3b82f6',  // Blue
  expired: '#84cc16',     // Lime
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

// Standard order for reason codes
const REASON_ORDER: WasteReason[] = ['broken', 'end_of_day', 'expired', 'theft', 'other'];

interface WasteByReasonChartProps {
  byReason: WasteByReason[];
  isLoading?: boolean;
  currency?: string;
}

export function WasteByReasonChart({
  byReason,
  isLoading = false,
  currency = '€'
}: WasteByReasonChartProps) {
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

  // Order data by standard priority
  const chartData = REASON_ORDER.map(reason => {
    const found = byReason.find(r => r.reason === reason);
    return {
      reason,
      label: REASON_LABELS[reason],
      value: found?.value || 0,
      count: found?.count || 0
    };
  });

  const maxValue = Math.max(...chartData.map(d => d.value), 1);
  const yAxisMax = Math.ceil(maxValue / 50) * 50 + 50;

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-foreground">Waste by Reason Value</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
            >
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                interval={0}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                domain={[0, yAxisMax]}
                tickFormatter={(v) => `${currency}${v}`}
                tickCount={5}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}
                formatter={(value: number) => [`${currency}${value.toFixed(2)}`, 'Amount']}
                labelFormatter={(label) => label}
              />
              <Bar
                dataKey="value"
                radius={[4, 4, 0, 0]}
                maxBarSize={50}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.reason} fill={REASON_COLORS[entry.reason]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Reason value table */}
        <div className="mt-4 border-t border-border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-medium text-muted-foreground h-9">Reason</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right h-9">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chartData.filter(item => item.value > 0).map(item => (
                <TableRow key={item.reason} className="hover:bg-muted/30">
                  <TableCell className="py-2.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-sm"
                        style={{ backgroundColor: REASON_COLORS[item.reason] }}
                      />
                      <span className="text-sm">{item.label}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5 text-right text-sm">
                    {currency}{item.value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
