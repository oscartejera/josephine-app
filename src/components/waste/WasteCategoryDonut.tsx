import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { WasteByCategory } from '@/hooks/useWasteData';

const CATEGORY_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--muted-foreground))'
];

interface WasteCategoryDonutProps {
  byCategory: WasteByCategory[];
  isLoading?: boolean;
  currency?: string;
}

export function WasteCategoryDonut({
  byCategory,
  isLoading = false,
  currency = '€'
}: WasteCategoryDonutProps) {
  if (isLoading) {
    return (
      <Card className="border-[hsl(var(--bi-border))]">
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full mb-4" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const chartData = byCategory.map((c, i) => ({
    ...c,
    fill: CATEGORY_COLORS[i % CATEGORY_COLORS.length]
  }));

  return (
    <Card className="border-[hsl(var(--bi-border))]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Waste by ingredient category</CardTitle>
          <div className="flex items-center gap-2">
            <Select defaultValue="category">
              <SelectTrigger className="h-8 w-[100px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="category">Category</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="link" className="h-8 text-xs text-primary p-0">
              See all
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={85}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={entry.category} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: 'var(--shadow-md)'
                }}
                formatter={(value: number) => [`${currency}${value.toFixed(2)}`, 'Value']}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Category table */}
        <Table className="mt-4">
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Item category</TableHead>
              <TableHead className="text-xs text-right">% of total waste</TableHead>
              <TableHead className="text-xs text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {chartData.map((item) => (
              <TableRow key={item.category}>
                <TableCell className="py-2">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.fill }}
                    />
                    <span className="text-sm">{item.category}</span>
                  </div>
                </TableCell>
                <TableCell className="py-2 text-right text-sm">
                  {item.percentOfTotal.toFixed(1)}%
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
