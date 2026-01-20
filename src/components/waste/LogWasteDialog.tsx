import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';

const WASTE_REASONS = [
  { value: 'broken', label: 'Broken' },
  { value: 'end_of_day', label: 'End of day' },
  { value: 'expired', label: 'Expired' },
  { value: 'theft', label: 'Theft' },
  { value: 'other', label: 'Other' },
] as const;

const formSchema = z.object({
  inventory_item_id: z.string().min(1, 'Please select an item'),
  location_id: z.string().min(1, 'Please select a location'),
  quantity: z.coerce.number().positive('Quantity must be positive'),
  reason: z.string().min(1, 'Please select a reason'),
  waste_value: z.coerce.number().min(0, 'Value must be 0 or more'),
});

type FormValues = z.infer<typeof formSchema>;

interface InventoryItem {
  id: string;
  name: string;
  last_cost: number | null;
  unit: string | null;
}

interface LogWasteDialogProps {
  onSuccess?: () => void;
  defaultLocationId?: string;
}

export function LogWasteDialog({ onSuccess, defaultLocationId }: LogWasteDialogProps) {
  const { locations } = useApp();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      inventory_item_id: '',
      location_id: defaultLocationId || '',
      quantity: 1,
      reason: '',
      waste_value: 0,
    },
  });

  // Fetch inventory items
  useEffect(() => {
    async function fetchItems() {
      setIsLoadingItems(true);
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, name, last_cost, unit')
        .order('name');

      if (error) {
        console.error('Error fetching inventory items:', error);
        // Generate demo items if none exist
        setInventoryItems([
          { id: 'demo-1', name: 'Ensalada mixta', last_cost: 2.50, unit: 'kg' },
          { id: 'demo-2', name: 'Tomate fresco', last_cost: 1.80, unit: 'kg' },
          { id: 'demo-3', name: 'Lechuga romana', last_cost: 1.20, unit: 'kg' },
          { id: 'demo-4', name: 'Pollo asado', last_cost: 8.50, unit: 'kg' },
          { id: 'demo-5', name: 'Salmón', last_cost: 15.00, unit: 'kg' },
          { id: 'demo-6', name: 'Queso manchego', last_cost: 12.00, unit: 'kg' },
          { id: 'demo-7', name: 'Pan de barra', last_cost: 0.80, unit: 'unit' },
          { id: 'demo-8', name: 'Leche entera', last_cost: 0.95, unit: 'L' },
        ]);
      } else {
        setInventoryItems(data?.length ? data : [
          { id: 'demo-1', name: 'Ensalada mixta', last_cost: 2.50, unit: 'kg' },
          { id: 'demo-2', name: 'Tomate fresco', last_cost: 1.80, unit: 'kg' },
          { id: 'demo-3', name: 'Lechuga romana', last_cost: 1.20, unit: 'kg' },
          { id: 'demo-4', name: 'Pollo asado', last_cost: 8.50, unit: 'kg' },
        ]);
      }
      setIsLoadingItems(false);
    }
    fetchItems();
  }, []);

  // Auto-calculate value when item or quantity changes
  const selectedItemId = form.watch('inventory_item_id');
  const quantity = form.watch('quantity');

  useEffect(() => {
    const selectedItem = inventoryItems.find(i => i.id === selectedItemId);
    if (selectedItem?.last_cost && quantity) {
      const calculatedValue = selectedItem.last_cost * quantity;
      form.setValue('waste_value', Math.round(calculatedValue * 100) / 100);
    }
  }, [selectedItemId, quantity, inventoryItems, form]);

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);

    try {
      // Check if using demo items
      const isDemo = values.inventory_item_id.startsWith('demo-');
      
      if (isDemo) {
        // Simulate success for demo
        toast({
          title: 'Waste logged (Demo)',
          description: 'In production, this would save to the database.',
        });
        setOpen(false);
        form.reset();
        onSuccess?.();
        return;
      }

      const { error } = await supabase.from('waste_events').insert({
        inventory_item_id: values.inventory_item_id,
        location_id: values.location_id,
        quantity: values.quantity,
        reason: values.reason,
        waste_value: values.waste_value,
      });

      if (error) throw error;

      toast({
        title: 'Waste logged successfully',
        description: `${quantity} units recorded as ${values.reason}`,
      });

      setOpen(false);
      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error('Error logging waste:', error);
      toast({
        variant: 'destructive',
        title: 'Error logging waste',
        description: 'Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedItem = inventoryItems.find(i => i.id === selectedItemId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Log Waste
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Log Waste Event</DialogTitle>
          <DialogDescription>
            Record a new waste event for inventory tracking.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Location */}
            <FormField
              control={form.control}
              name="location_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Item */}
            <FormField
              control={form.control}
              name="inventory_item_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                    disabled={isLoadingItems}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingItems ? "Loading items..." : "Select item"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {inventoryItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} {item.last_cost ? `(€${item.last_cost}/${item.unit || 'unit'})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Quantity */}
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Quantity {selectedItem?.unit ? `(${selectedItem.unit})` : ''}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      min="0.1"
                      placeholder="Enter quantity"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Reason */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select reason" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {WASTE_REASONS.map((reason) => (
                        <SelectItem key={reason.value} value={reason.value}>
                          {reason.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Value */}
            <FormField
              control={form.control}
              name="waste_value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Value (€)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Calculated automatically"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Log Waste'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
