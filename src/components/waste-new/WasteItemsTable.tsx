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
import type { WasteItemRow } from '@/hooks/useWasteDataNew';
import { REASON_LABELS, type WasteReason } from '@/hooks/useWasteDataNew';

interface WasteItemsTableProps {
  items: WasteItemRow[];
  isLoading?: boolean;
  currency?: string;
  onGenerateDemo?: () => void;
}

export function WasteItemsTable({
  items,
  isLoading = false,
  currency = '€',
  onGenerateDemo
}: WasteItemsTableProps) {
  const [search, setSearch] = useState('');

  const filteredItems = useMemo(() => {
    if (!search) return items;
    const lowerSearch = search.toLowerCase();
    return items.filter(item => item.itemName.toLowerCase().includes(lowerSearch));
  }, [items, search]);

  const totalValue = items.reduce((sum, item) => sum + item.value, 0);

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
          <Skeleton className="h-[350px] w-full" />
        </CardContent>
      </Card>
    );
  }

  // Empty state
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
      <CardHeader className="pb-3 px-6 pt-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">% of total waste</p>
          <div className="relative w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by item name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm bg-card"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b">
                <TableHead className="text-xs font-medium text-muted-foreground min-w-[200px] pl-0">
                  Items
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right w-20">
                  Quantity
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right w-20">
                  Value
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground w-24">
                  Type
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground w-32">
                  Top reason by value
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right w-36 pr-0">
                  <div className="flex items-center justify-end gap-1">
                    % of sales
                    <ArrowDown className="h-3 w-3" />
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item.itemId} className="hover:bg-muted/30">
                  <TableCell className="py-3 font-medium text-sm pl-0">
                    {item.itemName}
                  </TableCell>
                  <TableCell className="py-3 text-right text-sm tabular-nums">
                    {item.quantity.toFixed(2)}
                  </TableCell>
                  <TableCell className="py-3 text-right text-sm tabular-nums">
                    {currency}{item.value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="py-3 text-sm text-muted-foreground">
                    {item.itemType === 'ingredient' ? 'Ingredient' : 'Menu item'}
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge 
                      variant="secondary" 
                      className="text-[11px] font-normal bg-primary/10 text-primary border-0 px-2 py-0.5"
                    >
                      {REASON_LABELS[item.topReason]}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 pr-0">
                    <div className="flex items-center justify-end gap-2">
                      {/* Progress bar - Nory style light purple */}
                      <div className="w-16 h-2 bg-primary/10 rounded-sm overflow-hidden">
                        <div 
                          className="h-full bg-primary/40 rounded-sm transition-all"
                          style={{ width: `${Math.min(item.percentOfSales * 5, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm tabular-nums w-14 text-right">
                        {item.percentOfSales.toFixed(2)}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-transparent hover:bg-transparent border-t border-border">
                <TableCell className="py-3 pl-0" colSpan={2}>
                  <span className="text-xs text-muted-foreground">SUM</span>
                </TableCell>
                <TableCell className="py-3 text-right text-sm font-medium tabular-nums">
                  {currency}{totalValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
