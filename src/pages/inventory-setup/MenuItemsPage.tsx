import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, UtensilsCrossed, ChefHat, AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSetupCompleteness } from '@/hooks/useSetupCompleteness';

interface MenuItem {
  id: string;
  name: string;
  category: string;
  selling_price: number;
  has_recipe: boolean;
  recipe_id: string | null;
  ingredient_count: number;
  food_cost: number;
  food_cost_pct: number;
}

export default function MenuItemsPage() {
  const { profile } = useAuth();
  const orgId = profile?.group_id;
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const { data: completeness } = useSetupCompleteness();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['menu-items-carta', orgId],
    queryFn: async (): Promise<MenuItem[]> => {
      if (!orgId) return [];

      // Get all menu items (schema: id, name, category, is_active - NO selling_price)
      const { data: menuItems, error } = await supabase
        .from('menu_items')
        .select('id, name, category')
        .eq('org_id', orgId)
        .order('name');

      if (error) throw error;

      // For each menu item, check if it has a recipe and ingredient count
      const enriched: MenuItem[] = await Promise.all(
        (menuItems || []).map(async (mi: any) => {
          // Check recipe via FK (recipes.menu_item_id → menu_items.id)
          const { data: recipe } = await supabase
            .from('recipes')
            .select('id, selling_price')
            .eq('menu_item_id', mi.id)
            .limit(1)
            .maybeSingle();

          let ingredientCount = 0;
          let foodCost = 0;
          const sellingPrice = recipe?.selling_price ?? 0;

          if (recipe) {
            const [countRes, costRes] = await Promise.all([
              supabase.rpc('get_recipe_ingredient_count', { p_recipe_id: recipe.id }),
              supabase.rpc('get_recipe_food_cost', { p_recipe_id: recipe.id }),
            ]);
            ingredientCount = countRes.data ?? 0;
            foodCost = costRes.data ?? 0;
          }

          return {
            id: mi.id,
            name: mi.name,
            category: mi.category ?? 'Other',
            selling_price: sellingPrice,
            has_recipe: !!recipe,
            recipe_id: recipe?.id ?? null,
            ingredient_count: ingredientCount,
            food_cost: foodCost,
            food_cost_pct: sellingPrice > 0 ? Math.round((foodCost / sellingPrice) * 1000) / 10 : 0,
          };
        })
      );

      return enriched;
    },
    enabled: !!orgId,
  });

  const categories = useMemo(() => {
    const cats = new Set(items.map(i => i.category));
    return Array.from(cats).sort();
  }, [items]);

  const filtered = items.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'all' || i.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const stats = useMemo(() => ({
    total: items.length,
    withRecipe: items.filter(i => i.has_recipe).length,
    withIngredients: items.filter(i => i.ingredient_count > 0).length,
    avgFoodCost: items.length > 0
      ? Math.round(items.reduce((s, i) => s + i.food_cost_pct, 0) / items.filter(i => i.food_cost_pct > 0).length || 0)
      : 0,
  }), [items]);

  const getFoodCostColor = (pct: number) => {
    if (pct === 0) return 'text-muted-foreground';
    if (pct <= 28) return 'text-emerald-600';
    if (pct <= 35) return 'text-amber-600';
    return 'text-red-600';
  };

  const getStatusBadge = (item: MenuItem) => {
    if (!item.has_recipe) {
      return <Badge variant="destructive" className="text-[10px]">Sin escandallo</Badge>;
    }
    if (item.ingredient_count === 0) {
      return <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 text-[10px]">Sin ingredientes</Badge>;
    }
    return <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 text-[10px]">Completo</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Carta del Menú</h1>
        </div>
        <p className="mt-1 text-muted-foreground">
          Todos tus platos del POS — vincula cada uno con un escandallo para calcular food cost.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total platos</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className={stats.withRecipe < stats.total ? 'border-amber-200' : ''}>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Con escandallo</p>
            <p className="text-2xl font-bold">
              {stats.withRecipe}
              <span className="ml-1 text-sm font-normal text-muted-foreground">/ {stats.total}</span>
            </p>
          </CardContent>
        </Card>
        <Card className={stats.withIngredients < stats.withRecipe ? 'border-amber-200' : ''}>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Con ingredientes</p>
            <p className="text-2xl font-bold">
              {stats.withIngredients}
              <span className="ml-1 text-sm font-normal text-muted-foreground">/ {stats.withRecipe}</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Food cost medio</p>
            <p className={`text-2xl font-bold ${getFoodCostColor(stats.avgFoodCost)}`}>
              {stats.avgFoodCost > 0 ? `${stats.avgFoodCost}%` : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar platos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {categories.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plato</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">PVP</TableHead>
                <TableHead className="text-right">Food Cost</TableHead>
                <TableHead className="text-right">FC %</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    Cargando carta...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    No se encontraron platos
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(item => (
                  <TableRow key={item.id} className={!item.has_recipe ? 'bg-red-50/30' : item.ingredient_count === 0 ? 'bg-amber-50/30' : ''}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      €{item.selling_price.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.food_cost > 0 ? `€${item.food_cost.toFixed(2)}` : '—'}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${getFoodCostColor(item.food_cost_pct)}`}>
                      {item.food_cost_pct > 0 ? `${item.food_cost_pct}%` : '—'}
                    </TableCell>
                    <TableCell>{getStatusBadge(item)}</TableCell>
                    <TableCell className="text-right">
                      {item.recipe_id ? (
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/inventory-setup/recipes/${item.recipe_id}`}>
                            <ChefHat className="mr-1 h-3.5 w-3.5" />
                            Ver receta
                          </Link>
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" asChild>
                          <Link to="/inventory-setup/recipes">
                            <AlertCircle className="mr-1 h-3.5 w-3.5" />
                            Crear escandallo
                          </Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
