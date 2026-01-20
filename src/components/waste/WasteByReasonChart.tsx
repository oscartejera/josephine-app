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

  const chartData = byReason
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .map(r => ({
      ...r,
      label: REASON_LABELS[r.reason]
    }));

  return (
    <Card className="border-[hsl(var(--bi-border))]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Waste by Reason Value</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={chartData} 
              layout="vertical"
              margin={{ top: 10, right: 10, left: 80, bottom: 0 }}
            >
              <XAxis 
                type="number"
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v) => `${currency}${v.toFixed(0)}`}
              />
              <YAxis 
                type="category"
                dataKey="label"
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                width={75}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: 'var(--shadow-md)'
                }}
                formatter={(value: number) => [`${currency}${value.toFixed(2)}`, 'Amount']}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {chartData.map((entry) => (
                  <Cell key={entry.reason} fill={REASON_COLORS[entry.reason]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Reason value table */}
        <Table className="mt-4">
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Reason</TableHead>
              <TableHead className="text-xs text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {chartData.map(item => (
              <TableRow key={item.reason}>
                <TableCell className="py-2">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: REASON_COLORS[item.reason] }}
                    />
                    <span className="text-sm">{item.label}</span>
                  </div>
                </TableCell>
                <TableCell className="py-2 text-right text-sm font-medium">
                  {currency}{item.value.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
