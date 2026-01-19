import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Package, AlertTriangle, Trash2, Plus, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Recipe {
  id: string;
  menu_item_name: string;
  selling_price: number | null;
  cost: number;
  gp_percent: number;
}

interface WasteEvent {
  id: string;
  item_name: string;
  quantity: number;
  reason: string | null;
  waste_value: number;
  created_at: string;
}

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  par_level: number | null;
  last_cost: number | null;
}

export default function Inventory() {
  const { selectedLocationId } = useApp();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [wasteEvents, setWasteEvents] = useState<WasteEvent[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [wasteDialogOpen, setWasteDialogOpen] = useState(false);
  const [newWaste, setNewWaste] = useState({ item_id: '', quantity: '', reason: '' });
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [selectedLocationId]);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch recipes with estimated costs
    const { data: recipesData } = await supabase
      .from('recipes')
      .select(`
        id, menu_item_name, selling_price,
        recipe_ingredients(quantity, inventory_items(last_cost))
      `);
    
    const mappedRecipes: Recipe[] = (recipesData || []).map((r: any) => {
      const cost = (r.recipe_ingredients || []).reduce((sum: number, ing: any) => {
        return sum + (ing.quantity * (ing.inventory_items?.last_cost || 0));
      }, 0);
      const gpPercent = r.selling_price && r.selling_price > 0 
        ? ((r.selling_price - cost) / r.selling_price) * 100 
        : 0;
      return {
        id: r.id,
        menu_item_name: r.menu_item_name,
        selling_price: r.selling_price,
        cost,
        gp_percent: gpPercent
      };
    });
    setRecipes(mappedRecipes);
    
    // Fetch waste events
    let wasteQuery = supabase
      .from('waste_events')
      .select(`
        id, quantity, reason, waste_value, created_at,
        inventory_items(name)
      `)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (selectedLocationId && selectedLocationId !== 'all') {
      wasteQuery = wasteQuery.eq('location_id', selectedLocationId);
    }
    
    const { data: wasteData } = await wasteQuery;
    
    const mappedWaste: WasteEvent[] = (wasteData || []).map((w: any) => ({
      id: w.id,
      item_name: w.inventory_items?.name || 'Desconocido',
      quantity: w.quantity,
      reason: w.reason,
      waste_value: w.waste_value || 0,
      created_at: w.created_at
    }));
    setWasteEvents(mappedWaste);
    
    // Fetch inventory items
    const { data: itemsData } = await supabase
      .from('inventory_items')
      .select('id, name, unit, current_stock, par_level, last_cost')
      .order('name');
    
    setInventoryItems(itemsData || []);
    
    setLoading(false);
  };

  const handleAddWaste = async () => {
    if (!newWaste.item_id || !newWaste.quantity) {
      toast({ variant: "destructive", title: "Error", description: "Selecciona un item y cantidad" });
      return;
    }
    
    const item = inventoryItems.find(i => i.id === newWaste.item_id);
    const wasteValue = item?.last_cost ? parseFloat(newWaste.quantity) * item.last_cost : 0;
    
    const { error } = await supabase.from('waste_events').insert({
      location_id: selectedLocationId !== 'all' ? selectedLocationId : inventoryItems[0]?.id,
      inventory_item_id: newWaste.item_id,
      quantity: parseFloat(newWaste.quantity),
      reason: newWaste.reason || null,
      waste_value: wasteValue
    });
    
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo registrar" });
    } else {
      toast({ title: "Registrado", description: "Waste registrado correctamente" });
      setWasteDialogOpen(false);
      setNewWaste({ item_id: '', quantity: '', reason: '' });
      fetchData();
    }
  };

  const totalWaste = wasteEvents.reduce((sum, w) => sum + w.waste_value, 0);
  const stockouts = inventoryItems.filter(i => i.par_level && i.current_stock < i.par_level * 0.3).length;
  const avgFoodCost = recipes.length > 0 
    ? recipes.reduce((sum, r) => sum + (100 - r.gp_percent), 0) / recipes.length 
    : 30;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Inventory</h1>
          <p className="text-muted-foreground">Gestión de inventario, recetas y waste</p>
        </div>
        <Dialog open={wasteDialogOpen} onOpenChange={setWasteDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Registrar Waste
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo Waste</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Producto</Label>
                <Select value={newWaste.item_id} onValueChange={(v) => setNewWaste({...newWaste, item_id: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {inventoryItems.map(item => (
                      <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cantidad</Label>
                <Input 
                  type="number" 
                  step="0.1" 
                  value={newWaste.quantity} 
                  onChange={(e) => setNewWaste({...newWaste, quantity: e.target.value})}
                  placeholder="0.0"
                />
              </div>
              <div>
                <Label>Motivo</Label>
                <Textarea 
                  value={newWaste.reason} 
                  onChange={(e) => setNewWaste({...newWaste, reason: e.target.value})}
                  placeholder="Caducado, dañado, error preparación..."
                />
              </div>
              <Button onClick={handleAddWaste} className="w-full">Registrar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-warning" />
              <div>
                <p className="text-sm text-muted-foreground">Food Cost Est.</p>
                <p className="text-2xl font-bold">{avgFoodCost.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Trash2 className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-sm text-muted-foreground">Waste (30d)</p>
                <p className="text-2xl font-bold">€{totalWaste.toFixed(0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-warning" />
              <div>
                <p className="text-sm text-muted-foreground">Stockouts</p>
                <p className="text-2xl font-bold">{stockouts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="recipes">
        <TabsList>
          <TabsTrigger value="recipes">Recetas</TabsTrigger>
          <TabsTrigger value="waste">Waste</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
        </TabsList>

        <TabsContent value="recipes">
          <Card>
            <CardHeader>
              <CardTitle>Fichas de Recetas</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plato</TableHead>
                    <TableHead className="text-right">PVP</TableHead>
                    <TableHead className="text-right">Coste</TableHead>
                    <TableHead className="text-right">GP%</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipes.map((recipe) => (
                    <TableRow key={recipe.id}>
                      <TableCell className="font-medium">{recipe.menu_item_name}</TableCell>
                      <TableCell className="text-right">
                        {recipe.selling_price ? `€${recipe.selling_price.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right">€{recipe.cost.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={recipe.gp_percent >= 65 ? "default" : recipe.gp_percent >= 50 ? "secondary" : "destructive"}>
                          {recipe.gp_percent.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {recipe.gp_percent >= 65 ? (
                          <Badge variant="outline" className="bg-success/10 text-success">Óptimo</Badge>
                        ) : recipe.gp_percent >= 50 ? (
                          <Badge variant="outline" className="bg-warning/10 text-warning">Revisar</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive">Crítico</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="waste" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Waste por Producto</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Total €</TableHead>
                    <TableHead className="text-right">Eventos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(
                    wasteEvents.reduce((acc: Record<string, { value: number; count: number }>, w) => {
                      if (!acc[w.item_name]) acc[w.item_name] = { value: 0, count: 0 };
                      acc[w.item_name].value += w.waste_value;
                      acc[w.item_name].count += 1;
                      return acc;
                    }, {})
                  )
                    .sort((a, b) => b[1].value - a[1].value)
                    .slice(0, 10)
                    .map(([name, data], i) => (
                      <TableRow key={name}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell className="font-medium">{name}</TableCell>
                        <TableCell className="text-right">€{data.value.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{data.count}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Eventos Recientes</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wasteEvents.slice(0, 15).map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-medium">{w.item_name}</TableCell>
                      <TableCell>{w.quantity}</TableCell>
                      <TableCell className="text-muted-foreground">{w.reason || '-'}</TableCell>
                      <TableCell className="text-right">€{w.waste_value.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stock">
          <Card>
            <CardHeader>
              <CardTitle>Niveles de Stock</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead className="text-right">Stock Actual</TableHead>
                    <TableHead className="text-right">Par Level</TableHead>
                    <TableHead className="text-right">Último Coste</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventoryItems.map((item) => {
                    const stockPercent = item.par_level ? (item.current_stock / item.par_level) * 100 : 100;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell className="text-right">{item.current_stock}</TableCell>
                        <TableCell className="text-right">{item.par_level || '-'}</TableCell>
                        <TableCell className="text-right">{item.last_cost ? `€${item.last_cost.toFixed(2)}` : '-'}</TableCell>
                        <TableCell className="text-center">
                          {stockPercent >= 50 ? (
                            <Badge variant="outline" className="bg-success/10 text-success">OK</Badge>
                          ) : stockPercent >= 30 ? (
                            <Badge variant="outline" className="bg-warning/10 text-warning">Bajo</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-destructive/10 text-destructive">Crítico</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
