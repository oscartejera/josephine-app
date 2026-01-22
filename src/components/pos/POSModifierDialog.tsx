import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Plus, Minus, RefreshCw, Flame, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { POSProduct } from '@/hooks/usePOSData';

interface ModifierOption {
  id: string;
  name: string;
  price_delta: number;
}

interface ProductModifier {
  id: string;
  name: string;
  options: ModifierOption[];
}

interface SelectedModifier {
  modifier_name: string;
  option_name: string;
  price_delta: number;
  type: 'add' | 'remove' | 'substitute';
}

interface POSModifierDialogProps {
  open: boolean;
  onClose: () => void;
  product: POSProduct;
  onConfirm: (modifiers: SelectedModifier[], notes: string, isRush: boolean) => void;
}

// Quick modifier presets for items without configured modifiers
const QUICK_MODIFIERS = {
  remove: [
    'Sin sal', 'Sin salsa', 'Sin cebolla', 'Sin ajo', 'Sin gluten',
    'Sin lactosa', 'Sin picante', 'Sin aliño', 'Sin hielo', 'Sin limón'
  ],
  add: [
    'Extra queso', 'Extra salsa', 'Extra pan', 'Extra limón', 'Extra hielo',
    'Bien hecho', 'Poco hecho', 'Al punto', 'Muy caliente', 'Templado'
  ],
  substitute: [
    'Cambiar guarnición', 'En vez de patatas', 'En vez de ensalada',
    'Con arroz', 'Con verduras', 'Para llevar'
  ]
};

export function POSModifierDialog({ open, onClose, product, onConfirm }: POSModifierDialogProps) {
  const [productModifiers, setProductModifiers] = useState<ProductModifier[]>([]);
  const [selectedModifiers, setSelectedModifiers] = useState<SelectedModifier[]>([]);
  const [notes, setNotes] = useState('');
  const [isRush, setIsRush] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'configured' | 'quick'>('quick');
  const [customModifier, setCustomModifier] = useState('');

  // Load product-specific modifiers
  useEffect(() => {
    if (!open || !product.id) return;

    const fetchModifiers = async () => {
      setLoading(true);
      try {
        const { data: modifiers, error } = await supabase
          .from('pos_product_modifiers')
          .select(`
            id,
            name,
            pos_modifier_options (
              id,
              name,
              price_delta
            )
          `)
          .eq('product_id', product.id);

        if (!error && modifiers) {
          setProductModifiers(modifiers.map(m => ({
            id: m.id,
            name: m.name,
            options: (m.pos_modifier_options || []).map((o: any) => ({
              id: o.id,
              name: o.name,
              price_delta: Number(o.price_delta) || 0,
            })),
          })));
          
          // Switch to configured tab if product has modifiers
          if (modifiers.length > 0) {
            setActiveTab('configured');
          }
        }
      } catch (error) {
        console.error('Error loading modifiers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchModifiers();
    
    // Reset state when dialog opens
    setSelectedModifiers([]);
    setNotes('');
    setIsRush(false);
    setCustomModifier('');
  }, [open, product.id]);

  const addModifier = (modifier: SelectedModifier) => {
    // Check if already exists
    const exists = selectedModifiers.some(
      m => m.modifier_name === modifier.modifier_name && m.option_name === modifier.option_name
    );
    if (!exists) {
      setSelectedModifiers([...selectedModifiers, modifier]);
    }
  };

  const removeModifier = (index: number) => {
    setSelectedModifiers(selectedModifiers.filter((_, i) => i !== index));
  };

  const handleQuickModifier = (text: string, type: 'add' | 'remove' | 'substitute') => {
    addModifier({
      modifier_name: type === 'remove' ? 'Sin' : type === 'add' ? 'Extra' : 'Cambiar',
      option_name: text,
      price_delta: 0,
      type,
    });
  };

  const handleConfiguredOption = (modifierName: string, option: ModifierOption) => {
    // Determine type based on modifier name
    let type: 'add' | 'remove' | 'substitute' = 'add';
    const lowerName = modifierName.toLowerCase();
    if (lowerName.includes('sin') || lowerName.includes('quitar')) {
      type = 'remove';
    } else if (lowerName.includes('cambiar') || lowerName.includes('sustituir')) {
      type = 'substitute';
    }

    addModifier({
      modifier_name: modifierName,
      option_name: option.name,
      price_delta: option.price_delta,
      type,
    });
  };

  const handleAddCustom = () => {
    if (!customModifier.trim()) return;
    
    // Try to detect type from text
    const text = customModifier.trim();
    const lower = text.toLowerCase();
    let type: 'add' | 'remove' | 'substitute' = 'add';
    
    if (lower.startsWith('sin ') || lower.includes('quitar') || lower.includes('no ')) {
      type = 'remove';
    } else if (lower.startsWith('extra ') || lower.includes('añadir') || lower.includes('doble')) {
      type = 'add';
    } else if (lower.includes('cambiar') || lower.includes('en vez')) {
      type = 'substitute';
    }

    addModifier({
      modifier_name: type === 'remove' ? 'Sin' : type === 'add' ? 'Extra' : 'Cambiar',
      option_name: text,
      price_delta: 0,
      type,
    });
    setCustomModifier('');
  };

  const handleConfirm = () => {
    onConfirm(selectedModifiers, notes, isRush);
    onClose();
  };

  const getTypeColor = (type: 'add' | 'remove' | 'substitute') => {
    switch (type) {
      case 'remove': return 'bg-red-500/20 text-red-400 border-red-500';
      case 'add': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500';
      case 'substitute': return 'bg-amber-500/20 text-amber-400 border-amber-500';
    }
  };

  const getTypeIcon = (type: 'add' | 'remove' | 'substitute') => {
    switch (type) {
      case 'remove': return <Minus className="h-3 w-3" />;
      case 'add': return <Plus className="h-3 w-3" />;
      case 'substitute': return <RefreshCw className="h-3 w-3" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Modificadores: {product.name}
          </DialogTitle>
        </DialogHeader>

        {/* Selected Modifiers */}
        {selectedModifiers.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
            {selectedModifiers.map((mod, idx) => (
              <Badge
                key={idx}
                variant="outline"
                className={cn("flex items-center gap-1 px-2 py-1", getTypeColor(mod.type))}
              >
                {getTypeIcon(mod.type)}
                <span>{mod.option_name}</span>
                {mod.price_delta !== 0 && (
                  <span className="text-xs opacity-75">
                    {mod.price_delta > 0 ? '+' : ''}{mod.price_delta.toFixed(2)}€
                  </span>
                )}
                <button
                  onClick={() => removeModifier(idx)}
                  className="ml-1 hover:bg-white/20 rounded p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="quick">Rápidos</TabsTrigger>
            <TabsTrigger value="configured" disabled={productModifiers.length === 0}>
              Del producto {productModifiers.length > 0 && `(${productModifiers.length})`}
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[280px] mt-3">
            <TabsContent value="quick" className="mt-0 space-y-4">
              {/* Remove section */}
              <div>
                <h4 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-1">
                  <Minus className="h-4 w-4" /> SIN (Quitar)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {QUICK_MODIFIERS.remove.map((mod) => (
                    <Button
                      key={mod}
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs border-red-500/30 hover:bg-red-500/20 hover:text-red-400"
                      onClick={() => handleQuickModifier(mod, 'remove')}
                    >
                      {mod}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Add section */}
              <div>
                <h4 className="text-sm font-medium text-emerald-400 mb-2 flex items-center gap-1">
                  <Plus className="h-4 w-4" /> EXTRA (Añadir)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {QUICK_MODIFIERS.add.map((mod) => (
                    <Button
                      key={mod}
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs border-emerald-500/30 hover:bg-emerald-500/20 hover:text-emerald-400"
                      onClick={() => handleQuickModifier(mod, 'add')}
                    >
                      {mod}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Substitute section */}
              <div>
                <h4 className="text-sm font-medium text-amber-400 mb-2 flex items-center gap-1">
                  <RefreshCw className="h-4 w-4" /> CAMBIAR (Sustituir)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {QUICK_MODIFIERS.substitute.map((mod) => (
                    <Button
                      key={mod}
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs border-amber-500/30 hover:bg-amber-500/20 hover:text-amber-400"
                      onClick={() => handleQuickModifier(mod, 'substitute')}
                    >
                      {mod}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Custom modifier */}
              <div>
                <Label className="text-sm">Modificador personalizado</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={customModifier}
                    onChange={(e) => setCustomModifier(e.target.value)}
                    placeholder="Ej: Sin cebolla, Extra picante..."
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
                  />
                  <Button size="sm" onClick={handleAddCustom} disabled={!customModifier.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="configured" className="mt-0 space-y-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : productModifiers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Este producto no tiene modificadores configurados
                </p>
              ) : (
                productModifiers.map((modifier) => (
                  <div key={modifier.id}>
                    <h4 className="text-sm font-medium mb-2">{modifier.name}</h4>
                    <div className="flex flex-wrap gap-2">
                      {modifier.options.map((option) => (
                        <Button
                          key={option.id}
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => handleConfiguredOption(modifier.name, option)}
                        >
                          {option.name}
                          {option.price_delta !== 0 && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              {option.price_delta > 0 ? '+' : ''}{option.price_delta.toFixed(2)}€
                            </span>
                          )}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* Notes & Rush */}
        <div className="space-y-3 pt-3 border-t">
          <div>
            <Label htmlFor="notes">Notas adicionales</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instrucciones especiales para cocina..."
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="rush"
              checked={isRush}
              onCheckedChange={(checked) => setIsRush(checked === true)}
            />
            <Label htmlFor="rush" className="flex items-center gap-2 cursor-pointer">
              <Flame className="h-4 w-4 text-amber-500" />
              <span>Marcar como RUSH (prioridad)</span>
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
