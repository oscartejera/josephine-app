import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ArrowUpDown, AlertTriangle } from 'lucide-react';
import type { MenuEngineeringItem, Classification } from '@/hooks/useMenuEngineeringData';

interface MenuEngineeringTableProps {
  items: MenuEngineeringItem[];
  loading: boolean;
}

type SortField = 'name' | 'units' | 'sales' | 'gp' | 'gpPct' | 'cm' | 'popularity';
type SortDirection = 'asc' | 'desc';

const CLASSIFICATION_BADGES: Record<Classification, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
  star: { label: '⭐ Star', variant: 'default', className: 'bg-success text-success-foreground hover:bg-success/90' },
  plow_horse: { label: '🐴 Plow Horse', variant: 'default', className: 'bg-info text-info-foreground hover:bg-info/90' },
  puzzle: { label: '🧩 Puzzle', variant: 'default', className: 'bg-warning text-warning-foreground hover:bg-warning/90' },
  dog: { label: '🐕 Dog', variant: 'destructive', className: '' },
};

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `€${(value / 1000).toFixed(1)}k`;
  }
  return `€${value.toFixed(2)}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function MenuEngineeringTable({ items, loading }: MenuEngineeringTableProps) {
  const [search, setSearch] = useState('');
  const [classificationFilter, setClassificationFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('sales');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Filter and sort items
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(item =>
        item.name.toLowerCase().includes(searchLower) ||
        item.category.toLowerCase().includes(searchLower)
      );
    }

    // Classification filter
    if (classificationFilter !== 'all') {
      result = result.filter(item => item.classification === classificationFilter);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'units':
          comparison = a.units - b.units;
          break;
        case 'sales':
          comparison = a.sales - b.sales;
          break;
        case 'gp':
          comparison = a.gp - b.gp;
          break;
        case 'gpPct':
          comparison = a.gpPct - b.gpPct;
          break;
        case 'cm':
          comparison = a.cm - b.cm;
          break;
        case 'popularity':
          comparison = a.popularity - b.popularity;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [items, search, classificationFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'opacity-100' : 'opacity-30'}`} />
      </div>
    </TableHead>
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Análisis por Producto</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-10 w-40" />
            </div>
            <Skeleton className="h-[400px] w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Análisis por Producto</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar producto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={classificationFilter} onValueChange={setClassificationFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Clasificación" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="star">⭐ Stars</SelectItem>
              <SelectItem value="plow_horse">🐴 Plow Horses</SelectItem>
              <SelectItem value="puzzle">🧩 Puzzles</SelectItem>
              <SelectItem value="dog">🐕 Dogs</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader field="name">Producto</SortHeader>
                <TableHead>Categoría</TableHead>
                <SortHeader field="units">Uds</SortHeader>
                <SortHeader field="sales">Ventas</SortHeader>
                <TableHead className="text-right">COGS</TableHead>
                <SortHeader field="gp">GP</SortHeader>
                <SortHeader field="gpPct">GP%</SortHeader>
                <SortHeader field="cm">CM €/ud</SortHeader>
                <SortHeader field="popularity">Pop. %</SortHeader>
                <TableHead className="text-center">Clasificación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    No se encontraron productos
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => {
                  const badge = CLASSIFICATION_BADGES[item.classification];
                  
                  return (
                    <TableRow key={item.productId}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {item.name}
                          {item.lowData && (
                            <span title="Low data">
                              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.category}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.units.toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(item.sales)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(item.cogs)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatCurrency(item.gp)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className={item.gpPct >= 65 ? 'text-success' : item.gpPct >= 50 ? 'text-warning' : 'text-destructive'}>
                          {formatPercent(item.gpPct)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(item.cm)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPercent(item.popularity)}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={badge.className} variant={badge.variant}>
                          {badge.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Results count */}
        <p className="text-sm text-muted-foreground mt-4">
          Mostrando {filteredItems.length} de {items.length} productos
        </p>
      </CardContent>
    </Card>
  );
}
