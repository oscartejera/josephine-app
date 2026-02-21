import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Search, ChefHat, Trash2, Pencil } from 'lucide-react';
import { useRecipes } from '@/hooks/useRecipes';
import { useToast } from '@/hooks/use-toast';

const CATEGORIES = ['Main', 'Starter', 'Dessert', 'Beverage', 'Sauce', 'Prep', 'Side', 'Other'];

export default function RecipesPage() {
    const navigate = useNavigate();
    const { recipes, isLoading, createRecipe, deleteRecipe } = useRecipes();
    const { toast } = useToast();
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [showSubRecipes, setShowSubRecipes] = useState(true);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newRecipe, setNewRecipe] = useState({
        menu_item_name: '',
        selling_price: '',
        category: 'Main',
        yield_qty: '1',
        yield_unit: 'portion',
        is_sub_recipe: false,
    });

    const filtered = recipes.filter(r => {
        const matchSearch = r.menu_item_name.toLowerCase().includes(search.toLowerCase());
        const matchCategory = categoryFilter === 'all' || r.category === categoryFilter;
        const matchSubRecipe = showSubRecipes || !r.is_sub_recipe;
        return matchSearch && matchCategory && matchSubRecipe;
    });

    const handleCreate = async () => {
        if (!newRecipe.menu_item_name.trim()) {
            toast({ variant: 'destructive', title: 'Error', description: 'El nombre es obligatorio' });
            return;
        }
        try {
            const result = await createRecipe.mutateAsync({
                menu_item_name: newRecipe.menu_item_name.trim(),
                selling_price: newRecipe.selling_price ? parseFloat(newRecipe.selling_price) : undefined,
                category: newRecipe.category,
                yield_qty: parseFloat(newRecipe.yield_qty) || 1,
                yield_unit: newRecipe.yield_unit,
                is_sub_recipe: newRecipe.is_sub_recipe,
            });
            toast({ title: 'Creado', description: `Receta "${newRecipe.menu_item_name}" creada` });
            setShowCreateDialog(false);
            setNewRecipe({ menu_item_name: '', selling_price: '', category: 'Main', yield_qty: '1', yield_unit: 'portion', is_sub_recipe: false });
            navigate(`/inventory-setup/recipes/${result.id}`);
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`¿Eliminar la receta "${name}"?`)) return;
        try {
            await deleteRecipe.mutateAsync(id);
            toast({ title: 'Eliminado', description: `Receta "${name}" eliminada` });
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        }
    };

    const getFoodCostColor = (pct: number) => {
        if (pct === 0) return 'text-muted-foreground';
        if (pct <= 28) return 'text-emerald-600';
        if (pct <= 35) return 'text-amber-600';
        return 'text-red-600';
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-display font-bold flex items-center gap-2">
                        <ChefHat className="h-6 w-6" />
                        Escandallos
                    </h1>
                    <p className="text-muted-foreground">Recetas, sub-recetas y food cost — gestión profesional</p>
                </div>
                <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nueva Receta
                </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar recetas..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Categoría" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {CATEGORIES.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                    <Switch checked={showSubRecipes} onCheckedChange={setShowSubRecipes} id="show-sub" />
                    <Label htmlFor="show-sub" className="text-sm">Mostrar sub-recetas</Label>
                </div>
            </div>

            {/* Recipes Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Categoría</TableHead>
                                <TableHead className="text-center">Ingredientes</TableHead>
                                <TableHead className="text-right">Food Cost</TableHead>
                                <TableHead className="text-right">Food Cost %</TableHead>
                                <TableHead className="text-right">PVP</TableHead>
                                <TableHead className="text-right">Yield</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                                        Cargando recetas...
                                    </TableCell>
                                </TableRow>
                            ) : filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                                        <ChefHat className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                        <p>No hay recetas{search ? ` que coincidan con "${search}"` : ''}</p>
                                        <Button variant="link" onClick={() => setShowCreateDialog(true)}>
                                            Crear primera receta
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filtered.map((recipe) => (
                                    <TableRow
                                        key={recipe.id}
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => navigate(`/inventory-setup/recipes/${recipe.id}`)}
                                    >
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                {recipe.menu_item_name}
                                                {recipe.is_sub_recipe && (
                                                    <Badge variant="outline" className="text-xs">Sub-receta</Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">{recipe.category}</Badge>
                                        </TableCell>
                                        <TableCell className="text-center">{recipe.ingredient_count}</TableCell>
                                        <TableCell className="text-right font-mono">
                                            €{recipe.food_cost.toFixed(2)}
                                        </TableCell>
                                        <TableCell className={`text-right font-semibold ${getFoodCostColor(recipe.food_cost_pct)}`}>
                                            {recipe.food_cost_pct > 0 ? `${recipe.food_cost_pct}%` : '—'}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {recipe.selling_price ? `€${recipe.selling_price.toFixed(2)}` : '—'}
                                        </TableCell>
                                        <TableCell className="text-right text-sm text-muted-foreground">
                                            {recipe.yield_qty} {recipe.yield_unit}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                                <Button
                                                    variant="ghost" size="icon"
                                                    onClick={() => navigate(`/inventory-setup/recipes/${recipe.id}`)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost" size="icon"
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={() => handleDelete(recipe.id, recipe.menu_item_name)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Create Dialog */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nueva Receta</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Nombre del plato *</Label>
                            <Input
                                placeholder="Ej: Pasta Carbonara"
                                value={newRecipe.menu_item_name}
                                onChange={e => setNewRecipe({ ...newRecipe, menu_item_name: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Categoría</Label>
                                <Select value={newRecipe.category} onValueChange={v => setNewRecipe({ ...newRecipe, category: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>PVP (€)</Label>
                                <Input
                                    type="number" step="0.01" placeholder="12.50"
                                    value={newRecipe.selling_price}
                                    onChange={e => setNewRecipe({ ...newRecipe, selling_price: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Rendimiento (qty)</Label>
                                <Input
                                    type="number" step="0.1" placeholder="1"
                                    value={newRecipe.yield_qty}
                                    onChange={e => setNewRecipe({ ...newRecipe, yield_qty: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Unidad de rendimiento</Label>
                                <Select value={newRecipe.yield_unit} onValueChange={v => setNewRecipe({ ...newRecipe, yield_unit: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="portion">Porción</SelectItem>
                                        <SelectItem value="kg">kg</SelectItem>
                                        <SelectItem value="L">Litro</SelectItem>
                                        <SelectItem value="units">Unidades</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={newRecipe.is_sub_recipe}
                                onCheckedChange={v => setNewRecipe({ ...newRecipe, is_sub_recipe: v })}
                                id="is-sub"
                            />
                            <Label htmlFor="is-sub">Es sub-receta (puede usarse como ingrediente de otra receta)</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
                        <Button onClick={handleCreate} disabled={createRecipe.isPending}>
                            {createRecipe.isPending ? 'Creando...' : 'Crear Receta'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
