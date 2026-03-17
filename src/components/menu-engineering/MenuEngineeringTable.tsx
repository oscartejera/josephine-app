import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Search, ArrowUpDown, Star, HelpCircle, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import type { MenuEngineeringItem, Classification } from '@/hooks/useMenuEngineeringData';
import { useTranslation } from 'react-i18next';

interface MenuEngineeringTableProps {
  items: MenuEngineeringItem[];
  loading: boolean;
}

type SortField = 'name' | 'units_sold' | 'selling_price_ex_vat' | 'unit_food_cost' | 'unit_gross_profit' | 'popularity_pct' | 'total_gross_profit';
type SortDirection = 'asc' | 'desc';

const CLASSIFICATION_CONFIG: Record<string, {
  label: string;
  emoji: string;
  color: string;
  bg: string;
  what_it_means: string;
  what_to_do: string;
}> = {
  star: {
    label: 'Star',
    emoji: '⭐',
    color: 'text-emerald-700',
    bg: 'bg-emerald-500/15',
    what_it_means: 'Sells well and makes good money',
    what_to_do: 'Protect this dish. Keep recipe consistent, maintain visibility on your menu.',
  },
  plow_horse: {
    label: 'Plow Horse',
    emoji: '🐴',
    color: 'text-blue-700',
    bg: 'bg-blue-500/15',
    what_it_means: 'Customers love it, but margin is low',
    what_to_do: 'Review recipe cost or raise price slightly. Customers already buy it — small changes add up.',
  },
  puzzle: {
    label: 'Puzzle',
    emoji: '💎',
    color: 'text-amber-700',
    bg: 'bg-amber-500/15',
    what_it_means: 'High profit per plate but not enough orders',
    what_to_do: 'Give it a better spot on the menu, train waiters to recommend it, or slightly lower the price.',
  },
  dog: {
    label: 'Dog',
    emoji: '🔍',
    color: 'text-red-700',
    bg: 'bg-red-500/15',
    what_it_means: 'Low sales and low profit',
    what_to_do: 'Rethink this dish. Redesign, replace, or remove unless it serves a strategic purpose.',
  },
};

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000) return `€${(value / 1000).toFixed(1)}k`;
  return `€${value.toFixed(2)}`;
}

function getFoodCostHealth(pct: number): { label: string; className: string } {
  if (pct === 0) return { label: 'No data', className: 'text-muted-foreground' };
  if (pct <= 30) return { label: `${pct.toFixed(0)}%`, className: 'text-emerald-600 font-semibold' };
  if (pct <= 35) return { label: `${pct.toFixed(0)}%`, className: 'text-amber-600 font-semibold' };
  return { label: `${pct.toFixed(0)}%`, className: 'text-red-600 font-semibold' };
}

export function MenuEngineeringTable({ items, loading }: MenuEngineeringTableProps) {
  const { t } = useTranslation();
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

  const SortHeader = ({ field, children, className = '' }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <TableHead className={`cursor-pointer hover:bg-muted/50 ${className}`} onClick={() => handleSort(field)}>
      <div className="flex items-center gap-1">{children}<ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'opacity-100' : 'opacity-30'}`} /></div>
    </TableHead>
  );

  if (loading) {
    return <Card><CardHeader><CardTitle>Your Menu Items</CardTitle></CardHeader><CardContent><Skeleton className="h-[400px] w-full" /></CardContent></Card>;
  }

  // Summary stats
  const totalProfit = filteredItems.reduce((s, i) => s + i.total_gross_profit, 0);
  const avgFoodCostPct = filteredItems.filter(i => i.unit_food_cost > 0).length > 0
    ? filteredItems.filter(i => i.unit_food_cost > 0).reduce((s, i) => s + (i.selling_price_ex_vat > 0 ? (i.unit_food_cost / i.selling_price_ex_vat * 100) : 0), 0) / filteredItems.filter(i => i.unit_food_cost > 0).length
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle>Your Menu Items</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredItems.length} products · Total profit: <strong className={totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(totalProfit)}</strong>
              {avgFoodCostPct > 0 && <> · Avg food cost: <strong>{avgFoodCostPct.toFixed(0)}%</strong></>}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={classificationFilter} onValueChange={setClassificationFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Filter" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All items</SelectItem>
              <SelectItem value="star">⭐ Stars</SelectItem>
              <SelectItem value="plow_horse">🐴 Plow Horses</SelectItem>
              <SelectItem value="puzzle">💎 Puzzles</SelectItem>
              <SelectItem value="dog">🔍 Dogs</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <SortHeader field="name">Product</SortHeader>
                <TableHead>Category</TableHead>
                <SortHeader field="selling_price_ex_vat">Price</SortHeader>
                <SortHeader field="unit_food_cost">Food Cost</SortHeader>
                <TableHead>FC %</TableHead>
                <SortHeader field="units_sold">Sold</SortHeader>
                <SortHeader field="popularity_pct">% Sales</SortHeader>
                <SortHeader field="unit_gross_profit">Profit/plate</SortHeader>
                <SortHeader field="total_gross_profit">{t("menuEngineering.totalProfit")}</SortHeader>
                <TableHead>Type</TableHead>
                <TableHead>What to Do</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">No products found</TableCell></TableRow>
              ) : filteredItems.map((item) => {
                const config = CLASSIFICATION_CONFIG[item.classification] || CLASSIFICATION_CONFIG.dog;
                const foodCostPct = item.selling_price_ex_vat > 0 ? (item.unit_food_cost / item.selling_price_ex_vat) * 100 : 0;
                const fcHealth = getFoodCostHealth(foodCostPct);
                const hasRealCost = item.cost_source === 'recipe_actual';
                const hasFallbackCost = item.cost_source === 'fallback_average';

                return (
                  <TableRow key={item.product_id} className="group">
                    <TableCell className="font-medium max-w-[180px]">
                      <span className="truncate block">{item.name}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{item.category}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(item.selling_price_ex_vat)}</TableCell>
                    <TableCell className="text-right">
                      <span className={hasRealCost ? 'text-foreground' : hasFallbackCost ? 'text-amber-600' : 'text-muted-foreground'}>
                        {item.unit_food_cost > 0 ? formatCurrency(item.unit_food_cost) : '—'}
                      </span>
                      {hasFallbackCost && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <AlertTriangle className="h-3 w-3 text-amber-500 ml-1 inline" />
                            </TooltipTrigger>
                            <TooltipContent><p className="text-xs">Estimated from category average</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={fcHealth.className}>{item.unit_food_cost > 0 ? fcHealth.label : '—'}</span>
                    </TableCell>
                    <TableCell className="text-right">{item.units_sold.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{item.popularity_pct.toFixed(1)}%</TableCell>
                    <TableCell className={`text-right font-semibold ${item.unit_gross_profit < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {formatCurrency(item.unit_gross_profit)}
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${item.total_gross_profit < 0 ? 'text-red-600' : ''}`}>
                      {formatCurrency(item.total_gross_profit)}
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium cursor-help ${config.bg} ${config.color}`}>
                              {config.emoji} {config.label}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-xs">
                            <p className="font-medium text-sm mb-1">{config.emoji} {config.label}</p>
                            <p className="text-xs text-muted-foreground">{config.what_it_means}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs text-muted-foreground line-clamp-2 cursor-help">
                              {config.what_to_do.split('.')[0]}.
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-sm">
                            <p className="text-xs">{config.what_to_do}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Quick guide footer */}
        <div className="mt-4 pt-3 border-t border-border/50 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>Food cost % health: <span className="text-emerald-600 font-medium">≤30% great</span> · <span className="text-amber-600 font-medium">30-35% ok</span> · <span className="text-red-600 font-medium">&gt;35% high</span></span>
          <span>Profit/plate = Price − Food Cost (per serving, ex-VAT)</span>
        </div>
      </CardContent>
    </Card>
  );
}
