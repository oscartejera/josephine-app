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
import type { WasteByReason } from '@/hooks/useWasteDataNew';
import { REASON_COLORS, REASON_LABELS, type WasteReason } from '@/hooks/useWasteDataNew';

const REASON_ORDER: WasteReason[] = ['broken', 'end_of_day', 'expired', 'theft', 'other'];

interface WasteReasonValueChartProps {
  byReason: WasteByReason[];
  isLoading?: boolean;
  currency?: string;
}

export function WasteReasonValueChart({
  byReason,
  isLoading = false,
  currency = '€'
}: WasteReasonValueChartProps) {
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

  // Order data as in Nory
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
      <CardHeader className="pb-2 px-6 pt-5">
        <CardTitle className="text-sm font-medium text-foreground">Waste by Reason Value</CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-4">
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={chartData} 
              margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
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
                  fontSize: '12px',
                  padding: '8px 12px'
                }}
                formatter={(value: number) => [`${currency}${value.toFixed(2)}`, 'Amount']}
                labelFormatter={(label) => label}
              />
              <Bar 
                dataKey="value" 
                radius={[4, 4, 0, 0]}
                maxBarSize={45}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.reason} fill={REASON_COLORS[entry.reason]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Reason amount table */}
        <div className="mt-4 border-t border-border pt-2">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b-0">
                <TableHead className="text-xs font-medium text-muted-foreground h-8 pl-0">Reason</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right h-8 pr-0">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chartData.filter(item => item.value > 0).sort((a, b) => b.value - a.value).map(item => (
                <TableRow key={item.reason} className="hover:bg-muted/30 border-b-0">
                  <TableCell className="py-2 pl-0">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2.5 h-2.5 rounded-sm flex-shrink-0" 
                        style={{ backgroundColor: REASON_COLORS[item.reason] }}
                      />
                      <span className="text-sm">{item.label}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2 text-right text-sm pr-0">
                    {currency}{item.value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
