import { useState } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { cn } from '@/lib/utils';
import type { BISalesData } from '@/hooks/useBISalesData';

interface BICategoriesProductsProps {
  data: BISalesData | undefined;
  isLoading: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', { 
    style: 'currency', 
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

export function BICategoriesProducts({ data, isLoading }: BICategoriesProductsProps) {
  const [productSort, setProductSort] = useState<'sales' | 'name'>('sales');

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Sales per Product Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[250px] w-full" />
          </CardContent>
        </Card>
        <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Products</CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[250px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const categoryColors = ['hsl(var(--bi-actual))', 'hsl(var(--bi-forecast-live))', 'hsl(var(--bi-forecast))'];

  const sortedProducts = [...data.products].sort((a, b) => {
    if (productSort === 'sales') return b.value - a.value;
    return a.name.localeCompare(b.name);
  });

  const maxProductValue = Math.max(...sortedProducts.map(p => p.value));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Categories */}
      <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Sales per Product Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={data.categories} layout="vertical" margin={{ left: 80, right: 20 }}>
              <XAxis type="number" hide />
              <YAxis 
                type="category" 
                dataKey="category" 
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                width={70}
              />
              <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={24}>
                {data.categories.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={categoryColors[index % categoryColors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <Table className="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Ratio %</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.categories.map((cat) => (
                <TableRow key={cat.category}>
                  <TableCell className="font-medium">{cat.category}</TableCell>
                  <TableCell className="text-right">{cat.ratio}%</TableCell>
                  <TableCell className="text-right">{formatCurrency(cat.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Products */}
      <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold">Products</CardTitle>
          <Select value={productSort} onValueChange={(v) => setProductSort(v as 'sales' | 'name')}>
            <SelectTrigger className="w-[120px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sales">Sales</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Name</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="w-[120px]">% of sales</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedProducts.slice(0, 8).map((product) => (
                <TableRow key={product.name}>
                  <TableCell className="font-medium truncate max-w-[150px]">{product.name}</TableCell>
                  <TableCell className="text-right">{formatCurrency(product.value)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[hsl(var(--bi-actual))] rounded-full"
                          style={{ width: `${(product.value / maxProductValue) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-10 text-right">
                        {product.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
