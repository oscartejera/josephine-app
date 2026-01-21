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
import { ArrowRight, ChevronDown } from 'lucide-react';
import type { WasteByCategory } from '@/hooks/useWasteData';

const CATEGORY_COLORS = [
  '#22c55e',  // Green - Frozen
  '#f97316',  // Orange - Dairy
  '#3b82f6',  // Blue - Sauce
  '#84cc16',  // Lime - Fresh
  '#a855f7',  // Purple
  '#6b7280',  // Gray
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
      <Card className="border-border">
        <CardHeader className="pb-2">
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
    <Card className="border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-foreground">Waste by ingredient category</CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 text-xs gap-1.5 font-normal"
            >
              Category
              <ChevronDown className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground">
              See all
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-[180px] relative flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {chartData.map((entry, index) => (
                  <Cell key={entry.category} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}
                formatter={(value: number) => [`${currency}${value.toFixed(2)}`, 'Value']}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Category table - Nory style */}
        <div className="mt-2 border-t border-border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-medium text-muted-foreground h-9">Item category</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right h-9">% of total waste</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right h-9">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chartData.map((item) => (
                <TableRow key={item.category} className="hover:bg-muted/30">
                  <TableCell className="py-2.5">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2.5 h-2.5 rounded-sm" 
                        style={{ backgroundColor: item.fill }}
                      />
                      <span className="text-sm">{item.category}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5 text-right text-sm">
                    {item.percentOfTotal.toFixed(2)}%
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
