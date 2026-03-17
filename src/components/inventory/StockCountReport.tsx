import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { DateRangeValue } from '@/components/bi/DateRangePickerNoryLike';

export interface StockCountRow {
  id: string;
  itemName: string;
  unit: string;
  varianceQty: number;
  openingQty: number;
  deliveriesQty: number;
  netTransferredQty: number;
  closingQty: number;
  usedQty: number;
  salesQty: number;
  batchBalance: number;
}

interface StockCountReportProps {
  dateRange: DateRangeValue;
  data: StockCountRow[];
  isLoading?: boolean;
  lastUpdated?: Date | null;
}

export function StockCountReport({
  dateRange,
  data,
  isLoading = false,
  lastUpdated
}: StockCountReportProps) {
  const dateLabel = dateRange.from && dateRange.to
    ? `${format(dateRange.from, 'd')} - ${format(dateRange.to, 'd MMM')}`
    : 'Stock count';

  const lastUpdatedText = lastUpdated
    ? `Last updated ${Math.floor((Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60))} hours ago`
    : '';

  if (isLoading) {
    return (
      <Card className="border-[#E8E5DD] rounded-2xl shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-8 w-24" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-80 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#E8E5DD] rounded-2xl shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base font-semibold text-foreground">
              Stock count report ({dateLabel})
            </CardTitle>
            {lastUpdatedText && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <RefreshCw className="h-3 w-3" />
                {lastUpdatedText}
              </span>
            )}
          </div>
          <Button variant="outline" size="sm" className="gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            Full report
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-border/60 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 border-b border-border/50">
                <TableHead className="sticky left-0 bg-muted/30 min-w-[200px] text-xs font-medium text-muted-foreground py-3">
                  Item Name
                </TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground py-3 whitespace-nowrap">
                  Variance Qty
                </TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground py-3 whitespace-nowrap">
                  Opening Qty
                </TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground py-3 whitespace-nowrap">
                  Deliveries
                </TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground py-3 whitespace-nowrap">
                  Net Transferred Qty
                </TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground py-3 whitespace-nowrap">
                  Closing Qty
                </TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground py-3 whitespace-nowrap">
                  Used Qty
                </TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground py-3 whitespace-nowrap">
                  Sales Qty
                </TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground py-3 whitespace-nowrap">
                  Batch Balance
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.id} className="border-b border-border/30 hover:bg-muted/20">
                  <TableCell className="sticky left-0 bg-background py-3 font-medium text-sm">
                    {row.itemName}
                    <span className="text-muted-foreground ml-1 text-xs">({row.unit})</span>
                  </TableCell>
                  <TableCell className={cn(
                    "py-3 text-right text-sm font-medium",
                    row.varianceQty < 0 ? "text-destructive" : row.varianceQty > 0 ? "text-success" : ""
                  )}>
                    {row.varianceQty >= 0 ? '+' : ''}{row.varianceQty.toFixed(2)}
                  </TableCell>
                  <TableCell className="py-3 text-right text-sm">
                    {row.openingQty.toFixed(2)}
                  </TableCell>
                  <TableCell className="py-3 text-right text-sm">
                    {row.deliveriesQty.toFixed(2)}
                  </TableCell>
                  <TableCell className={cn(
                    "py-3 text-right text-sm",
                    row.netTransferredQty !== 0 ? (row.netTransferredQty > 0 ? "text-success" : "text-destructive") : ""
                  )}>
                    {row.netTransferredQty >= 0 ? '+' : ''}{row.netTransferredQty.toFixed(2)}
                  </TableCell>
                  <TableCell className="py-3 text-right text-sm">
                    {row.closingQty.toFixed(2)}
                  </TableCell>
                  <TableCell className="py-3 text-right text-sm">
                    {row.usedQty.toFixed(2)}
                  </TableCell>
                  <TableCell className="py-3 text-right text-sm">
                    {row.salesQty.toFixed(2)}
                  </TableCell>
                  <TableCell className={cn(
                    "py-3 text-right text-sm font-medium",
                    row.batchBalance < 0 ? "text-destructive" : row.batchBalance > 0 ? "text-success" : ""
                  )}>
                    {row.batchBalance >= 0 ? '+' : ''}{row.batchBalance.toFixed(2)}
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
