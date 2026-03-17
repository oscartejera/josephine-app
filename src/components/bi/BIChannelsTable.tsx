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
import { useTranslation } from 'react-i18next';

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
  const isPositive = delta >{t('bi.BIChannelsTable.0Return')}
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
  const isPositive = delta >{t('bi.BIChannelsTable.0Return1')}
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
  const { t } = useTranslation();
  if (isLoading || !data) {
    return (
      <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>{t('bi.BIChannelsTable.channels')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const projectedLabel = compareMode === 'forecast' ? 'Projected' : 'Previous';

  // Calculate totals
  const totalSales = data.channels.reduce((sum, c) => sum + c.sales, 0);
  const totalProjected = data.channels.reduce((sum, c) => sum + c.projectedSales, 0);
  const totalOrders = data.channels.reduce((sum, c) => sum + c.orders, 0);
  const avgAcs = totalOrders > 0 ? totalSales / totalOrders : 0;
  const avgProjectedAcs = data.channels.reduce((sum, c) => {t('bi.BIChannelsTable.sumCprojectedacs0DatachannelslengthRetur')}
    <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm overflow-hidden">
      <CardHeader className="pb-0">
        <CardTitle className="text-lg font-semibold">{t('bi.BIChannelsTable.channels1')}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 pt-4">
        <Table>
          <TableHeader>
            <TableRow className="border-b-0 bg-muted/30">
              <TableHead className="w-[140px]"></TableHead>
              <TableHead colSpan={2} className="text-center border-l">{t('bi.BIChannelsTable.sales')}</TableHead>
              <TableHead colSpan={2} className="text-center border-l">{t('bi.BIChannelsTable.avgCheckSize')}</TableHead>
            </TableRow>
            <TableRow>
              <TableHead className="font-medium">{t('bi.BIChannelsTable.channel')}</TableHead>
              <TableHead className="text-right border-l">{t('bi.BIChannelsTable.actual')}</TableHead>
              <TableHead className="text-right">{projectedLabel}</TableHead>
              <TableHead className="text-right border-l">{t('bi.BIChannelsTable.actual1')}</TableHead>
              <TableHead className="text-right">{projectedLabel}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.channels.map((channel) => (
              <TableRow key={channel.channel}>
                <TableCell className="font-medium">{channel.channel}</TableCell>
                <TableCell className="border-l">
                  <DeltaCell value={channel.sales} delta={channel.salesDelta} />
                </TableCell>
                <TableCell>
                  <DeltaCell value={channel.projectedSales} delta={channel.projectedSalesDelta} />
                </TableCell>
                <TableCell className="border-l">
                  <AcsDeltaCell value={channel.acs} delta={channel.acsDelta} />
                </TableCell>
                <TableCell>
                  <AcsDeltaCell value={channel.projectedAcs} delta={channel.projectedAcsDelta} />
                </TableCell>
              </TableRow>
            ))}
            {/* Total row */}
            <TableRow className="bg-muted/30 font-semibold">
              <TableCell>{t("common.total")}</TableCell>
              <TableCell className="text-right border-l">{formatCurrency(totalSales)}</TableCell>
              <TableCell className="text-right">{formatCurrency(totalProjected)}</TableCell>
              <TableCell className="text-right border-l">€{avgAcs.toFixed(2)}</TableCell>
              <TableCell className="text-right">€{avgProjectedAcs.toFixed(2)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
