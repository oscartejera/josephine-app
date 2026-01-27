import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Plus, Search, Package, Edit2, Trash2, Save, Loader2, 
  ChefHat, Wine, Timer, ImagePlus, Eye, EyeOff,
  LayoutGrid, List, Filter, MapPin, Building2
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  category: string | null;
  price: number;
  image_url: string | null;
  description: string | null;
  is_active: boolean;
  kds_destination: 'kitchen' | 'bar' | 'prep';
  target_prep_time: number | null;
  group_id: string;
  assigned_locations: string[]; // IDs of assigned locations
}

interface ProductFormData {
  name: string;
  category: string;
  price: string;
  image_url: string;
  description: string;
  is_active: boolean;
  kds_destination: 'kitchen' | 'bar' | 'prep';
  target_prep_time: string;
  assigned_locations: string[];
}

const emptyFormData: ProductFormData = {
  name: '',
  category: '',
  price: '',
  image_url: '',
  description: '',
  is_active: true,
  kds_destination: 'kitchen',
  target_prep_time: '',
  assigned_locations: [],
};

const destinationConfig = {
  kitchen: { icon: ChefHat, label: 'Cocina', color: 'bg-orange-500/20 text-orange-500' },
  bar: { icon: Wine, label: 'Bar', color: 'bg-purple-500/20 text-purple-500' },
  prep: { icon: Timer, label: 'Prep', color: 'bg-blue-500/20 text-blue-500' },
};

const defaultCategories = ['Bebidas', 'Entrantes', 'Principales', 'Postres', 'Otros'];

export function ProductCatalogManager() {
  const { locations, group } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  
  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(emptyFormData);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Derived data
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean) as string[]);
    defaultCategories.forEach(c => cats.add(c));
    return Array.from(cats).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = !searchTerm || 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
      const matchesActive = showInactive || p.is_active;
      return matchesSearch && matchesCategory && matchesActive;
    });
  }, [products, searchTerm, categoryFilter, showInactive]);

  const stats = useMemo(() => ({
    total: products.length,
    active: products.filter(p => p.is_active).length,
    inactive: products.filter(p => !p.is_active).length,
    byCategory: categories.map(cat => ({
      name: cat,
      count: products.filter(p => p.category === cat).length
    }))
  }), [products, categories]);

  const fetchProducts = useCallback(async () => {
    if (!group?.id) return;
    
    setLoading(true);
    try {
      // Fetch all products for this group (centralized catalog)
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, category, price, image_url, description, is_active, kds_destination, target_prep_time, group_id')
        .eq('group_id', group.id)
        .order('category')
        .order('name');

      if (productsError) throw productsError;

      // Fetch product-location assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('product_locations')
        .select('product_id, location_id, is_active')
        .in('product_id', productsData?.map(p => p.id) || []);

      if (assignmentsError) throw assignmentsError;

      // Create map of product assignments
      const assignmentsMap = new Map<string, string[]>();
      assignmentsData?.forEach(a => {
        if (a.is_active) {
          const existing = assignmentsMap.get(a.product_id) || [];
          existing.push(a.location_id);
          assignmentsMap.set(a.product_id, existing);
        }
      });

      setProducts((productsData || []).map(p => ({
        ...p,
        price: Number(p.price) || 0,
        kds_destination: (p.kds_destination || 'kitchen') as 'kitchen' | 'bar' | 'prep',
        assigned_locations: assignmentsMap.get(p.id) || [],
      })));
    } catch {
      toast.error('Error al cargar productos');
    } finally {
      setLoading(false);
    }
  }, [group?.id]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setFormData({
      ...emptyFormData,
      assigned_locations: locations.map(l => l.id), // Default: all locations
    });
    setEditDialogOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category || '',
      price: product.price.toString(),
      image_url: product.image_url || '',
      description: product.description || '',
      is_active: product.is_active,
      kds_destination: product.kds_destination,
      target_prep_time: product.target_prep_time?.toString() || '',
      assigned_locations: product.assigned_locations,
    });
    setEditDialogOpen(true);
  };

  const handleOpenDelete = (product: Product) => {
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  };

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      toast.error('El nombre es obligatorio');
      return false;
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      toast.error('El precio debe ser mayor que 0');
      return false;
    }
    if (formData.assigned_locations.length === 0) {
      toast.error('Selecciona al menos un local');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    if (!group?.id) {
      toast.error('Error de configuración');
      return;
    }

    setSaving(true);
    try {
      const productData = {
        name: formData.name.trim(),
        category: formData.category || null,
        price: parseFloat(formData.price),
        image_url: formData.image_url || null,
        description: formData.description || null,
        is_active: formData.is_active,
        kds_destination: formData.kds_destination,
        target_prep_time: formData.target_prep_time ? parseInt(formData.target_prep_time) : null,
      };

      let productId = editingProduct?.id;

      if (editingProduct) {
        // Update existing product
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);

        if (error) throw error;
      } else {
        // Create new product
        const { data: newProduct, error } = await supabase
          .from('products')
          .insert({
            ...productData,
            group_id: group.id,
            location_id: formData.assigned_locations[0], // Keep legacy field
          })
          .select('id')
          .single();

        if (error) throw error;
        productId = newProduct.id;
      }

      if (productId) {
        // Update location assignments
        // First, delete all existing assignments for this product
        await supabase
          .from('product_locations')
          .delete()
          .eq('product_id', productId);

        // Then insert new assignments
        const assignments = formData.assigned_locations.map(locationId => ({
          product_id: productId,
          location_id: locationId,
          is_active: true,
        }));

        const { error: assignError } = await supabase
          .from('product_locations')
          .insert(assignments);

        if (assignError) throw assignError;
      }

      toast.success(editingProduct ? 'Producto actualizado' : 'Producto creado');
      setEditDialogOpen(false);
      fetchProducts();
    } catch {
      toast.error('Error al guardar producto');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!productToDelete) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productToDelete.id);

      if (error) throw error;

      toast.success('Producto eliminado');
      setDeleteDialogOpen(false);
      setProductToDelete(null);
      fetchProducts();
    } catch {
      toast.error('Error al eliminar producto');
    }
  };

  const handleToggleActive = async (product: Product) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: !product.is_active })
        .eq('id', product.id);

      if (error) throw error;

      setProducts(prev => prev.map(p => 
        p.id === product.id ? { ...p, is_active: !p.is_active } : p
      ));

      toast.success(product.is_active ? 'Producto desactivado' : 'Producto activado');
    } catch {
      toast.error('Error al actualizar producto');
    }
  };

  const toggleLocationAssignment = (locationId: string) => {
    setFormData(prev => {
      const isAssigned = prev.assigned_locations.includes(locationId);
      return {
        ...prev,
        assigned_locations: isAssigned
          ? prev.assigned_locations.filter(id => id !== locationId)
          : [...prev.assigned_locations, locationId],
      };
    });
  };

  const selectAllLocations = () => {
    setFormData(prev => ({
      ...prev,
      assigned_locations: locations.map(l => l.id),
    }));
  };

  const deselectAllLocations = () => {
    setFormData(prev => ({
      ...prev,
      assigned_locations: [],
    }));
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
    <div className="space-y-6">
      {/* Header with Stats */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Catálogo Centralizado de Productos
              </CardTitle>
              <CardDescription>
                Gestiona productos una vez, asígnalos a múltiples locales. Los cambios se aplican a todos los locales asignados.
              </CardDescription>
            </div>
            <Button onClick={handleOpenCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Producto
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Total Productos</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="bg-green-500/10 rounded-lg p-4">
              <p className="text-sm text-green-600">Activos</p>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Inactivos</p>
              <p className="text-2xl font-bold">{stats.inactive}</p>
            </div>
            <div className="bg-primary/10 rounded-lg p-4">
              <p className="text-sm text-primary">Locales</p>
              <p className="text-2xl font-bold text-primary">{locations.length}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
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
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Switch
                checked={showInactive}
                onCheckedChange={setShowInactive}
                id="show-inactive"
              />
              <Label htmlFor="show-inactive" className="text-sm">
                Mostrar inactivos
              </Label>
            </div>

            <div className="flex gap-1 border rounded-lg p-1">
              <Button
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Products Display */}
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p className="font-medium">No hay productos</p>
              <p className="text-sm">Crea tu primer producto para empezar</p>
            </div>
          ) : viewMode === 'table' ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]"></TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead>Destino KDS</TableHead>
                    <TableHead>Locales</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => {
                    const dest = destinationConfig[product.kds_destination];
                    const DestIcon = dest.icon;
                    
                    return (
                      <TableRow 
                        key={product.id} 
                        className={cn(!product.is_active && 'opacity-50')}
                      >
                        <TableCell>
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                            {product.image_url ? (
                              <img 
                                src={product.image_url} 
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{product.name}</p>
                            {product.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {product.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{product.category || 'Sin categoría'}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          €{product.price.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn('gap-1', dest.color)}>
                            <DestIcon className="h-3 w-3" />
                            {dest.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">
                              {product.assigned_locations.length === locations.length 
                                ? 'Todos' 
                                : `${product.assigned_locations.length}/${locations.length}`}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(product)}
                            className={cn(
                              product.is_active ? 'text-green-600' : 'text-muted-foreground'
                            )}
                          >
                            {product.is_active ? (
                              <Eye className="h-4 w-4" />
                            ) : (
                              <EyeOff className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEdit(product)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleOpenDelete(product)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProducts.map((product) => {
                const dest = destinationConfig[product.kds_destination];
                const DestIcon = dest.icon;
                
                return (
                  <Card 
                    key={product.id} 
                    className={cn(
                      "overflow-hidden transition-all hover:shadow-md cursor-pointer",
                      !product.is_active && 'opacity-50'
                    )}
                    onClick={() => handleOpenEdit(product)}
                  >
                    <div className="aspect-square bg-muted relative">
                      {product.image_url ? (
                        <img 
                          src={product.image_url} 
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-12 w-12 text-muted-foreground/50" />
                        </div>
                      )}
                      <Badge className={cn('absolute top-2 right-2 gap-1', dest.color)}>
                        <DestIcon className="h-3 w-3" />
                      </Badge>
                      <Badge variant="secondary" className="absolute top-2 left-2 gap-1">
                        <MapPin className="h-3 w-3" />
                        {product.assigned_locations.length}
                      </Badge>
                      {!product.is_active && (
                        <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                          <Badge variant="secondary">Inactivo</Badge>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.category}</p>
                        </div>
                        <p className="font-bold text-primary shrink-0">€{product.price.toFixed(2)}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-4">
            Mostrando {filteredProducts.length} de {products.length} productos
          </p>
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
            </DialogTitle>
            <DialogDescription>
              {editingProduct 
                ? 'Modifica los detalles del producto. Los cambios se aplicarán a todos los locales asignados.'
                : 'Añade un nuevo producto al catálogo centralizado'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Image Preview */}
            <div className="flex gap-4">
              <div className="w-24 h-24 rounded-lg bg-muted overflow-hidden shrink-0">
                {formData.image_url ? (
                  <img 
                    src={formData.image_url} 
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImagePlus className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor="image_url">URL de Imagen</Label>
                <Input
                  id="image_url"
                  placeholder="https://ejemplo.com/imagen.jpg"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                />
              </div>
            </div>

            {/* Name & Category */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  placeholder="Nombre del producto"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoría</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(v) => setFormData({ ...formData, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Price & Prep Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Precio (€) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prep_time">Tiempo Prep. (min)</Label>
                <Input
                  id="prep_time"
                  type="number"
                  min="1"
                  max="60"
                  placeholder="8"
                  value={formData.target_prep_time}
                  onChange={(e) => setFormData({ ...formData, target_prep_time: e.target.value })}
                />
              </div>
            </div>

            {/* KDS Destination */}
            <div className="space-y-2">
              <Label>Destino KDS</Label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(destinationConfig) as [keyof typeof destinationConfig, typeof destinationConfig.kitchen][]).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <Button
                      key={key}
                      type="button"
                      variant={formData.kds_destination === key ? 'default' : 'outline'}
                      className="gap-2"
                      onClick={() => setFormData({ ...formData, kds_destination: key })}
                    >
                      <Icon className="h-4 w-4" />
                      {config.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Location Assignment */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Asignar a Locales *
                </Label>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={selectAllLocations}
                  >
                    Todos
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={deselectAllLocations}
                  >
                    Ninguno
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 p-4 border rounded-lg bg-muted/30">
                {locations.map(location => (
                  <div 
                    key={location.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                      formData.assigned_locations.includes(location.id)
                        ? "border-primary bg-primary/5"
                        : "border-transparent bg-background hover:bg-muted"
                    )}
                    onClick={() => toggleLocationAssignment(location.id)}
                  >
                    <Checkbox
                      checked={formData.assigned_locations.includes(location.id)}
                      onCheckedChange={() => toggleLocationAssignment(location.id)}
                    />
                    <div>
                      <p className="font-medium">{location.name}</p>
                      {location.city && (
                        <p className="text-xs text-muted-foreground">{location.city}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {formData.assigned_locations.length} de {locations.length} locales seleccionados
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                placeholder="Descripción opcional del producto"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between border-t pt-4">
              <div>
                <p className="font-medium">Producto Activo</p>
                <p className="text-sm text-muted-foreground">
                  Los productos inactivos no aparecen en el POS
                </p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {editingProduct ? 'Guardar Cambios' : 'Crear Producto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de eliminar "{productToDelete?.name}" de todos los locales. 
              Esta acción no se puede deshacer. Los registros históricos de ventas se mantendrán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
