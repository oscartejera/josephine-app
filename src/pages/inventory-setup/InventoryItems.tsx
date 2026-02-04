/**
 * Inventory Items
 * Master catalog of all inventory items with filters and CRUD
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

// Mock data - realistic inventory items
const mockItems = [
  {
    id: '1',
    name: 'Salmón Fresco',
    type: 'Food',
    category: 'Pescados y Mariscos',
    supplier: 'Pescaderías del Norte',
    orderUnit: 'kg',
    orderQty: 1,
    price: 24.50,
    vatRate: 10,
  },
  {
    id: '2',
    name: 'Jamón Ibérico de Bellota',
    type: 'Food',
    category: 'Charcutería',
    supplier: 'Ibéricos Salamanca',
    orderUnit: 'kg',
    orderQty: 1,
    price: 89.00,
    vatRate: 10,
  },
  {
    id: '3',
    name: 'Arroz Bomba',
    type: 'Food',
    category: 'Secos',
    supplier: 'Arroces Valencia',
    orderUnit: 'Pack',
    orderQty: 5,
    price: 15.50,
    vatRate: 10,
  },
  {
    id: '4',
    name: 'Aceite de Oliva Virgen Extra',
    type: 'Food',
    category: 'Aceites',
    supplier: 'Aceites Jaén',
    orderUnit: 'L',
    orderQty: 5,
    price: 42.00,
    vatRate: 10,
  },
  {
    id: '5',
    name: 'Cerveza Estrella Galicia',
    type: 'Beverage',
    category: 'Cervezas',
    supplier: 'Distribuidora Bebidas',
    orderUnit: 'Case',
    orderQty: 24,
    price: 18.00,
    vatRate: 21,
  },
  {
    id: '6',
    name: 'Vino Rioja Reserva',
    type: 'Beverage',
    category: 'Vinos',
    supplier: 'Bodegas Rioja',
    orderUnit: 'Case',
    orderQty: 12,
    price: 96.00,
    vatRate: 21,
  },
  {
    id: '7',
    name: 'Bolsas Basura 100L',
    type: 'Misc',
    category: 'Limpieza',
    supplier: 'Suministros Hostelería',
    orderUnit: 'Pack',
    orderQty: 50,
    price: 22.00,
    vatRate: 21,
  },
  {
    id: '8',
    name: 'Papel Térmico 80mm',
    type: 'Misc',
    category: 'Papelería',
    supplier: 'Suministros Oficina',
    orderUnit: 'Case',
    orderQty: 20,
    price: 31.50,
    vatRate: 21,
  },
];

export default function InventoryItems() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const filteredItems = mockItems.filter(item => {
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
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add item
          </Button>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
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
            {filteredItems.map((item) => (
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

        {/* Pagination */}
        <div className="border-t p-4 flex items-center justify-between text-sm text-muted-foreground">
          <div>1-{filteredItems.length} of {mockItems.length}</div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled>Previous</Button>
            <Button variant="outline" size="sm" disabled>Next</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
