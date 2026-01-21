import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ArrowUpDown } from 'lucide-react';
import type { MenuEngineeringItem, Classification } from '@/hooks/useMenuEngineeringData';

interface MenuEngineeringTableProps {
  items: MenuEngineeringItem[];
  loading: boolean;
}

type SortField = 'name' | 'units' | 'sales' | 'profit_eur' | 'margin_pct' | 'popularity_share';
type SortDirection = 'asc' | 'desc';

const ACTION_BADGES: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  Mantener: { label: 'Mantener', variant: 'default' },
  'Subir precio': { label: 'Subir precio', variant: 'secondary' },
  Promocionar: { label: 'Promocionar', variant: 'outline' },
  Revisar: { label: 'Revisar', variant: 'destructive' },
};

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000) return `€${(value / 1000).toFixed(1)}k`;
  return `€${value.toFixed(2)}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function getPopularityLabel(rank: number, total: number): string {
  const percentile = (rank / total) * 100;
  if (percentile <= 10) return 'Top 10';
  if (percentile <= 25) return 'Top 25';
  if (percentile <= 50) return 'Normal';
  return 'Bajo';
}

export function MenuEngineeringTable({ items, loading }: MenuEngineeringTableProps) {
  const [search, setSearch] = useState('');
  const [classificationFilter, setClassificationFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('sales');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showDetails, setShowDetails] = useState(false);

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
      const aVal = a[sortField] as number;
      const bVal = b[sortField] as number;
      if (sortField === 'name') return sortDirection === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return result;
  }, [items, search, classificationFilter, sortField, sortDirection]);

  const rankedItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => b.popularity_share - a.popularity_share);
    const map = new Map<string, number>();
    sorted.forEach((i, idx) => map.set(i.product_id, idx + 1));
    return map;
  }, [items]);

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
          <div className="flex items-center gap-2">
            <Switch id="show-details" checked={showDetails} onCheckedChange={setShowDetails} />
            <Label htmlFor="show-details" className="text-sm text-muted-foreground">Ver detalles</Label>
          </div>
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
                <SortHeader field="sales">Ventas</SortHeader>
                <SortHeader field="profit_eur">€ que deja</SortHeader>
                <SortHeader field="margin_pct">% margen</SortHeader>
                <SortHeader field="popularity_share">Popularidad</SortHeader>
                {showDetails && <><TableHead className="text-right">Uds</TableHead><TableHead className="text-right">COGS</TableHead><TableHead className="text-right">€/venta</TableHead></>}
                <TableHead>Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow><TableCell colSpan={showDetails ? 10 : 7} className="text-center py-8 text-muted-foreground">Sin productos</TableCell></TableRow>
              ) : filteredItems.map((item) => {
                const rank = rankedItems.get(item.product_id) || 0;
                const popLabel = getPopularityLabel(rank, items.length);
                const badge = ACTION_BADGES[item.action_tag] || ACTION_BADGES.Revisar;
                return (
                  <TableRow key={item.product_id}>
                    <TableCell>
                      <span className="font-medium">{item.name}</span>
                      {item.badges.length > 0 && <div className="flex gap-1 mt-1">{item.badges.map((b,i) => <span key={i} className="text-[10px] bg-warning/20 text-warning-foreground px-1.5 py-0.5 rounded">{b}</span>)}</div>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.category}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(item.sales)}</TableCell>
                    <TableCell className={`text-right font-medium ${item.profit_eur < 0 ? 'text-destructive' : ''}`}>{formatCurrency(item.profit_eur)}</TableCell>
                    <TableCell className="text-right">{formatPercent(item.margin_pct)}</TableCell>
                    <TableCell className="text-right"><span className={`text-xs px-2 py-0.5 rounded ${popLabel === 'Top 10' ? 'bg-success/20 text-success' : popLabel === 'Top 25' ? 'bg-info/20 text-info' : popLabel === 'Normal' ? 'bg-muted' : 'bg-destructive/20 text-destructive'}`}>{popLabel}</span></TableCell>
                    {showDetails && <><TableCell className="text-right text-muted-foreground">{item.units.toLocaleString()}</TableCell><TableCell className="text-right text-muted-foreground">{formatCurrency(item.cogs)}</TableCell><TableCell className="text-right text-muted-foreground">{formatCurrency(item.profit_per_sale)}</TableCell></>}
                    <TableCell><Badge variant={badge.variant}>{badge.label}</Badge></TableCell>
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
