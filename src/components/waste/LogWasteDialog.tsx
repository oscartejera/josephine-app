import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Camera, X as XIcon } from 'lucide-react';
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
import { useTranslation } from 'react-i18next';

const WASTE_REASON_KEYS = ['broken', 'end_of_day', 'expired', 'theft', 'other'] as const;

const formSchema = z.object({
  inventory_item_id: z.string().min(1, 'Please select an item'),
  location_id: z.string().min(1, 'Please select a location'),
  quantity: z.coerce.number().positive('Quantity must be positive'),
  reason: z.string().min(1, 'Please select a reason'),
  waste_value: z.coerce.number().min(0, 'Value must be 0 or more'),
  photo_url: z.string().optional(),
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
  const { t } = useTranslation();
  const { locations } = useApp();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Fetch inventory items from database (synced with POS products)
  useEffect(() => {
    async function fetchItems() {
      setIsLoadingItems(true);
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, name, last_cost, unit')
        .order('name');

      if (error) {
        console.error('Error fetching inventory items:', error);
        setInventoryItems([]);
      } else {
        setInventoryItems(data || []);
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

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', title: t('logWaste.photoTooLarge'), description: t('logWaste.maxSize') });
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const removePhoto = () => {
    setPhotoFile(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);

    try {
      // Check if using demo items
      const isDemo = values.inventory_item_id.startsWith('demo-');
      
      if (isDemo) {
        // Simulate success for demo
        toast({
          title: t('logWaste.demoTitle'),
          description: t('logWaste.demoDesc'),
        });
        setOpen(false);
        form.reset();
        removePhoto();
        onSuccess?.();
        return;
      }

      // Upload photo if provided
      let uploadedPhotoUrl: string | undefined;
      if (photoFile) {
        const ext = photoFile.name.split('.').pop() || 'jpg';
        const path = `waste/${values.location_id}/${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase
          .storage.from('waste-photos').upload(path, photoFile);
        if (uploadError) {
          console.error('Photo upload failed:', uploadError);
          // Continue without photo — non-blocking
        } else if (uploadData) {
          const { data: urlData } = supabase.storage
            .from('waste-photos')
            .getPublicUrl(uploadData.path);
          uploadedPhotoUrl = urlData?.publicUrl;
        }
      }

      const { error } = await supabase.from('waste_events').insert({
        inventory_item_id: values.inventory_item_id,
        location_id: values.location_id,
        quantity: values.quantity,
        reason: values.reason,
        waste_value: values.waste_value,
        ...(uploadedPhotoUrl ? { photo_url: uploadedPhotoUrl } : {}),
      });

      if (error) throw error;

      toast({
        title: t('logWaste.successTitle'),
        description: t('logWaste.successDesc', { quantity, reason: values.reason }),
      });

      setOpen(false);
      form.reset();
      removePhoto();
      onSuccess?.();
    } catch (error) {
      console.error('Error logging waste:', error);
      toast({
        variant: 'destructive',
        title: t('logWaste.errorTitle'),
        description: t('logWaste.errorDesc'),
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
          {t('logWaste.logWaste')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('logWaste.dialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('logWaste.dialogDesc')}
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
                  <FormLabel>{t('logWaste.location')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('logWaste.selectLocation')} />
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
                  <FormLabel>{t('logWaste.item')}</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                    disabled={isLoadingItems}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingItems ? t('logWaste.loadingItems') : t('logWaste.selectItem')} />
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
                    {t('logWaste.quantity')} {selectedItem?.unit ? `(${selectedItem.unit})` : ''}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      min="0.1"
                      placeholder={t('logWaste.enterQuantity')}
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
                  <FormLabel>{t('logWaste.reason')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('logWaste.selectReason')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {WASTE_REASON_KEYS.map((key) => (
                        <SelectItem key={key} value={key}>
                          {t(`logWaste.reasons.${key}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />


            {/* Photo upload */}
            <div className="space-y-2">
              <FormLabel>{t('logWaste.photoOptional')}</FormLabel>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoChange}
              />
              {photoPreview ? (
                <div className="relative w-full h-32 rounded-lg overflow-hidden border">
                  <img
                    src={photoPreview}
                    alt="Waste photo"
                    className="w-full h-full object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6"
                    onClick={removePhoto}
                  >
                    <XIcon className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4" />
                  {t('logWaste.takePhoto')}
                </Button>
              )}
            </div>

            {/* Value */}
            <FormField
              control={form.control}
              name="waste_value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('logWaste.valueEuro')}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={t('logWaste.calculatedAuto')}
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
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t('common.saving') : t('logWaste.logWaste')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
