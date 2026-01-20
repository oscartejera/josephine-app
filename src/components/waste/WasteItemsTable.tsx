import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search } from 'lucide-react';
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
  broken: 'bg-chart-5/20 text-chart-5',
  end_of_day: 'bg-chart-1/20 text-chart-1',
  expired: 'bg-warning/20 text-warning',
  theft: 'bg-destructive/20 text-destructive',
  other: 'bg-muted text-muted-foreground'
};

interface WasteItemsTableProps {
  items: WasteItem[];
  totalWastePercent: number;
  isLoading?: boolean;
  currency?: string;
}

export function WasteItemsTable({
  items,
  totalWastePercent,
  isLoading = false,
  currency = '€'
}: WasteItemsTableProps) {
  const [search, setSearch] = useState('');

  const filteredItems = useMemo(() => {
    if (!search) return items;
    const lowerSearch = search.toLowerCase();
    return items.filter(item => 
      item.itemName.toLowerCase().includes(lowerSearch)
    );
  }, [items, search]);

  const totalValue = items.reduce((sum, item) => sum + item.value, 0);

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
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs font-semibold sticky left-0 bg-muted/50 z-10">Items</TableHead>
                <TableHead className="text-xs font-semibold text-right">Quantity</TableHead>
                <TableHead className="text-xs font-semibold text-right">Value</TableHead>
                <TableHead className="text-xs font-semibold">Type</TableHead>
                <TableHead className="text-xs font-semibold">Top reason by value</TableHead>
                <TableHead className="text-xs font-semibold text-right">% of sales</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item.itemId} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="py-3 font-medium sticky left-0 bg-card z-10">
                    {item.itemName}
                  </TableCell>
                  <TableCell className="py-3 text-right text-sm">
                    {item.quantity.toFixed(1)}
                  </TableCell>
                  <TableCell className="py-3 text-right text-sm font-medium">
                    {currency}{item.value.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="py-3 text-sm capitalize text-muted-foreground">
                    {item.type}
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge 
                      variant="secondary" 
                      className={`text-xs ${REASON_COLORS[item.topReason]}`}
                    >
                      {REASON_LABELS[item.topReason]}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary/60 rounded-full transition-all"
                          style={{ width: `${Math.min(item.percentOfSales * 20, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-12 text-right">
                        {item.percentOfSales.toFixed(2)}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold sticky left-0 bg-muted z-10">Total</TableCell>
                <TableCell className="text-right font-semibold">
                  {items.reduce((sum, i) => sum + i.quantity, 0).toFixed(1)}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {currency}{totalValue.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell colSpan={2} />
                <TableCell className="text-right font-semibold">
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
