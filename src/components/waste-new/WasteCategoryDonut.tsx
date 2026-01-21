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
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { ArrowRight, ChevronDown } from 'lucide-react';
import type { WasteByCategory } from '@/hooks/useWasteDataNew';

const CATEGORY_COLORS = [
  '#22c55e',  // Green
  '#f97316',  // Orange
  '#3b82f6',  // Blue
  '#84cc16',  // Lime
  '#a855f7',  // Purple
  '#ec4899',  // Pink
  '#14b8a6',  // Teal
  '#eab308',  // Yellow
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
          <Skeleton className="h-[180px] w-full mb-4" />
          <Skeleton className="h-28 w-full" />
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
      <CardHeader className="pb-2 px-6 pt-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-foreground">Waste by ingredient category</CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 text-xs gap-1 font-normal px-2"
            >
              Category
              <ChevronDown className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground px-2">
              See all
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-4">
        <div className="h-[160px] relative flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
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
                  fontSize: '12px',
                  padding: '8px 12px'
                }}
                formatter={(value: number) => [`${currency}${value.toFixed(2)}`, 'Value']}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Category table */}
        <div className="mt-2 border-t border-border pt-2">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b-0">
                <TableHead className="text-xs font-medium text-muted-foreground h-8 pl-0">Item category</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right h-8">% of total waste</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right h-8 pr-0">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chartData.slice(0, 5).map((item) => (
                <TableRow key={item.category} className="hover:bg-muted/30 border-b-0">
                  <TableCell className="py-2 pl-0">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2.5 h-2.5 rounded-sm flex-shrink-0" 
                        style={{ backgroundColor: item.fill }}
                      />
                      <span className="text-sm">{item.category}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2 text-right text-sm">
                    {item.percentOfTotal.toFixed(2)}%
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
