import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Plus, Trash2, Save, ChefHat } from 'lucide-react';
import { useRecipeDetail } from '@/hooks/useRecipeDetail';
import { useRecipes } from '@/hooks/useRecipes';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

const CATEGORIES = ['Main', 'Starter', 'Dessert', 'Beverage', 'Sauce', 'Prep', 'Side', 'Other'];

function useInventoryItems() {
    return useQuery({
        queryKey: ['inventory-items-for-bom'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('inventory_items')
                .select('id, name, unit, last_cost')
                .order('name');
            if (error) throw error;
            return data ?? [];
        },
    });
}

export default function RecipeDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { recipe, isLoading, addIngredient, updateIngredient, removeIngredient } = useRecipeDetail(id ?? null);
    const { updateRecipe } = useRecipes();
    const { data: inventoryItems } = useInventoryItems();
    const { recipes: allRecipes } = useRecipes();
    const { toast } = useToast();

    const [showAddDialog, setShowAddDialog] = useState(false);
    const [ingredientType, setIngredientType] = useState<'item' | 'sub_recipe'>('item');
    const [selectedItemId, setSelectedItemId] = useState('');
    const [selectedSubRecipeId, setSelectedSubRecipeId] = useState('');
    const [addQty, setAddQty] = useState('1');
    const [addYieldPct, setAddYieldPct] = useState('100');
    const [addUnit, setAddUnit] = useState('kg');

    // Editable header fields
    const [editName, setEditName] = useState('');
    const [editPrice, setEditPrice] = useState('');
    const [editCategory, setEditCategory] = useState('');
    const [editYieldQty, setEditYieldQty] = useState('');
    const [editYieldUnit, setEditYieldUnit] = useState('');
    const [headerDirty, setHeaderDirty] = useState(false);

    // Init editable fields when recipe loads
    useMemo(() => {
        if (recipe && !headerDirty) {
            setEditName(recipe.menu_item_name);
            setEditPrice(recipe.selling_price?.toString() ?? '');
            setEditCategory(recipe.category);
            setEditYieldQty(recipe.yield_qty.toString());
            setEditYieldUnit(recipe.yield_unit);
        }
    }, [recipe?.id]);

    const subRecipeOptions = allRecipes.filter(r => r.is_sub_recipe && r.id !== id);

    const handleSaveHeader = async () => {
        if (!id) return;
        try {
            await updateRecipe.mutateAsync({
                id,
                menu_item_name: editName,
                selling_price: editPrice ? parseFloat(editPrice) : null,
                category: editCategory,
                yield_qty: parseFloat(editYieldQty) || 1,
                yield_unit: editYieldUnit,
            });
            setHeaderDirty(false);
            toast({ title: 'Guardado', description: 'Receta actualizada' });
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        }
    };

    const handleAddIngredient = async () => {
        try {
            await addIngredient.mutateAsync({
                inventory_item_id: ingredientType === 'item' ? selectedItemId : undefined,
                sub_recipe_id: ingredientType === 'sub_recipe' ? selectedSubRecipeId : undefined,
                qty_gross: parseFloat(addQty) || 0,
                yield_pct: parseFloat(addYieldPct) || 100,
                unit: addUnit,
            });
            setShowAddDialog(false);
            setSelectedItemId('');
            setSelectedSubRecipeId('');
            setAddQty('1');
            setAddYieldPct('100');
            toast({ title: 'Añadido', description: 'Ingrediente añadido a la receta' });
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        }
    };

    const handleRemoveIngredient = async (ingId: string) => {
        try {
            await removeIngredient.mutateAsync(ingId);
            toast({ title: 'Eliminado' });
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        }
    };

    // Computed food cost with current selling price
    const currentPrice = parseFloat(editPrice) || 0;
    const foodCost = recipe?.food_cost ?? 0;
    const foodCostPct = currentPrice > 0 ? Math.round((foodCost / currentPrice) * 1000) / 10 : 0;
    const grossProfit = currentPrice - foodCost;
    const grossProfitPct = currentPrice > 0 ? Math.round((grossProfit / currentPrice) * 1000) / 10 : 0;

    const getFoodCostColor = (pct: number) => {
        if (pct === 0) return 'text-muted-foreground';
        if (pct <= 28) return 'text-emerald-600';
        if (pct <= 35) return 'text-amber-600';
        return 'text-red-600';
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Cargando receta...</p>
            </div>
        );
    }

    if (!recipe) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <p className="text-muted-foreground">Receta no encontrada</p>
                <Button variant="outline" onClick={() => navigate('/inventory-setup/recipes')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Volver a Escandallos
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/inventory-setup/recipes')}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-display font-bold flex items-center gap-2">
                        <ChefHat className="h-6 w-6" />
                        {recipe.menu_item_name}
                    </h1>
                    <p className="text-muted-foreground">Editar escandallo</p>
                </div>
            </div>

            {/* Recipe Header Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Detalles de la Receta</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div className="md:col-span-2 space-y-2">
                            <Label>Nombre</Label>
                            <Input value={editName} onChange={e => { setEditName(e.target.value); setHeaderDirty(true); }} />
                        </div>
                        <div className="space-y-2">
                            <Label>Categoría</Label>
                            <Select value={editCategory} onValueChange={v => { setEditCategory(v); setHeaderDirty(true); }}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>PVP (€)</Label>
                            <Input type="number" step="0.01" value={editPrice} onChange={e => { setEditPrice(e.target.value); setHeaderDirty(true); }} />
                        </div>
                        <div className="space-y-2">
                            <Label>Rendimiento</Label>
                            <div className="flex gap-2">
                                <Input type="number" step="0.1" className="w-20" value={editYieldQty} onChange={e => { setEditYieldQty(e.target.value); setHeaderDirty(true); }} />
                                <Select value={editYieldUnit} onValueChange={v => { setEditYieldUnit(v); setHeaderDirty(true); }}>
                                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="portion">Porción</SelectItem>
                                        <SelectItem value="kg">kg</SelectItem>
                                        <SelectItem value="L">Litro</SelectItem>
                                        <SelectItem value="units">Unidades</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    {headerDirty && (
                        <div className="mt-4 flex justify-end">
                            <Button onClick={handleSaveHeader} disabled={updateRecipe.isPending}>
                                <Save className="h-4 w-4 mr-2" />
                                Guardar Cambios
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Ingredients Table */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-base">Ingredientes</CardTitle>
                            <CardDescription>Añade ingredientes o sub-recetas con rendimiento/mermas</CardDescription>
                        </div>
                        <Button onClick={() => setShowAddDialog(true)} size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            Añadir Ingrediente
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Ingrediente</TableHead>
                                <TableHead className="text-right">Cant. Bruta</TableHead>
                                <TableHead className="text-right">Rendimiento %</TableHead>
                                <TableHead className="text-right">Cant. Neta</TableHead>
                                <TableHead>Unidad</TableHead>
                                <TableHead className="text-right">Coste/ud (LPP)</TableHead>
                                <TableHead className="text-right">Coste Línea</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {recipe.ingredients.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                        No hay ingredientes. Haz click en "Añadir Ingrediente" para empezar.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                recipe.ingredients.map(ing => {
                                    const lineCost = ing.qty_gross * (ing.last_cost ?? 0);
                                    return (
                                        <TableRow key={ing.id}>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    {ing.item_name || ing.sub_recipe_name || '—'}
                                                    {ing.sub_recipe_id && (
                                                        <Badge variant="outline" className="text-xs">Sub-receta</Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-mono">{ing.qty_gross.toFixed(3)}</TableCell>
                                            <TableCell className="text-right">
                                                <span className={ing.yield_pct < 100 ? 'text-amber-600 font-medium' : ''}>
                                                    {ing.yield_pct}%
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-muted-foreground">
                                                {ing.qty_net.toFixed(3)}
                                            </TableCell>
                                            <TableCell>{ing.unit}</TableCell>
                                            <TableCell className="text-right font-mono">€{(ing.last_cost ?? 0).toFixed(2)}</TableCell>
                                            <TableCell className="text-right font-mono font-medium">€{lineCost.toFixed(2)}</TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost" size="icon"
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={() => handleRemoveIngredient(ing.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Cost Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">Food Cost</div>
                    <div className="text-2xl font-bold font-mono">€{foodCost.toFixed(2)}</div>
                </Card>
                <Card className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">Food Cost %</div>
                    <div className={`text-2xl font-bold ${getFoodCostColor(foodCostPct)}`}>
                        {foodCostPct > 0 ? `${foodCostPct}%` : '—'}
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">Gross Profit</div>
                    <div className="text-2xl font-bold font-mono text-emerald-600">
                        {grossProfit > 0 ? `€${grossProfit.toFixed(2)}` : '—'}
                        {grossProfitPct > 0 && (
                            <span className="text-sm font-normal ml-2">({grossProfitPct}%)</span>
                        )}
                    </div>
                </Card>
            </div>

            {/* Add Ingredient Dialog */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Añadir Ingrediente</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Tipo</Label>
                            <Select value={ingredientType} onValueChange={v => setIngredientType(v as 'item' | 'sub_recipe')}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="item">Ingrediente de inventario</SelectItem>
                                    <SelectItem value="sub_recipe">Sub-receta</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {ingredientType === 'item' ? (
                            <div className="space-y-2">
                                <Label>Ingrediente</Label>
                                <Select value={selectedItemId} onValueChange={v => {
                                    setSelectedItemId(v);
                                    const item = inventoryItems?.find(i => i.id === v);
                                    if (item) setAddUnit(item.unit ?? 'kg');
                                }}>
                                    <SelectTrigger><SelectValue placeholder="Seleccionar ingrediente" /></SelectTrigger>
                                    <SelectContent>
                                        {(inventoryItems ?? []).map(item => (
                                            <SelectItem key={item.id} value={item.id}>
                                                {item.name} ({item.unit}) — €{(item.last_cost ?? 0).toFixed(2)}/{item.unit}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label>Sub-receta</Label>
                                <Select value={selectedSubRecipeId} onValueChange={setSelectedSubRecipeId}>
                                    <SelectTrigger><SelectValue placeholder="Seleccionar sub-receta" /></SelectTrigger>
                                    <SelectContent>
                                        {subRecipeOptions.map(r => (
                                            <SelectItem key={r.id} value={r.id}>
                                                {r.menu_item_name} — €{r.food_cost.toFixed(2)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Cantidad Bruta</Label>
                                <Input type="number" step="0.001" value={addQty} onChange={e => setAddQty(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Rendimiento %</Label>
                                <Input type="number" step="1" value={addYieldPct} onChange={e => setAddYieldPct(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Unidad</Label>
                                <Input value={addUnit} onChange={e => setAddUnit(e.target.value)} />
                            </div>
                        </div>

                        <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                            <strong>Cantidad Neta:</strong> {((parseFloat(addQty) || 0) * ((parseFloat(addYieldPct) || 100) / 100)).toFixed(3)} {addUnit}
                            <br />
                            <strong>Ej:</strong> 1kg de cebolla con 90% de rendimiento → 0.900 kg neto (10% merma al pelar)
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
                        <Button onClick={handleAddIngredient} disabled={addIngredient.isPending}>
                            {addIngredient.isPending ? 'Añadiendo...' : 'Añadir'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
