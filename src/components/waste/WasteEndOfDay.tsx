import { useState, useMemo } from 'react';
import { Check, Moon, Search, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { toast } from 'sonner';
import { useWasteEndOfDay } from '@/hooks/useWasteEndOfDay';
import type { EODBatchEntry } from '@/hooks/useWasteEndOfDay';

interface WasteEndOfDayProps {
  defaultLocationId?: string;
  onSuccess?: () => void;
}

export function WasteEndOfDay({ defaultLocationId, onSuccess }: WasteEndOfDayProps) {
  const { items, isLoading, submitBatch, isSubmitting, lastBatchCount } = useWasteEndOfDay(defaultLocationId);
  
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Initialize quantities from suggestions when items load
  const initializeQtys = () => {
    const initial: Record<string, number> = {};
    items.forEach(item => {
      if (item.suggestedQty > 0) {
        initial[item.id] = item.suggestedQty;
      }
    });
    setQuantities(initial);
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) initializeQtys();
    else { setSearch(''); setQuantities({}); }
  };

  const setQty = (itemId: string, qty: number) => {
    setQuantities(prev => ({ ...prev, [itemId]: Math.max(0, qty) }));
  };

  // Filter
  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    return items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
  }, [items, search]);

  // Split into "with history" and "rest"
  const historicalItems = filteredItems.filter(i => i.historicalCount > 0);
  const otherItems = filteredItems.filter(i => i.historicalCount === 0);

  // Count entries to submit
  const entriesToSubmit = Object.entries(quantities)
    .filter(([, qty]) => qty > 0)
    .map(([itemId, quantity]) => ({ itemId, quantity } as EODBatchEntry));

  const totalValue = entriesToSubmit.reduce((sum, e) => {
    const item = items.find(i => i.id === e.itemId);
    return sum + (item ? item.lastCost * e.quantity : 0);
  }, 0);

  const handleSubmit = async () => {
    if (entriesToSubmit.length === 0) return;
    const count = await submitBatch(entriesToSubmit);
    if (count > 0) {
      toast.success(`Cierre registrado: ${count} producto${count > 1 ? 's' : ''}`, {
        description: `Merma total: €${totalValue.toFixed(2)}`,
      });
      setQuantities({});
      setOpen(false);
      onSuccess?.();
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Moon className="h-4 w-4" />
          Cierre de Merma
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl p-0 overflow-hidden flex flex-col">
        {/* Success overlay */}
        {lastBatchCount !== null && (
          <div className="absolute top-4 left-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
            <div className="bg-emerald-500 text-white px-4 py-3 rounded-xl flex items-center gap-2 shadow-lg">
              <Check className="h-5 w-5" />
              <span className="text-sm font-medium">{lastBatchCount} productos registrados</span>
            </div>
          </div>
        )}

        <SheetHeader className="px-4 pt-4 pb-2 flex-shrink-0">
          <SheetTitle className="text-lg flex items-center gap-2">
            <Moon className="h-5 w-5 text-indigo-500" />
            Cierre de Merma — Fin de Día
          </SheetTitle>
          <SheetDescription>
            Registra todo lo que sobró hoy. Los productos habituales aparecen primero con cantidades sugeridas.
          </SheetDescription>
        </SheetHeader>

        {/* Search */}
        <div className="px-4 py-2 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar producto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-10 rounded-xl bg-muted/50"
            />
          </div>
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Cargando productos...</p>
          ) : (
            <>
              {/* Items with EOD history */}
              {historicalItems.length > 0 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Moon className="h-3 w-3 text-indigo-400" />
                    Habituales en cierre ({historicalItems.length})
                  </p>
                  <div className="space-y-1 mb-3">
                    {historicalItems.map(item => (
                      <EODItemRow
                        key={item.id}
                        item={item}
                        quantity={quantities[item.id] || 0}
                        onChange={qty => setQty(item.id, qty)}
                        showBadge
                      />
                    ))}
                  </div>
                  <Separator className="my-3" />
                </>
              )}

              {/* All other items */}
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Otros productos ({otherItems.length})
              </p>
              <div className="space-y-1">
                {otherItems.slice(0, 40).map(item => (
                  <EODItemRow
                    key={item.id}
                    item={item}
                    quantity={quantities[item.id] || 0}
                    onChange={qty => setQty(item.id, qty)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Bottom action bar */}
        <div className="flex-shrink-0 border-t bg-background px-4 py-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {entriesToSubmit.length} producto{entriesToSubmit.length !== 1 ? 's' : ''} con merma
            </span>
            <span className="font-bold text-red-600">Total: €{totalValue.toFixed(2)}</span>
          </div>
          <Button
            className="w-full h-12 rounded-xl text-base font-semibold gap-2"
            onClick={handleSubmit}
            disabled={isSubmitting || entriesToSubmit.length === 0}
          >
            <Save className="h-5 w-5" />
            {isSubmitting
              ? 'Guardando...'
              : entriesToSubmit.length === 0
                ? 'Añade cantidades para guardar'
                : `Guardar cierre (${entriesToSubmit.length} ítems)`
            }
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Item Row ──

function EODItemRow({ item, quantity, onChange, showBadge }: {
  item: { id: string; name: string; unit: string; lastCost: number; category: string; avgWasteQty: number; historicalCount: number };
  quantity: number;
  onChange: (qty: number) => void;
  showBadge?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-xl transition-colors ${
      quantity > 0 ? 'bg-red-500/5 border border-red-500/15' : 'hover:bg-muted/30'
    }`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">{item.name}</span>
          {showBadge && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-indigo-500/10 text-indigo-600 border-indigo-500/20">
              ×{item.historicalCount}
            </Badge>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground">
          {item.category} · €{item.lastCost}/{item.unit}
          {item.avgWasteQty > 0 && ` · Media: ${item.avgWasteQty.toFixed(1)} ${item.unit}`}
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={() => onChange(Math.max(0, quantity - 1))}
          className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-sm font-bold hover:bg-muted/80"
        >
          −
        </button>
        <Input
          type="number"
          value={quantity || ''}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          placeholder="0"
          className="w-16 h-8 text-center text-sm rounded-lg px-1"
          step="0.5"
          min="0"
        />
        <button
          onClick={() => onChange(quantity + 1)}
          className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-sm font-bold hover:bg-muted/80"
        >
          +
        </button>
      </div>
      {quantity > 0 && (
        <span className="text-xs font-medium text-red-600 w-14 text-right flex-shrink-0">
          €{(item.lastCost * quantity).toFixed(0)}
        </span>
      )}
    </div>
  );
}
