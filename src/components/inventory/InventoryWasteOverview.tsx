import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';

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
  const chartData = categoryData.map(d => ({
    name: d.category,
    Accounted: d.accounted,
    Unaccounted: d.unaccounted
  }));

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
        <CardTitle className="text-base font-semibold">Waste overview</CardTitle>
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
              <Bar dataKey="Accounted" fill="hsl(199, 89%, 48%)" radius={[0, 4, 4, 0]} barSize={16} />
              <Bar dataKey="Unaccounted" fill="hsl(199, 60%, 75%)" radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Location Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Locations</TableHead>
              <TableHead className="text-right">Accounted %</TableHead>
              <TableHead className="text-right">Accounted {currency}</TableHead>
              <TableHead className="text-right">Unaccounted %</TableHead>
              <TableHead className="text-right">Unaccounted {currency}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locationData.map((row) => (
              <TableRow key={row.locationId}>
                <TableCell className="font-medium">{row.locationName}</TableCell>
                {row.hasStockCount ? (
                  <>
                    <TableCell className="text-right">{row.accountedPercent.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">{currency}{row.accountedAmount.toLocaleString('es-ES', { minimumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{row.unaccountedPercent.toFixed(1)}%</TableCell>
                    <TableCell className="text-right text-muted-foreground">{currency}{row.unaccountedAmount.toLocaleString('es-ES', { minimumFractionDigits: 0 })}</TableCell>
                  </>
                ) : (
                  <TableCell colSpan={4} className="text-center text-muted-foreground italic">
                    No stock count done
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
