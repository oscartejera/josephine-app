import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChefHat, Wine, Timer, Search, Save, Loader2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  category: string | null;
  kds_destination: 'kitchen' | 'bar' | 'prep';
  target_prep_time: number | null;
  location_id: string;
}

const destinationConfig = {
  kitchen: { icon: ChefHat, label: 'Cocina', color: 'bg-orange-500/20 text-orange-500 border-orange-500/30', defaultTime: 8 },
  bar: { icon: Wine, label: 'Bar', color: 'bg-purple-500/20 text-purple-500 border-purple-500/30', defaultTime: 3 },
  prep: { icon: Timer, label: 'Prep', color: 'bg-blue-500/20 text-blue-500 border-blue-500/30', defaultTime: 5 },
};

interface PendingChange {
  kds_destination?: 'kitchen' | 'bar' | 'prep';
  target_prep_time?: number | null;
}

export function ProductKDSManager() {
  const { selectedLocationId, locations } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingChange>>(new Map());

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))] as string[];

  useEffect(() => {
    fetchProducts();
  }, [selectedLocationId]);

  useEffect(() => {
    let filtered = products;
    
    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(p => p.category === categoryFilter);
    }
    
    setFilteredProducts(filtered);
  }, [products, searchTerm, categoryFilter]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('products')
        .select('id, name, category, kds_destination, target_prep_time, location_id')
        .eq('is_active', true)
        .order('category')
        .order('name');

      if (selectedLocationId) {
        query = query.eq('location_id', selectedLocationId);
      }

      const { data, error } = await query;

      if (error) throw error;

      setProducts((data || []).map(p => ({
        ...p,
        kds_destination: (p.kds_destination || 'kitchen') as 'kitchen' | 'bar' | 'prep',
        target_prep_time: p.target_prep_time,
      })));
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Error al cargar productos');
    } finally {
      setLoading(false);
    }
  };

  const handleDestinationChange = (productId: string, destination: 'kitchen' | 'bar' | 'prep') => {
    setPendingChanges(prev => {
      const next = new Map(prev);
      const existing = next.get(productId) || {};
      next.set(productId, { ...existing, kds_destination: destination });
      return next;
    });
    
    setProducts(prev => prev.map(p => 
      p.id === productId ? { ...p, kds_destination: destination } : p
    ));
  };

  const handlePrepTimeChange = (productId: string, time: number | null) => {
    setPendingChanges(prev => {
      const next = new Map(prev);
      const existing = next.get(productId) || {};
      next.set(productId, { ...existing, target_prep_time: time });
      return next;
    });
    
    setProducts(prev => prev.map(p => 
      p.id === productId ? { ...p, target_prep_time: time } : p
    ));
  };

  const saveChange = async (productId: string) => {
    const changes = pendingChanges.get(productId);
    if (!changes) return;

    setSaving(productId);
    try {
      const { error } = await supabase
        .from('products')
        .update(changes)
        .eq('id', productId);

      if (error) throw error;

      setPendingChanges(prev => {
        const next = new Map(prev);
        next.delete(productId);
        return next;
      });

      toast.success('Producto actualizado');
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Error al guardar');
    } finally {
      setSaving(null);
    }
  };

  const saveAllChanges = async () => {
    if (pendingChanges.size === 0) return;

    setSaving('all');
    try {
      const updates = Array.from(pendingChanges.entries()).map(([id, changes]) => 
        supabase
          .from('products')
          .update(changes)
          .eq('id', id)
      );

      await Promise.all(updates);

      setPendingChanges(new Map());
      toast.success(`${updates.length} producto(s) actualizado(s)`);
    } catch (error) {
      console.error('Error saving all:', error);
      toast.error('Error al guardar cambios');
    } finally {
      setSaving(null);
    }
  };

  const bulkSetDestination = async (destination: 'kitchen' | 'bar' | 'prep') => {
    const productIds = filteredProducts.map(p => p.id);
    if (productIds.length === 0) return;

    setSaving('bulk');
    try {
      const { error } = await supabase
        .from('products')
        .update({ kds_destination: destination })
        .in('id', productIds);

      if (error) throw error;

      setProducts(prev => prev.map(p => 
        productIds.includes(p.id) ? { ...p, kds_destination: destination } : p
      ));

      toast.success(`${productIds.length} producto(s) actualizados a ${destinationConfig[destination].label}`);
    } catch (error) {
      console.error('Error bulk updating:', error);
      toast.error('Error al actualizar en lote');
    } finally {
      setSaving(null);
    }
  };

  const getLocationName = (locationId: string) => {
    return locations.find(l => l.id === locationId)?.name || 'Desconocido';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ChefHat className="h-5 w-5" />
              Destinos y Tiempos KDS por Producto
            </CardTitle>
            <CardDescription>
              Configura a qué estación se envía cada producto y su tiempo objetivo de preparación
            </CardDescription>
          </div>
          {pendingChanges.size > 0 && (
            <Button onClick={saveAllChanges} disabled={saving === 'all'}>
              {saving === 'all' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Guardar {pendingChanges.size} cambio(s)
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Bulk Actions */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => bulkSetDestination('kitchen')}
              disabled={saving === 'bulk'}
              className="text-orange-500 hover:text-orange-600"
            >
              <ChefHat className="h-4 w-4 mr-1" />
              Todos a Cocina
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => bulkSetDestination('bar')}
              disabled={saving === 'bulk'}
              className="text-purple-500 hover:text-purple-600"
            >
              <Wine className="h-4 w-4 mr-1" />
              Todos a Bar
            </Button>
          </div>
        </div>

        {/* Products Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Categoría</TableHead>
                {!selectedLocationId && <TableHead>Local</TableHead>}
                <TableHead>Destino KDS</TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Tiempo Objetivo
                  </div>
                </TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={selectedLocationId ? 5 : 6} className="text-center py-8 text-muted-foreground">
                    No hay productos que coincidan con los filtros
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => {
                  const hasPendingChange = pendingChanges.has(product.id);
                  const config = destinationConfig[product.kds_destination];
                  const Icon = config.icon;
                  
                  return (
                    <TableRow key={product.id} className={hasPendingChange ? 'bg-muted/30' : ''}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{product.category || 'Sin categoría'}</Badge>
                      </TableCell>
                      {!selectedLocationId && (
                        <TableCell className="text-sm text-muted-foreground">
                          {getLocationName(product.location_id)}
                        </TableCell>
                      )}
                      <TableCell>
                        <Select 
                          value={product.kds_destination} 
                          onValueChange={(v) => handleDestinationChange(product.id, v as any)}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue>
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4" />
                                <span>{config.label}</span>
                              </div>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(destinationConfig).map(([key, cfg]) => {
                              const DestIcon = cfg.icon;
                              return (
                                <SelectItem key={key} value={key}>
                                  <div className="flex items-center gap-2">
                                    <DestIcon className="h-4 w-4" />
                                    <span>{cfg.label}</span>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            max={60}
                            placeholder={`${config.defaultTime}`}
                            value={product.target_prep_time ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              handlePrepTimeChange(
                                product.id, 
                                val === '' ? null : parseInt(val)
                              );
                            }}
                            className="w-20 text-center"
                          />
                          <span className="text-xs text-muted-foreground">min</span>
                          {product.target_prep_time === null && (
                            <span className="text-xs text-muted-foreground">(default: {config.defaultTime}m)</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {hasPendingChange && (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => saveChange(product.id)}
                            disabled={saving === product.id}
                          >
                            {saving === product.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          {filteredProducts.length} de {products.length} productos • Los tiempos vacíos usan el valor por defecto de la estación
        </p>
      </CardContent>
    </Card>
  );
}
