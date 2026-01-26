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
import { cn } from '@/lib/utils';
import type { BISalesData, CompareMode } from '@/hooks/useBISalesData';

interface BIChannelsTableProps {
  data: BISalesData | undefined;
  isLoading: boolean;
  compareMode: CompareMode;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', { 
    style: 'currency', 
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

function DeltaCell({ value, delta }: { value: number; delta: number }) {
  const isPositive = delta >= 0;
  return (
    <div className="text-right">
      <div className="font-medium">{formatCurrency(value)}</div>
      <div className={cn(
        "text-xs",
        isPositive ? "text-[hsl(var(--bi-badge-positive-text))]" : "text-[hsl(var(--bi-badge-negative-text))]"
      )}>
        {isPositive ? '+' : ''}{delta.toFixed(1)}%
      </div>
    </div>
  );
}

function AcsDeltaCell({ value, delta }: { value: number; delta: number }) {
  const isPositive = delta >= 0;
  return (
    <div className="text-right">
      <div className="font-medium">€{value.toFixed(2)}</div>
      <div className={cn(
        "text-xs",
        isPositive ? "text-[hsl(var(--bi-badge-positive-text))]" : "text-[hsl(var(--bi-badge-negative-text))]"
      )}>
        {isPositive ? '+' : ''}{delta.toFixed(1)}%
      </div>
    </div>
  );
}

export function BIChannelsTable({ data, isLoading, compareMode }: BIChannelsTableProps) {
  if (isLoading || !data) {
    return (
      <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold">Channels</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[180px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const projectedLabel = compareMode === 'forecast' ? 'Forecast' : 'Previous';

  // Calculate totals
  const totalSales = data.channels.reduce((sum, c) => sum + c.sales, 0);
  const totalProjected = data.channels.reduce((sum, c) => sum + c.projectedSales, 0);
  const totalOrders = data.channels.reduce((sum, c) => sum + c.orders, 0);
  const avgAcs = totalOrders > 0 ? totalSales / totalOrders : 0;
  const avgProjectedAcs = data.channels.reduce((sum, c) => sum + c.projectedAcs, 0) / data.channels.length;

  return (
    <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Channels</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-b-0 bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-[100px] py-2 text-xs font-medium">Channel</TableHead>
              <TableHead className="text-right py-2 text-xs font-medium border-l">Sales</TableHead>
              <TableHead className="text-right py-2 text-xs font-medium">{projectedLabel}</TableHead>
              <TableHead className="text-right py-2 text-xs font-medium text-muted-foreground">% total</TableHead>
              <TableHead className="text-right py-2 text-xs font-medium border-l">ACS</TableHead>
              <TableHead className="text-right py-2 text-xs font-medium">{projectedLabel}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.channels.map((channel) => {
              const percentOfTotal = totalSales > 0 ? (channel.sales / totalSales) * 100 : 0;
              return (
                <TableRow key={channel.channel} className="hover:bg-muted/20">
                  <TableCell className="font-medium py-2.5 text-sm">{channel.channel}</TableCell>
                  <TableCell className="border-l py-2.5">
                    <DeltaCell value={channel.sales} delta={channel.salesDelta} />
                  </TableCell>
                  <TableCell className="py-2.5">
                    <div className="text-right font-medium">{formatCurrency(channel.projectedSales)}</div>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <div className="text-right text-sm text-muted-foreground">{percentOfTotal.toFixed(0)}%</div>
                  </TableCell>
                  <TableCell className="border-l py-2.5">
                    <AcsDeltaCell value={channel.acs} delta={channel.acsDelta} />
                  </TableCell>
                  <TableCell className="py-2.5">
                    <div className="text-right font-medium">€{channel.projectedAcs.toFixed(2)}</div>
                  </TableCell>
                </TableRow>
              );
            })}
            {/* Total row */}
            <TableRow className="bg-muted/40 font-semibold hover:bg-muted/40">
              <TableCell className="py-2.5 text-sm">Total</TableCell>
              <TableCell className="text-right border-l py-2.5">{formatCurrency(totalSales)}</TableCell>
              <TableCell className="text-right py-2.5">{formatCurrency(totalProjected)}</TableCell>
              <TableCell className="text-right py-2.5 text-muted-foreground">100%</TableCell>
              <TableCell className="text-right border-l py-2.5">€{avgAcs.toFixed(2)}</TableCell>
              <TableCell className="text-right py-2.5">€{avgProjectedAcs.toFixed(2)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
