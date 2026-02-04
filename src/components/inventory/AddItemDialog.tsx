/**
 * Add Item Dialog
 * Form completo para añadir items de inventario
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AddItemDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddItemDialog({ open, onClose, onSuccess }: AddItemDialogProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState('food');
  const [category, setCategory] = useState('');
  const [supplier, setSupplier] = useState('');
  const [orderUnit, setOrderUnit] = useState('kg');
  const [orderQty, setOrderQty] = useState('1');
  const [price, setPrice] = useState('');
  const [vatRate, setVatRate] = useState('10');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name || !price) {
      toast.error('Name and Price are required');
      return;
    }

    setSaving(true);
    
    try {
      const { error } = await supabase
        .from('inventory_items')
        .insert({
          org_id: 'demo-org', // TODO: Get from auth
          name,
          type,
          category_name: category,
          order_unit: orderUnit,
          order_unit_qty: parseFloat(orderQty),
          price: parseFloat(price),
          vat_rate: parseFloat(vatRate),
          is_active: true,
        });

      if (error) throw error;

      toast.success('Item added successfully');
      
      // Reset form
      setName('');
      setType('food');
      setCategory('');
      setSupplier('');
      setOrderUnit('kg');
      setOrderQty('1');
      setPrice('');
      setVatRate('10');
      
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error('Error adding item: ' + error.message);
      console.error('Error:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Inventory Item</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Salmón Fresco"
            />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Type *</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="food">Food</SelectItem>
                <SelectItem value="beverage">Beverage</SelectItem>
                <SelectItem value="misc">Misc</SelectItem>
                <SelectItem value="packaging">Packaging</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pescados y Mariscos">Pescados y Mariscos</SelectItem>
                <SelectItem value="Carnes">Carnes</SelectItem>
                <SelectItem value="Charcutería">Charcutería</SelectItem>
                <SelectItem value="Verduras">Verduras</SelectItem>
                <SelectItem value="Secos">Secos</SelectItem>
                <SelectItem value="Aceites">Aceites</SelectItem>
                <SelectItem value="Cervezas">Cervezas</SelectItem>
                <SelectItem value="Vinos">Vinos</SelectItem>
                <SelectItem value="Refrescos">Refrescos</SelectItem>
                <SelectItem value="Limpieza">Limpieza</SelectItem>
                <SelectItem value="Papelería">Papelería</SelectItem>
                <SelectItem value="Desechables">Desechables</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Main Supplier */}
          <div className="space-y-2">
            <Label htmlFor="supplier">Main Supplier</Label>
            <Input
              id="supplier"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="e.g., Pescaderías del Norte"
            />
          </div>

          {/* Order Unit + Qty */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="orderUnit">Order Unit</Label>
              <Select value={orderUnit} onValueChange={setOrderUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="L">L (Liters)</SelectItem>
                  <SelectItem value="Pack">Pack</SelectItem>
                  <SelectItem value="Case">Case</SelectItem>
                  <SelectItem value="ea">Each (ea)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="orderQty">Qty per Unit</Label>
              <Input
                id="orderQty"
                type="number"
                value={orderQty}
                onChange={(e) => setOrderQty(e.target.value)}
                placeholder="1"
              />
            </div>
          </div>

          {/* Price + VAT */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Price (€) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vat">VAT Rate (%)</Label>
              <Select value={vatRate} onValueChange={setVatRate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0%</SelectItem>
                  <SelectItem value="4">4%</SelectItem>
                  <SelectItem value="10">10%</SelectItem>
                  <SelectItem value="21">21%</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Add Item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
