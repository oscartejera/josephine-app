/**
 * Inventory Items
 * Master catalog of all inventory items with filters and CRUD
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
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
import { FileDown, ChevronLeft, ChevronRight, PackageOpen } from 'lucide-react';
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

const ITEMS_PER_PAGE = 50;

export default function InventoryItems() {
  const { locations } = useApp();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);

  // Load items from Supabase
  useEffect(() => {
    loadItems();
    loadCategories();
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    const { data } = await supabase
      .from('suppliers')
      .select('id, name')
      .order('name');
    if (data) setSuppliers(data);
  };

  const loadCategories = async () => {
    const { data } = await supabase
      .from('inventory_categories')
      .select('id, name')
      .order('name');
    if (data) setCategories(data);
  };

  const loadItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*, inventory_categories(name)')
        .eq('is_active', true)
        .order('name')
        .limit(1000);

      if (error) throw error;

      // Map to UI format with real category name from JOIN
      const mapped = (data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        type: item.type || 'Food',
        category: item.inventory_categories?.name || 'Other',
        supplier: item.supplier_name || '-',
        orderUnit: item.order_unit || item.unit || 'kg',
        orderQty: item.pack_size || 1,
        price: item.price || item.last_cost || 0,
        vatRate: item.vat_rate || 10,
      }));
      setItems(mapped);
    } catch (error) {
      console.error('Error loading items:', error);
      setItems([]);
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
            {categories.map(c => (
              <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
          <SelectTrigger>
            <SelectValue placeholder="Supplier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Suppliers</SelectItem>
            {suppliers.map(s => (
              <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedLocation} onValueChange={setSelectedLocation}>
          <SelectTrigger>
            <SelectValue placeholder="All Locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {locations.map(l => (
              <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
            ))}
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
