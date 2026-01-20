import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { cn } from '@/lib/utils';
import type { ViewMode } from './InventoryHeader';

interface CategoryBreakdown {
  category: string;
  actualPercent: number;
  actualAmount: number;
  theoreticalPercent: number;
  theoreticalAmount: number;
}

interface InventoryBreakdownChartProps {
  viewMode: ViewMode;
  data: CategoryBreakdown[];
  totalSales: number;
  isLoading?: boolean;
  currency?: string;
}

export function InventoryBreakdownChart({
  viewMode,
  data,
  totalSales,
  isLoading = false,
  currency = '€'
}: InventoryBreakdownChartProps) {
  const isCOGS = viewMode === 'COGS';
  const title = isCOGS ? 'COGS breakdown' : 'GP breakdown';
  const actualColor = isCOGS ? 'hsl(38, 92%, 50%)' : 'hsl(142, 71%, 45%)';
  const theoreticalColor = isCOGS ? 'hsl(38, 70%, 75%)' : 'hsl(142, 50%, 70%)';

  const chartData = data.map(d => ({
    name: d.category,
    Actual: d.actualAmount,
    Theoretical: d.theoreticalAmount
  }));

  const totals = data.reduce((acc, d) => ({
    actualPercent: acc.actualPercent + d.actualPercent,
    actualAmount: acc.actualAmount + d.actualAmount,
    theoreticalPercent: acc.theoreticalPercent + d.theoreticalPercent,
    theoreticalAmount: acc.theoreticalAmount + d.theoreticalAmount
  }), { actualPercent: 0, actualAmount: 0, theoreticalPercent: 0, theoreticalAmount: 0 });

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full mb-4" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Bar Chart */}
        <div className="h-48 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" barGap={4}>
              <XAxis type="number" hide />
              <YAxis 
                type="category" 
                dataKey="name" 
                width={100}
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                formatter={(value: number) => `${currency}${value.toLocaleString('es-ES')}`}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend 
                verticalAlign="top" 
                height={36}
                iconType="square"
                iconSize={12}
              />
              <Bar dataKey="Actual" fill={actualColor} radius={[0, 4, 4, 0]} barSize={16} />
              <Bar dataKey="Theoretical" fill={theoreticalColor} radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Category</TableHead>
              <TableHead className="text-right">Actual %</TableHead>
              <TableHead className="text-right">Actual {currency}</TableHead>
              <TableHead className="text-right">Theoretical %</TableHead>
              <TableHead className="text-right">Theoretical {currency}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.category}>
                <TableCell className="font-medium">{row.category}</TableCell>
                <TableCell className="text-right">{row.actualPercent.toFixed(1)}%</TableCell>
                <TableCell className="text-right">{currency}{row.actualAmount.toLocaleString('es-ES', { minimumFractionDigits: 0 })}</TableCell>
                <TableCell className="text-right text-muted-foreground">{row.theoreticalPercent.toFixed(1)}%</TableCell>
                <TableCell className="text-right text-muted-foreground">{currency}{row.theoreticalAmount.toLocaleString('es-ES', { minimumFractionDigits: 0 })}</TableCell>
              </TableRow>
            ))}
            <TableRow className="font-semibold border-t-2">
              <TableCell>Total</TableCell>
              <TableCell className="text-right">{totals.actualPercent.toFixed(1)}%</TableCell>
              <TableCell className="text-right">{currency}{totals.actualAmount.toLocaleString('es-ES', { minimumFractionDigits: 0 })}</TableCell>
              <TableCell className="text-right text-muted-foreground">{totals.theoreticalPercent.toFixed(1)}%</TableCell>
              <TableCell className="text-right text-muted-foreground">{currency}{totals.theoreticalAmount.toLocaleString('es-ES', { minimumFractionDigits: 0 })}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
