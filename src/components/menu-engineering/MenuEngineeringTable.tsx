import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Search, ArrowUpDown, Info } from 'lucide-react';
import type { MenuEngineeringItem, Classification } from '@/hooks/useMenuEngineeringData';

interface MenuEngineeringTableProps {
  items: MenuEngineeringItem[];
  loading: boolean;
}

type SortField = 'name' | 'units_sold' | 'selling_price_ex_vat' | 'unit_food_cost' | 'unit_gross_profit' | 'popularity_pct' | 'total_gross_profit';
type SortDirection = 'asc' | 'desc';

const CLASSIFICATION_BADGES: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  star: { label: '⭐ Estrella', variant: 'default' },
  plow_horse: { label: '🐴 Caballo', variant: 'secondary' },
  puzzle: { label: '💎 Joya', variant: 'outline' },
  dog: { label: '🔍 Revisar', variant: 'destructive' },
};

const ACTION_BADGES: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  Mantener: { label: 'Mantener', variant: 'default' },
  'Revisar coste': { label: 'Revisar coste', variant: 'secondary' },
  Promocionar: { label: 'Promocionar', variant: 'outline' },
  Evaluar: { label: 'Evaluar', variant: 'destructive' },
};

const COST_SOURCE_BADGE: Record<string, { label: string; className: string }> = {
  recipe_actual: { label: '✓ Receta', className: 'bg-success/20 text-success' },
  fallback_average: { label: '~ Media', className: 'bg-amber-500/20 text-amber-600' },
  unknown: { label: '? Sin dato', className: 'bg-destructive/20 text-destructive' },
};

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000) return `€${(value / 1000).toFixed(1)}k`;
  return `€${value.toFixed(2)}`;
}

export function MenuEngineeringTable({ items, loading }: MenuEngineeringTableProps) {
  const [search, setSearch] = useState('');
  const [classificationFilter, setClassificationFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('total_gross_profit');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const filteredItems = useMemo(() => {
    let result = [...items];
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(i => i.name.toLowerCase().includes(s) || i.category.toLowerCase().includes(s));
    }
    if (classificationFilter !== 'all') {
      result = result.filter(i => i.classification === classificationFilter);
    }
    result.sort((a, b) => {
      if (sortField === 'name') return sortDirection === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      const aVal = a[sortField] as number;
      const bVal = b[sortField] as number;
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return result;
  }, [items, search, classificationFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('desc'); }
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort(field)}>
      <div className="flex items-center gap-1">{children}<ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'opacity-100' : 'opacity-30'}`} /></div>
    </TableHead>
  );

  if (loading) {
    return <Card><CardHeader><CardTitle>Análisis por producto</CardTitle></CardHeader><CardContent><Skeleton className="h-[400px] w-full" /></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle>Análisis por producto</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={classificationFilter} onValueChange={setClassificationFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Clasificación" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="star">⭐ Estrellas</SelectItem>
              <SelectItem value="plow_horse">🐴 Caballos</SelectItem>
              <SelectItem value="puzzle">💎 Joyas</SelectItem>
              <SelectItem value="dog">🔍 Revisar</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">{filteredItems.length} de {items.length}</span>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader field="name">Producto</SortHeader>
                <TableHead>Categoría</TableHead>
                <SortHeader field="selling_price_ex_vat">Precio</SortHeader>
                <SortHeader field="unit_food_cost">Coste</SortHeader>
                <SortHeader field="units_sold">Uds</SortHeader>
                <SortHeader field="popularity_pct">Pop %</SortHeader>
                <SortHeader field="unit_gross_profit">GP/ud</SortHeader>
                <SortHeader field="total_gross_profit">GP total</SortHeader>
                <TableHead>Clase</TableHead>
                <TableHead>Coste</TableHead>
                <TableHead>Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Sin productos</TableCell></TableRow>
              ) : filteredItems.map((item) => {
                const classBadge = CLASSIFICATION_BADGES[item.classification] || CLASSIFICATION_BADGES.dog;
                const actionBadge = ACTION_BADGES[item.action_tag] || ACTION_BADGES.Evaluar;
                const costBadge = COST_SOURCE_BADGE[item.cost_source] || COST_SOURCE_BADGE.unknown;
                return (
                  <TableRow key={item.product_id}>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="font-medium cursor-help">{item.name}</span>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <p className="text-xs">{item.classification_reason}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{item.category}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(item.selling_price_ex_vat)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(item.unit_food_cost)}</TableCell>
                    <TableCell className="text-right">{item.units_sold.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{item.popularity_pct.toFixed(1)}%</TableCell>
                    <TableCell className={`text-right font-medium ${item.profitability_class === 'low' ? 'text-amber-600' : ''}`}>{formatCurrency(item.unit_gross_profit)}</TableCell>
                    <TableCell className={`text-right font-medium ${item.total_gross_profit < 0 ? 'text-destructive' : ''}`}>{formatCurrency(item.total_gross_profit)}</TableCell>
                    <TableCell><Badge variant={classBadge.variant}>{classBadge.label}</Badge></TableCell>
                    <TableCell><span className={`text-[10px] px-1.5 py-0.5 rounded ${costBadge.className}`}>{costBadge.label}</span></TableCell>
                    <TableCell><Badge variant={actionBadge.variant}>{actionBadge.label}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
