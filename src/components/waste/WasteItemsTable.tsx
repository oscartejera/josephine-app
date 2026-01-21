import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, ArrowDown, Sparkles } from 'lucide-react';
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
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-9 w-48" />
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
      <Card className="border-border">
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
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm font-medium text-foreground">% of total waste</p>
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by item name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b">
                <TableHead className="text-xs font-medium text-muted-foreground min-w-[180px]">
                  Items
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right w-24">
                  Quantity
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right w-24">
                  Value
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground w-24">
                  Type
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground w-32">
                  Top reason by value
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right w-32">
                  <div className="flex items-center justify-end gap-1">
                    % of sales
                    <ArrowDown className="h-3 w-3" />
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => {
                const percentOfTotal = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
                
                return (
                  <TableRow key={item.itemId} className="hover:bg-muted/30">
                    <TableCell className="py-3 font-medium text-sm">
                      {item.itemName}
                    </TableCell>
                    <TableCell className="py-3 text-right text-sm tabular-nums">
                      {item.quantity.toFixed(2)}
                    </TableCell>
                    <TableCell className="py-3 text-right text-sm tabular-nums">
                      {currency}{item.value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="py-3 text-sm text-muted-foreground">
                      {item.type === 'ingredient' ? 'Ingredient' : 'Menu item'}
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge 
                        variant="secondary" 
                        className="text-[11px] font-normal bg-primary/10 text-primary border-0 px-2 py-0.5"
                      >
                        {REASON_LABELS[item.topReason]}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center justify-end gap-2">
                        {/* Progress bar - Nory style light purple */}
                        <div className="w-16 h-2 bg-muted rounded-sm overflow-hidden">
                          <div 
                            className="h-full bg-primary/30 rounded-sm transition-all"
                            style={{ width: `${Math.min(item.percentOfSales * 5, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm tabular-nums w-14 text-right">
                          {item.percentOfSales.toFixed(2)}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-transparent hover:bg-transparent border-t">
                <TableCell className="py-3 text-sm text-muted-foreground" colSpan={2}>
                  SUM
                </TableCell>
                <TableCell className="py-3 text-right text-sm font-medium tabular-nums">
                  {currency}{totalValue.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
