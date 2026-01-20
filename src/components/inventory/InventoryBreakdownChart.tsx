import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, CartesianGrid } from 'recharts';
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
  
  // Nory-like muted colors
  const actualColor = isCOGS ? 'hsl(38, 65%, 55%)' : 'hsl(142, 50%, 50%)';
  const theoreticalColor = isCOGS ? 'hsl(38, 40%, 78%)' : 'hsl(142, 35%, 75%)';

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
      <Card className="h-full border-[#E8E5DD] rounded-2xl shadow-sm">
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
    <Card className="h-full border-[#E8E5DD] rounded-2xl shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Legend at top */}
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: actualColor }} />
            <span className="text-muted-foreground">Actual</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: theoreticalColor }} />
            <span className="text-muted-foreground">Theoretical</span>
          </div>
        </div>

        {/* Vertical Bar Chart */}
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={8} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis 
                dataKey="name" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value) => `${currency}${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                formatter={(value: number) => `${currency}${value.toLocaleString('es-ES', { minimumFractionDigits: 0 })}`}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
              />
              <Bar dataKey="Actual" fill={actualColor} radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="Theoretical" fill={theoreticalColor} radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Table */}
        <div className="overflow-x-auto scrollbar-thin">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border/50">
                <TableHead className="w-[120px] text-xs font-medium text-muted-foreground">Category</TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground">Actual %</TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground">Actual {currency}</TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground">Theoretical %</TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground">Theoretical {currency}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.category} className="border-b border-border/30 hover:bg-muted/30">
                  <TableCell className="py-2.5 font-medium text-sm">{row.category}</TableCell>
                  <TableCell className="py-2.5 text-right text-sm">{row.actualPercent.toFixed(1)}%</TableCell>
                  <TableCell className="py-2.5 text-right text-sm">{currency}{row.actualAmount.toLocaleString('es-ES', { minimumFractionDigits: 0 })}</TableCell>
                  <TableCell className="py-2.5 text-right text-sm text-muted-foreground">{row.theoreticalPercent.toFixed(1)}%</TableCell>
                  <TableCell className="py-2.5 text-right text-sm text-muted-foreground">{currency}{row.theoreticalAmount.toLocaleString('es-ES', { minimumFractionDigits: 0 })}</TableCell>
                </TableRow>
              ))}
              {/* Total row */}
              <TableRow className="border-t-2 border-border bg-muted/20">
                <TableCell className="py-2.5 font-semibold text-sm text-muted-foreground">Total</TableCell>
                <TableCell className="py-2.5 text-right font-semibold text-sm text-muted-foreground">{totals.actualPercent.toFixed(1)}%</TableCell>
                <TableCell className="py-2.5 text-right font-semibold text-sm text-muted-foreground">{currency}{totals.actualAmount.toLocaleString('es-ES', { minimumFractionDigits: 0 })}</TableCell>
                <TableCell className="py-2.5 text-right font-semibold text-sm text-muted-foreground">{totals.theoreticalPercent.toFixed(1)}%</TableCell>
                <TableCell className="py-2.5 text-right font-semibold text-sm text-muted-foreground">{currency}{totals.theoreticalAmount.toLocaleString('es-ES', { minimumFractionDigits: 0 })}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
