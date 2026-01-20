import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronDown, Filter, MoreHorizontal, Search, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReconciliationLine } from '@/hooks/useReconciliationData';

interface ReconciliationGridProps {
  lines: ReconciliationLine[];
  totals: {
    openingQty: number;
    deliveriesQty: number;
    transfersNetQty: number;
    closingQty: number;
    usedQty: number;
    salesQty: number;
    varianceQty: number;
    batchBalance: number;
  };
  stockStatus: 'counted' | 'uncounted' | 'all';
  setStockStatus: (status: 'counted' | 'uncounted' | 'all') => void;
  isLoading?: boolean;
}

type SortField = 'itemName' | 'varianceQty' | 'usedQty' | 'salesQty';
type SortDirection = 'asc' | 'desc';

const allColumns = [
  { key: 'itemName', label: 'Item Name', group: 'Item information', sticky: true },
  { key: 'unit', label: 'Unit', group: 'Item information' },
  { key: 'varianceQty', label: 'Variance Qty', group: 'Variance' },
  { key: 'openingQty', label: 'Opening Qty', group: 'Actual' },
  { key: 'deliveriesQty', label: 'Deliveries', group: 'Actual' },
  { key: 'transfersNetQty', label: 'Net Transferred Qty', group: 'Actual' },
  { key: 'closingQty', label: 'Closing Qty', group: 'Actual' },
  { key: 'usedQty', label: 'Used Qty', group: 'Actual' },
  { key: 'salesQty', label: 'Sales Qty', group: 'Theoretical' },
  { key: 'batchBalance', label: 'Batch Balance', group: 'Theoretical' }
];

export function ReconciliationGrid({
  lines,
  totals,
  stockStatus,
  setStockStatus,
  isLoading = false
}: ReconciliationGridProps) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('itemName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    allColumns.map(c => c.key)
  );

  const filteredLines = useMemo(() => {
    let result = lines.filter(line => 
      line.itemName.toLowerCase().includes(search.toLowerCase())
    );

    result.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const multiplier = sortDirection === 'asc' ? 1 : -1;
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal) * multiplier;
      }
      return ((aVal as number) - (bVal as number)) * multiplier;
    });

    return result;
  }, [lines, search, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleColumn = (key: string) => {
    if (visibleColumns.includes(key)) {
      setVisibleColumns(visibleColumns.filter(c => c !== key));
    } else {
      setVisibleColumns([...visibleColumns, key]);
    }
  };

  const formatNumber = (value: number, isVariance = false) => {
    const formatted = value.toFixed(2);
    if (isVariance) {
      if (value < 0) {
        return <span className="text-destructive">{formatted}</span>;
      } else if (value > 0) {
        return <span className="text-success">+{formatted}</span>;
      }
    }
    return value === 0 ? <span className="text-muted-foreground/50">0.00</span> : formatted;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Stock status chips */}
          <div className="flex items-center gap-2">
            <Badge 
              variant={stockStatus === 'counted' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setStockStatus('counted')}
            >
              Counted
            </Badge>
            <Badge 
              variant={stockStatus === 'uncounted' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setStockStatus('uncounted')}
            >
              Uncounted
            </Badge>
            <Badge 
              variant={stockStatus === 'all' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setStockStatus('all')}
            >
              All
            </Badge>
          </div>

          {/* Columns selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                Columns
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {allColumns.map(col => (
                <DropdownMenuCheckboxItem
                  key={col.key}
                  checked={visibleColumns.includes(col.key)}
                  onCheckedChange={() => toggleColumn(col.key)}
                  disabled={col.sticky}
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Unit selector placeholder */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                Unit
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>All units</DropdownMenuItem>
              <DropdownMenuItem>kg</DropdownMenuItem>
              <DropdownMenuItem>L</DropdownMenuItem>
              <DropdownMenuItem>units</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Badge variant="outline" className="text-muted-foreground">
            +9 more
          </Badge>

          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-3.5 w-3.5" />
            Filters
          </Button>

          <div className="flex-1" />

          {/* Search */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                Reconciliation
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Export CSV</DropdownMenuItem>
              <DropdownMenuItem>Print report</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="icon" className="h-9 w-9">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border rounded-lg overflow-auto max-h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur z-10">
              <TableRow>
                {allColumns.filter(c => visibleColumns.includes(c.key)).map(col => (
                  <TableHead 
                    key={col.key}
                    className={cn(
                      "whitespace-nowrap",
                      col.sticky && "sticky left-0 bg-muted/80 backdrop-blur z-20",
                      ['varianceQty', 'usedQty', 'salesQty'].includes(col.key) && "cursor-pointer hover:bg-muted"
                    )}
                    onClick={() => {
                      if (['itemName', 'varianceQty', 'usedQty', 'salesQty'].includes(col.key)) {
                        handleSort(col.key as SortField);
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {sortField === col.key && (
                        <ArrowUpDown className="h-3 w-3" />
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLines.map((line) => (
                <TableRow key={line.id}>
                  {visibleColumns.includes('itemName') && (
                    <TableCell className="font-medium sticky left-0 bg-card z-10">
                      {line.itemName}
                    </TableCell>
                  )}
                  {visibleColumns.includes('unit') && (
                    <TableCell className="text-muted-foreground">{line.unit}</TableCell>
                  )}
                  {visibleColumns.includes('varianceQty') && (
                    <TableCell className="text-right font-medium">
                      {formatNumber(line.varianceQty, true)}
                    </TableCell>
                  )}
                  {visibleColumns.includes('openingQty') && (
                    <TableCell className="text-right">{formatNumber(line.openingQty)}</TableCell>
                  )}
                  {visibleColumns.includes('deliveriesQty') && (
                    <TableCell className="text-right">{formatNumber(line.deliveriesQty)}</TableCell>
                  )}
                  {visibleColumns.includes('transfersNetQty') && (
                    <TableCell className="text-right">{formatNumber(line.transfersNetQty, true)}</TableCell>
                  )}
                  {visibleColumns.includes('closingQty') && (
                    <TableCell className="text-right">{formatNumber(line.closingQty)}</TableCell>
                  )}
                  {visibleColumns.includes('usedQty') && (
                    <TableCell className="text-right">{formatNumber(line.usedQty)}</TableCell>
                  )}
                  {visibleColumns.includes('salesQty') && (
                    <TableCell className="text-right">{formatNumber(line.salesQty)}</TableCell>
                  )}
                  {visibleColumns.includes('batchBalance') && (
                    <TableCell className="text-right">{formatNumber(line.batchBalance, true)}</TableCell>
                  )}
                </TableRow>
              ))}
              
              {/* Totals row */}
              <TableRow className="font-semibold border-t-2 bg-muted/30 sticky bottom-0">
                {visibleColumns.includes('itemName') && (
                  <TableCell className="sticky left-0 bg-muted/30 z-10">Total</TableCell>
                )}
                {visibleColumns.includes('unit') && <TableCell>—</TableCell>}
                {visibleColumns.includes('varianceQty') && (
                  <TableCell className="text-right">{formatNumber(totals.varianceQty, true)}</TableCell>
                )}
                {visibleColumns.includes('openingQty') && (
                  <TableCell className="text-right">{totals.openingQty.toFixed(2)}</TableCell>
                )}
                {visibleColumns.includes('deliveriesQty') && (
                  <TableCell className="text-right">{totals.deliveriesQty.toFixed(2)}</TableCell>
                )}
                {visibleColumns.includes('transfersNetQty') && (
                  <TableCell className="text-right">{formatNumber(totals.transfersNetQty, true)}</TableCell>
                )}
                {visibleColumns.includes('closingQty') && (
                  <TableCell className="text-right">{totals.closingQty.toFixed(2)}</TableCell>
                )}
                {visibleColumns.includes('usedQty') && (
                  <TableCell className="text-right">{totals.usedQty.toFixed(2)}</TableCell>
                )}
                {visibleColumns.includes('salesQty') && (
                  <TableCell className="text-right">{totals.salesQty.toFixed(2)}</TableCell>
                )}
                {visibleColumns.includes('batchBalance') && (
                  <TableCell className="text-right">{formatNumber(totals.batchBalance, true)}</TableCell>
                )}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
