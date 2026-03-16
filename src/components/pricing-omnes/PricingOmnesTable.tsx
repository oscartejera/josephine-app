import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ArrowUpDown, Target } from 'lucide-react';
import type { PricingOmnesCategoryResult } from '@/lib/pricing-omnes-engine';
import { useTranslation } from 'react-i18next';

interface PricingOmnesTableProps {
  result: PricingOmnesCategoryResult | null;
  loading: boolean;
}

type SortField = 'item_name' | 'listed_price' | 'units_sold' | 'item_revenue';
type SortDirection = 'asc' | 'desc';

const BAND_BADGES: Record<string, { label: string; className: string }> = {
  lower: { label: 'Lower', className: 'bg-blue-500/20 text-blue-600' },
  middle: { label: 'Middle', className: 'bg-violet-500/20 text-violet-600' },
  upper: { label: 'Upper', className: 'bg-rose-500/20 text-rose-600' },
};

export function PricingOmnesTable({
  const { t } = useTranslation(); result, loading }: PricingOmnesTableProps) {
  const [search, setSearch] = useState('');
  const [bandFilter, setBandFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('listed_price');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const items = result?.items || [];

  const filteredItems = useMemo(() => {
    let filtered = [...items];
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(i => i.item_name.toLowerCase().includes(s));
    }
    if (bandFilter !== 'all') {
      filtered = filtered.filter(i => i.band === bandFilter);
    }
    filtered.sort((a, b) => {
      if (sortField === 'item_name') {
        return sortDirection === 'asc'
          ? a.item_name.localeCompare(b.item_name)
          : b.item_name.localeCompare(a.item_name);
      }
      const aVal = a[sortField] as number;
      const bVal = b[sortField] as number;
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return filtered;
  }, [items, search, bandFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('asc'); }
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort(field)}>
      <div className="flex items-center gap-1">{children}<ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'opacity-100' : 'opacity-30'}`} /></div>
    </TableHead>
  );

  if (loading) {
    return <Card><CardHeader><CardTitle>Products by Band</CardTitle></CardHeader><CardContent><Skeleton className="h-[300px] w-full" /></CardContent></Card>;
  }

  if (!result) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Products by Price Band</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-1.5">
            {['all', 'lower', 'middle', 'upper'].map(b => (
              <button
                key={b}
                onClick={() => setBandFilter(b)}
                className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                  bandFilter === b ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {b === 'all' ? 'All' : b === 'lower' ? 'Lower' : b === 'middle' ? 'Middle' : 'Upper'}
              </button>
            ))}
          </div>
          <span className="text-sm text-muted-foreground">{filteredItems.length} de {items.length}</span>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader field="item_name">Product</SortHeader>
                <SortHeader field="listed_price">Price</SortHeader>
                <SortHeader field="units_sold">Units</SortHeader>
                <SortHeader field="item_revenue">Revenue</SortHeader>
                <TableHead>Band</TableHead>
                <TableHead>Promotion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No products</TableCell></TableRow>
              ) : filteredItems.map((item) => {
                const bandBadge = BAND_BADGES[item.band] || BAND_BADGES.lower;
                return (
                  <TableRow key={item.item_name}>
                    <TableCell className="font-medium">{item.item_name}</TableCell>
                    <TableCell className="text-right font-medium">€{item.listed_price.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{item.units_sold.toLocaleString()}</TableCell>
                    <TableCell className="text-right">€{item.item_revenue.toFixed(0)}</TableCell>
                    <TableCell>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${bandBadge.className}`}>{bandBadge.label}</span>
                    </TableCell>
                    <TableCell>
                      {item.is_promotion_candidate && (
                        <Badge variant="outline" className="text-[10px] gap-1 text-violet-600 border-violet-300">
                          <Target className="h-3 w-3" /> Promote
                        </Badge>
                      )}
                    </TableCell>
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
