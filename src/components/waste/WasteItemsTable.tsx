import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, ArrowUpDown, Sparkles } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { WasteItem, WasteReason } from '@/hooks/useWasteData';

const REASON_LABELS: Record<WasteReason, string> = {
  broken: 'Broken',
  end_of_day: 'End of day',
  expired: 'Expired',
  theft: 'Theft',
  other: 'Other'
};

const REASON_COLORS: Record<WasteReason, string> = {
  broken: 'bg-chart-5/20 text-[hsl(var(--chart-5))] border-chart-5/30',
  end_of_day: 'bg-chart-1/20 text-[hsl(var(--chart-1))] border-chart-1/30',
  expired: 'bg-warning/20 text-warning border-warning/30',
  theft: 'bg-destructive/20 text-destructive border-destructive/30',
  other: 'bg-muted text-muted-foreground border-border'
};

interface WasteItemsTableProps {
  items: WasteItem[];
  totalWastePercent: number;
  isLoading?: boolean;
  currency?: string;
  onGenerateDemo?: () => void;
}

export function WasteItemsTable({
  items,
  totalWastePercent,
  isLoading = false,
  currency = '€',
  onGenerateDemo
}: WasteItemsTableProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'value' | 'quantity' | 'percentOfSales'>('value');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const filteredItems = useMemo(() => {
    let result = [...items];
    
    if (search) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(item => 
        item.itemName.toLowerCase().includes(lowerSearch)
      );
    }
    
    result.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });
    
    return result;
  }, [items, search, sortBy, sortOrder]);

  const totalValue = items.reduce((sum, item) => sum + item.value, 0);
  const maxValue = Math.max(...items.map(i => i.value), 1);

  const handleSort = (column: 'value' | 'quantity' | 'percentOfSales') => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  if (isLoading) {
    return (
      <Card className="border-[hsl(var(--bi-border))]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-9 w-64" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  // Empty state with generate demo button
  if (items.length === 0) {
    return (
      <Card className="border-[hsl(var(--bi-border))]">
        <CardContent className="py-16">
          <div className="flex flex-col items-center justify-center text-center">
            <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No waste data found</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              There's no waste data for the selected period and location. Generate demo data to explore the Waste module.
            </p>
            {onGenerateDemo && (
              <Button onClick={onGenerateDemo} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Generate Demo Data
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[hsl(var(--bi-border))]">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">% of total waste</p>
            <CardTitle className="text-base font-semibold">Items</CardTitle>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by item name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="text-xs font-semibold sticky left-0 bg-muted/50 z-10 min-w-[180px]">
                  % of total waste
                </TableHead>
                <TableHead className="text-xs font-semibold min-w-[200px]">Items</TableHead>
                <TableHead 
                  className="text-xs font-semibold text-right cursor-pointer hover:text-primary"
                  onClick={() => handleSort('quantity')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Quantity
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-xs font-semibold text-right cursor-pointer hover:text-primary"
                  onClick={() => handleSort('value')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Value
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead className="text-xs font-semibold">Type</TableHead>
                <TableHead className="text-xs font-semibold">Top reason by value</TableHead>
                <TableHead 
                  className="text-xs font-semibold text-right cursor-pointer hover:text-primary"
                  onClick={() => handleSort('percentOfSales')}
                >
                  <div className="flex items-center justify-end gap-1">
                    % of sales
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => {
                const percentOfTotal = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
                
                return (
                  <TableRow key={item.itemId} className="hover:bg-muted/30 transition-colors">
                    {/* % of total waste with horizontal bar - Nory style */}
                    <TableCell className="py-3 sticky left-0 bg-card z-10">
                      <div className="flex items-center gap-3">
                        <div className="w-20 h-2.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${Math.min(percentOfTotal, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-14 text-right">
                          {percentOfTotal.toFixed(1)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 font-medium">
                      {item.itemName}
                    </TableCell>
                    <TableCell className="py-3 text-right text-sm tabular-nums">
                      {item.quantity.toFixed(1)}
                    </TableCell>
                    <TableCell className="py-3 text-right text-sm font-medium tabular-nums">
                      {currency}{item.value.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="py-3 text-sm capitalize text-muted-foreground">
                      {item.type === 'ingredient' ? 'Ingredient' : 'Menu item'}
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${REASON_COLORS[item.topReason]}`}
                      >
                        {REASON_LABELS[item.topReason]}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 text-right text-sm tabular-nums">
                      {item.percentOfSales.toFixed(2)}%
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold sticky left-0 bg-muted z-10">
                  <span className="text-sm">100%</span>
                </TableCell>
                <TableCell className="font-semibold">Total</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {items.reduce((sum, i) => sum + i.quantity, 0).toFixed(1)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {currency}{totalValue.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell colSpan={2} />
                <TableCell className="text-right font-semibold tabular-nums">
                  {totalWastePercent.toFixed(2)}%
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
