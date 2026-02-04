/**
 * Inventory Items
 * Master catalog of all inventory items with filters and CRUD
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { AddItemDialog } from '@/components/inventory/AddItemDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, MoreVertical, ArrowUpDown } from 'lucide-react';

// Generate 400+ realistic items
const generateMockItems = () => {
  const items: any[] = [];
  const baseNames = [
    // Food items (200+)
    'Salmón Fresco', 'Atún Rojo', 'Lubina', 'Dorada', 'Merluza', 'Gambas', 'Langostinos', 'Pulpo',
    'Jamón Ibérico', 'Jamón Serrano', 'Chorizo', 'Salchichón', 'Lomo Embuchado', 'Morcilla',
    'Chuletón Buey', 'Solomillo Ternera', 'Entrecot', 'Cordero Lechal', 'Cochinillo', 'Pollo',
    'Arroz Bomba', 'Arroz Integral', 'Pasta Spaghetti', 'Pasta Penne', 'Garbanzos', 'Lentejas',
    'Aceite Oliva VE', 'Aceite Girasol', 'Vinagre Jerez', 'Sal Marina', 'Pimienta Negra',
    'Tomate Natural', 'Pimiento Rojo', 'Cebolla', 'Ajo', 'Patata', 'Zanahoria', 'Lechuga',
    'Huevos Camperos', 'Leche Entera', 'Nata Cocinar', 'Queso Manchego', 'Queso Cabra',
    'Pan Barra', 'Pan Molde', 'Harina', 'Levadura', 'Azúcar', 'Sal',
    'Tomate Triturado', 'Pimientos Padrón', 'Alcachofas', 'Espárragos', 'Champiñones',
    // Beverages (100+)
    'Cerveza Estrella', 'Cerveza Mahou', 'Cerveza Alhambra', 'Cerveza Cruzcampo',
    'Vino Rioja', 'Vino Ribera', 'Vino Albariño', 'Vino Verdejo', 'Cava',
    'Coca-Cola', 'Fanta', 'Sprite', 'Agua Mineral', 'Agua con Gas',
    'Zumo Naranja', 'Zumo Tomate', 'Café Grano', 'Té Verde', 'Té Negro',
    // Misc/Packaging (100+)
    'Bolsa Basura 100L', 'Bolsa Basura 50L', 'Papel Térmico 80mm', 'Papel Térmico 57mm',
    'Servilletas', 'Manteles Papel', 'Guantes Latex', 'Guantes Nitrilo',
    'Detergente Industrial', 'Lavavajillas', 'Desinfectante', 'Limpiador Suelos',
    'Papel Aluminio', 'Film Transparente', 'Bolsas Vacío', 'Recipientes Plástico',
  ];

  const categories = {
    'Food': ['Pescados y Mariscos', 'Carnes', 'Charcutería', 'Verduras', 'Secos', 'Aceites', 'Lácteos', 'Pan'],
    'Beverage': ['Cervezas', 'Vinos', 'Refrescos', 'Zumos', 'Café y Té'],
    'Misc': ['Limpieza', 'Papelería', 'Desechables', 'Utensilios'],
  };

  const suppliers = [
    'Pescaderías del Norte', 'Carnicerías Premium', 'Ibéricos Salamanca',
    'Verduras Frescas SL', 'Arroces Valencia', 'Aceites Jaén',
    'Distribuidora Bebidas', 'Bodegas Rioja', 'Refrescos Levante',
    'Suministros Hostelería', 'Suministros Oficina', 'Limpieza Pro',
  ];

  // Generate 400+ items by varying base names
  let id = 1;
  for (let i = 0; i < 400; i++) {
    const baseName = baseNames[i % baseNames.length];
    const variation = i < baseNames.length ? '' : ` ${Math.floor(i / baseNames.length) + 1}`;
    const type = i < 200 ? 'Food' : i < 300 ? 'Beverage' : 'Misc';
    const categoryList = categories[type];
    const category = categoryList[i % categoryList.length];
    const supplier = suppliers[i % suppliers.length];
    
    const basePrice = type === 'Food' ? 15 + Math.random() * 40 :
                      type === 'Beverage' ? 8 + Math.random() * 30 :
                      5 + Math.random() * 25;

    items.push({
      id: String(id++),
      name: baseName + variation,
      type,
      category,
      supplier,
      orderUnit: type === 'Beverage' ? 'Case' : type === 'Food' && Math.random() > 0.5 ? 'kg' : 'Pack',
      orderQty: type === 'Beverage' ? 12 + Math.floor(Math.random() * 12) : Math.ceil(Math.random() * 10),
      price: Math.round(basePrice * 100) / 100,
      vatRate: type === 'Food' ? 10 : 21,
    });
  }

  return items;
};

const mockItems = generateMockItems();

const ITEMS_PER_PAGE = 50;

export default function InventoryItems() {
  const [items, setItems] = useState<any[]>(mockItems);
  const [loading, setLoading] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // Load items from Supabase
  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      if (data && data.length > 0) {
        // Map to UI format
        const mapped = data.map(item => ({
          id: item.id,
          name: item.name,
          type: item.type || 'Food',
          category: item.category_name || 'Other',
          supplier: 'Demo Supplier', // TODO: Join with suppliers
          orderUnit: item.order_unit || 'kg',
          orderQty: item.order_unit_qty || 1,
          price: item.price || 0,
          vatRate: item.vat_rate || 10,
        }));
        setItems(mapped);
      } else {
        // Use mock data if no DB data
        setItems(mockItems);
      }
    } catch (error) {
      console.error('Error loading items:', error);
      // Fallback to mock
      setItems(mockItems);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item => {
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
    if (selectedSupplier !== 'all' && item.supplier !== selectedSupplier) return false;
    return true;
  });

  const toggleSelectAll = () => {
    if (selectedItems.length === filteredItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredItems.map(item => item.id));
    }
  };

  const toggleSelectItem = (id: string) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(i => i !== id));
    } else {
      setSelectedItems([...selectedItems, id]);
    }
  };

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  // Export to PDF
  const handleExportPDF = () => {
    toast.info('Generating PDF...');
    
    // Simple CSV export for now (PDF library would add ~200KB)
    const headers = ['Name', 'Type', 'Category', 'Supplier', 'Order Unit', 'Price', 'VAT Rate'];
    const rows = filteredItems.map(item => [
      item.name,
      item.type,
      item.category,
      item.supplier,
      `${item.orderUnit} (${item.orderQty}${item.orderUnit === 'kg' ? 'kg' : 'ea'})`,
      `€${item.price.toFixed(2)}`,
      `${item.vatRate}%`,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-items-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('Exported successfully');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground mb-1">
            Inventory Setup / Items
          </div>
          <h1 className="text-3xl font-bold">Inventory Items</h1>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add item
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportPDF}>
                <FileDown className="h-4 w-4 mr-2" />
                Export to CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-4 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger>
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="Pescados y Mariscos">Pescados y Mariscos</SelectItem>
            <SelectItem value="Charcutería">Charcutería</SelectItem>
            <SelectItem value="Secos">Secos</SelectItem>
            <SelectItem value="Cervezas">Cervezas</SelectItem>
            <SelectItem value="Vinos">Vinos</SelectItem>
            <SelectItem value="Limpieza">Limpieza</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
          <SelectTrigger>
            <SelectValue placeholder="Supplier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Suppliers</SelectItem>
            <SelectItem value="Pescaderías del Norte">Pescaderías del Norte</SelectItem>
            <SelectItem value="Ibéricos Salamanca">Ibéricos Salamanca</SelectItem>
            <SelectItem value="Arroces Valencia">Arroces Valencia</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedLocation} onValueChange={setSelectedLocation}>
          <SelectTrigger>
            <SelectValue placeholder="All Locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            <SelectItem value="salamanca">La Taberna Centro</SelectItem>
            <SelectItem value="chamberi">Chamberí</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedItems.length === filteredItems.length}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" className="gap-1 -ml-3">
                  Name <ArrowUpDown className="h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Main Supplier</TableHead>
              <TableHead>Order Unit</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">VAT Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedItems.includes(item.id)}
                    onCheckedChange={() => toggleSelectItem(item.id)}
                  />
                </TableCell>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{item.type}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{item.category}</TableCell>
                <TableCell className="text-muted-foreground">{item.supplier}</TableCell>
                <TableCell>
                  <span className="font-mono text-sm">
                    {item.orderUnit} ({item.orderQty}{item.orderUnit === 'kg' || item.orderUnit === 'L' ? item.orderUnit.toLowerCase() : 'ea'})
                  </span>
                </TableCell>
                <TableCell className="text-right font-medium">
                  €{item.price.toFixed(2)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {item.vatRate}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Pagination - Minimal with arrows only */}
        <div className="border-t p-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredItems.length)} of {filteredItems.length}
          </div>
          
          <div className="flex items-center gap-1">
            {currentPage > 1 && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={handlePrevPage}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Add Item Dialog */}
      <AddItemDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSuccess={loadItems}
      />
    </div>
  );
}
