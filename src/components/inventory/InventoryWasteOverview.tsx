import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';

interface WasteByCategory {
  category: string;
  accounted: number;
  unaccounted: number;
}

interface WasteByLocation {
  locationId: string;
  locationName: string;
  accountedPercent: number;
  accountedAmount: number;
  unaccountedPercent: number;
  unaccountedAmount: number;
  hasStockCount: boolean;
}

interface InventoryWasteOverviewProps {
  categoryData: WasteByCategory[];
  locationData: WasteByLocation[];
  isLoading?: boolean;
  currency?: string;
}

export function InventoryWasteOverview({
  categoryData,
  locationData,
  isLoading = false,
  currency = '€'
}: InventoryWasteOverviewProps) {
  // Nory-like blue tones
  const accountedColor = 'hsl(199, 70%, 50%)';
  const unaccountedColor = 'hsl(199, 50%, 75%)';

  const chartData = categoryData.map(d => ({
    name: d.category,
    Accounted: d.accounted,
    Unaccounted: d.unaccounted
  }));

  // Calculate totals for the location table
  const totals = locationData.reduce((acc, d) => ({
    accountedAmount: acc.accountedAmount + d.accountedAmount,
    unaccountedAmount: acc.unaccountedAmount + d.unaccountedAmount
  }), { accountedAmount: 0, unaccountedAmount: 0 });

  const totalWaste = totals.accountedAmount + totals.unaccountedAmount;
  const avgAccountedPercent = totalWaste > 0 ? (totals.accountedAmount / totalWaste) * 100 : 0;
  const avgUnaccountedPercent = totalWaste > 0 ? (totals.unaccountedAmount / totalWaste) * 100 : 0;

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
        <CardTitle className="text-base font-semibold text-foreground">Waste overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Legend at top */}
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: accountedColor }} />
            <span className="text-muted-foreground">Accounted</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: unaccountedColor }} />
            <span className="text-muted-foreground">Unaccounted</span>
          </div>
        </div>

        {/* Vertical Bar Chart by Category */}
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
              <Bar dataKey="Accounted" fill={accountedColor} radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="Unaccounted" fill={unaccountedColor} radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Location Table */}
        <div className="overflow-x-auto scrollbar-thin">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border/50">
                <TableHead className="w-[140px] text-xs font-medium text-muted-foreground">Locations</TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground">Accounted %</TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground">Accounted {currency}</TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground">Unaccounted %</TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground">Unaccounted {currency}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locationData.map((row) => (
                <TableRow key={row.locationId} className="border-b border-border/30 hover:bg-muted/30">
                  <TableCell className="py-2.5 font-medium text-sm">{row.locationName}</TableCell>
                  {row.hasStockCount ? (
                    <>
                      <TableCell className="py-2.5 text-right text-sm">{row.accountedPercent.toFixed(1)}%</TableCell>
                      <TableCell className="py-2.5 text-right text-sm">{currency}{row.accountedAmount.toLocaleString('es-ES', { minimumFractionDigits: 0 })}</TableCell>
                      <TableCell className="py-2.5 text-right text-sm text-muted-foreground">{row.unaccountedPercent.toFixed(1)}%</TableCell>
                      <TableCell className="py-2.5 text-right text-sm text-muted-foreground">{currency}{row.unaccountedAmount.toLocaleString('es-ES', { minimumFractionDigits: 0 })}</TableCell>
                    </>
                  ) : (
                    <TableCell colSpan={4} className="py-2.5 text-center text-sm text-muted-foreground italic">
                      No stock count done
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {/* Total row */}
              <TableRow className="border-t-2 border-border bg-muted/20">
                <TableCell className="py-2.5 font-semibold text-sm text-muted-foreground">Total</TableCell>
                <TableCell className="py-2.5 text-right font-semibold text-sm text-muted-foreground">{avgAccountedPercent.toFixed(1)}%</TableCell>
                <TableCell className="py-2.5 text-right font-semibold text-sm text-muted-foreground">{currency}{totals.accountedAmount.toLocaleString('es-ES', { minimumFractionDigits: 0 })}</TableCell>
                <TableCell className="py-2.5 text-right font-semibold text-sm text-muted-foreground">{avgUnaccountedPercent.toFixed(1)}%</TableCell>
                <TableCell className="py-2.5 text-right font-semibold text-sm text-muted-foreground">{currency}{totals.unaccountedAmount.toLocaleString('es-ES', { minimumFractionDigits: 0 })}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
