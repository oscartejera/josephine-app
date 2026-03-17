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
import { useApp } from '@/contexts/AppContext';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface AddItemDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddItemDialog({ open, onClose, onSuccess }: AddItemDialogProps) {
  const { t } = useTranslation();
  const { group } = useApp();
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
      toast.error(t('addItem.toastRequired'));
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from('inventory_items')
        .insert({
          org_id: group?.id || '',
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

      toast.success(t('addItem.toastAdded'));

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
      toast.error(t('addItem.toastAddError') + ': ' + error.message);
      console.error('Error:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t('inventory.AddItemDialog.addInventoryItem')}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">{t('inventory.AddItemDialog.name')}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('inventory.egSalmonFresco')}
            />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label htmlFor="type">{t('inventory.AddItemDialog.type')}</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="food">{t('inventory.AddItemDialog.food')}</SelectItem>
                <SelectItem value="beverage">{t('inventory.AddItemDialog.beverage')}</SelectItem>
                <SelectItem value="misc">{t('inventory.AddItemDialog.misc')}</SelectItem>
                <SelectItem value="packaging">{t('inventory.AddItemDialog.packaging')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">{t('inventory.AddItemDialog.category')}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pescados y Mariscos">{t('inventory.AddItemDialog.pescadosYMariscos')}</SelectItem>
                <SelectItem value="Carnes">{t('inventory.AddItemDialog.carnes')}</SelectItem>
                <SelectItem value={t('inventory.charcuteria')}>{t('inventory.charcuteria')}</SelectItem>
                <SelectItem value="Verduras">{t('inventory.AddItemDialog.verduras')}</SelectItem>
                <SelectItem value="Secos">{t('inventory.AddItemDialog.secos')}</SelectItem>
                <SelectItem value="Aceites">{t('inventory.AddItemDialog.aceites')}</SelectItem>
                <SelectItem value="Cervezas">{t('inventory.AddItemDialog.cervezas')}</SelectItem>
                <SelectItem value="Vinos">{t('inventory.AddItemDialog.vinos')}</SelectItem>
                <SelectItem value="Refrescos">{t('inventory.AddItemDialog.refrescos')}</SelectItem>
                <SelectItem value="Limpieza">{t('inventory.AddItemDialog.limpieza')}</SelectItem>
                <SelectItem value={t('inventory.papeleria')}>{t('inventory.papeleria')}</SelectItem>
                <SelectItem value="Desechables">{t('inventory.AddItemDialog.desechables')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Main Supplier */}
          <div className="space-y-2">
            <Label htmlFor="supplier">{t('inventory.AddItemDialog.mainSupplier')}</Label>
            <Input
              id="supplier"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder={t('inventory.egPescaderiasDelNorte')}
            />
          </div>

          {/* Order Unit + Qty */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="orderUnit">{t('inventory.AddItemDialog.orderUnit')}</Label>
              <Select value={orderUnit} onValueChange={setOrderUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="L">{t('inventory.AddItemDialog.lLiters')}</SelectItem>
                  <SelectItem value="Pack">{t('inventory.AddItemDialog.pack')}</SelectItem>
                  <SelectItem value="Case">{t('inventory.AddItemDialog.case')}</SelectItem>
                  <SelectItem value="ea">{t('inventory.AddItemDialog.eachEa')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="orderQty">{t('inventory.AddItemDialog.qtyPerUnit')}</Label>
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
              <Label htmlFor="price">{t('inventory.AddItemDialog.price')}</Label>
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
              <Label htmlFor="vat">{t('inventory.AddItemDialog.vatRate')}</Label>
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
            {t('inventory.AddItemDialog.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Add Item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
