import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { useWasteEntry, WASTE_REASONS, type WasteReasonCode } from '@/hooks/useWasteEntry';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/contexts/AppContext';
import { Search, Check, ArrowLeft, ArrowRight, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Step-based flow: 1=Select Item, 2=Select Reason, 3=Set Quantity, 4=Confirm

function useLocations() {
    const { group } = useApp();
    return useQuery({
        queryKey: ['locations-list'],
        queryFn: async () => {
            if (!group?.id) return [];
            const { data } = await supabase
                .from('locations')
                .select('id, name')
                .eq('org_id', group.id)
                .order('name');
            return data ?? [];
        },
        enabled: !!group?.id,
    });
}

function useInventoryItemsForWaste() {
    const { group } = useApp();
    return useQuery({
        queryKey: ['items-for-waste'],
        queryFn: async () => {
            if (!group?.id) return [];
            const { data } = await supabase
                .from('inventory_items')
                .select('id, name, base_unit, unit, last_cost, current_stock, category_id')
                .eq('org_id', group.id)
                .eq('is_active', true)
                .order('name');
            return data ?? [];
        },
        enabled: !!group?.id,
    });
}

export default function WasteEntryPage() {
    const { toast } = useToast();
    const { logWaste } = useWasteEntry();
    const { data: locations } = useLocations();
    const { data: items } = useInventoryItemsForWaste();

    const [step, setStep] = useState(1);
    const [locationId, setLocationId] = useState('');
    const [search, setSearch] = useState('');
    const [selectedItemId, setSelectedItemId] = useState('');
    const [selectedReason, setSelectedReason] = useState<WasteReasonCode | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [numpadValue, setNumpadValue] = useState('1');
    const [notes, setNotes] = useState('');

    const selectedItem = useMemo(
        () => items?.find(i => i.id === selectedItemId),
        [items, selectedItemId]
    );

    const filteredItems = useMemo(() => {
        if (!items) return [];
        if (!search) return items;
        const q = search.toLowerCase();
        return items.filter(i => i.name.toLowerCase().includes(q));
    }, [items, search]);

    const unitCost = selectedItem?.last_cost ?? 0;
    const totalCost = quantity * unitCost;

    const handleSelectItem = (id: string) => {
        setSelectedItemId(id);
        setStep(2);
    };

    const handleSelectReason = (reason: WasteReasonCode) => {
        setSelectedReason(reason);
        setStep(3);
    };

    const handleNumpad = (key: string) => {
        if (key === 'C') {
            setNumpadValue('0');
            setQuantity(0);
        } else if (key === '⌫') {
            const nv = numpadValue.slice(0, -1) || '0';
            setNumpadValue(nv);
            setQuantity(parseFloat(nv) || 0);
        } else if (key === '.') {
            if (!numpadValue.includes('.')) {
                setNumpadValue(numpadValue + '.');
            }
        } else {
            const nv = numpadValue === '0' ? key : numpadValue + key;
            setNumpadValue(nv);
            setQuantity(parseFloat(nv) || 0);
        }
    };

    const handleConfirm = async () => {
        if (!selectedItemId || !selectedReason || !locationId) return;
        try {
            await logWaste.mutateAsync({
                item_id: selectedItemId,
                location_id: locationId,
                reason: selectedReason,
                quantity,
                unit_cost: unitCost,
                notes: notes || undefined,
            });
            toast({ title: '✅ Merma registrada', description: `${selectedItem?.name} — ${quantity} ${selectedItem?.base_unit ?? 'ud'}` });
            // Reset
            setStep(1);
            setSelectedItemId('');
            setSelectedReason(null);
            setQuantity(1);
            setNumpadValue('1');
            setNotes('');
            setSearch('');
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        }
    };

    // Auto-select first location if only one
    if (locations?.length === 1 && !locationId) {
        setLocationId(locations[0].id);
    }

    return (
        <div className="max-w-2xl mx-auto space-y-4 animate-fade-in pb-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-display font-bold flex items-center gap-2">
                        <Trash2 className="h-6 w-6 text-red-500" />
                        Registrar Merma
                    </h1>
                    <p className="text-muted-foreground">Registro optimizado de merma</p>
                </div>
                {(locations?.length ?? 0) > 1 && (
                    <Select value={locationId} onValueChange={setLocationId}>
                        <SelectTrigger className="w-48">
                            <SelectValue placeholder="Ubicación" />
                        </SelectTrigger>
                        <SelectContent>
                            {(locations ?? []).map(l => (
                                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            {/* Progress Steps */}
            <div className="flex items-center gap-2">
                {['Producto', 'Motivo', 'Cantidad', 'Confirmar'].map((label, i) => (
                    <div key={label} className="flex items-center gap-2 flex-1">
                        <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                            step > i + 1 ? "bg-emerald-500 text-white" :
                                step === i + 1 ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2" :
                                    "bg-muted text-muted-foreground"
                        )}>
                            {step > i + 1 ? <Check className="h-4 w-4" /> : i + 1}
                        </div>
                        <span className={cn("text-xs hidden sm:inline", step === i + 1 ? "font-medium" : "text-muted-foreground")}>{label}</span>
                        {i < 3 && <div className="flex-1 h-0.5 bg-muted" />}
                    </div>
                ))}
            </div>

            {/* Step 1: Select Item */}
            {step === 1 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Selecciona el producto</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar producto..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-9 h-12 text-lg"
                                autoFocus
                            />
                        </div>
                        <div className="grid grid-cols-1 gap-2 max-h-[50vh] overflow-y-auto">
                            {filteredItems.map(item => (
                                <Button
                                    key={item.id}
                                    variant="outline"
                                    className="h-14 justify-between text-left px-4 hover:bg-accent"
                                    onClick={() => handleSelectItem(item.id)}
                                >
                                    <div>
                                        <span className="font-medium">{item.name}</span>
                                        <span className="text-muted-foreground ml-2 text-sm">({item.base_unit})</span>
                                    </div>
                                    <div className="text-right text-sm">
                                        <div className="font-mono">€{(item.last_cost ?? 0).toFixed(2)}</div>
                                        <div className="text-muted-foreground text-xs">Stock: {item.current_stock ?? 0}</div>
                                    </div>
                                </Button>
                            ))}
                            {filteredItems.length === 0 && (
                                <p className="text-center py-8 text-muted-foreground">No hay resultados</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 2: Select Reason */}
            {step === 2 && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" onClick={() => setStep(1)}>
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <div>
                                <CardTitle className="text-lg">Motivo de pérdida</CardTitle>
                                <p className="text-sm text-muted-foreground">{selectedItem?.name}</p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-3">
                            {WASTE_REASONS.map(reason => (
                                <Button
                                    key={reason.code}
                                    variant="outline"
                                    className={cn(
                                        "h-20 flex-col gap-1 text-base transition-all",
                                        selectedReason === reason.code && "ring-2 ring-primary border-primary"
                                    )}
                                    onClick={() => handleSelectReason(reason.code)}
                                >
                                    <span className="text-2xl">{reason.icon}</span>
                                    <span className="font-medium">{reason.label}</span>
                                </Button>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 3: Quantity */}
            {step === 3 && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" onClick={() => setStep(2)}>
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <div>
                                <CardTitle className="text-lg">Cantidad perdida</CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    {selectedItem?.name} — {WASTE_REASONS.find(r => r.code === selectedReason)?.label}
                                </p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Display */}
                        <div className="text-center py-4 bg-muted/50 rounded-xl">
                            <div className="text-5xl font-bold font-mono">{numpadValue}</div>
                            <div className="text-muted-foreground mt-1">{selectedItem?.base_unit ?? 'unidades'}</div>
                            <div className="text-lg font-medium text-red-500 mt-2">−€{totalCost.toFixed(2)}</div>
                        </div>

                        {/* Slider */}
                        <div className="px-2">
                            <Slider
                                value={[quantity]}
                                onValueChange={([v]) => { setQuantity(v); setNumpadValue(v.toString()); }}
                                max={Math.max(selectedItem?.current_stock ?? 50, 50)}
                                step={0.1}
                                className="py-4"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>0</span>
                                <span>{Math.max(selectedItem?.current_stock ?? 50, 50)}</span>
                            </div>
                        </div>

                        {/* Numpad */}
                        <div className="grid grid-cols-3 gap-2">
                            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map(key => (
                                <Button
                                    key={key}
                                    variant="outline"
                                    className="h-14 text-xl font-mono"
                                    onClick={() => handleNumpad(key)}
                                >
                                    {key}
                                </Button>
                            ))}
                        </div>

                        {/* Notes */}
                        <Input
                            placeholder="Notas (opcional)..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                        />

                        <Button
                            className="w-full h-14 text-lg"
                            onClick={() => setStep(4)}
                            disabled={quantity <= 0}
                        >
                            Continuar <ArrowRight className="h-5 w-5 ml-2" />
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Step 4: Confirm */}
            {step === 4 && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" onClick={() => setStep(3)}>
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <CardTitle className="text-lg">Confirmar registro</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="bg-muted/50 rounded-xl p-6 space-y-3">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Producto</span>
                                <span className="font-medium">{selectedItem?.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Motivo</span>
                                <Badge variant="outline">
                                    {WASTE_REASONS.find(r => r.code === selectedReason)?.icon}{' '}
                                    {WASTE_REASONS.find(r => r.code === selectedReason)?.label}
                                </Badge>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Cantidad</span>
                                <span className="font-mono font-bold">{quantity} {selectedItem?.base_unit ?? 'ud'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Coste unitario</span>
                                <span className="font-mono">€{unitCost.toFixed(2)}</span>
                            </div>
                            <div className="border-t pt-3 flex justify-between">
                                <span className="font-medium">Pérdida total</span>
                                <span className="text-xl font-bold text-red-500 font-mono">−€{totalCost.toFixed(2)}</span>
                            </div>
                            {notes && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Notas</span>
                                    <span className="text-sm">{notes}</span>
                                </div>
                            )}
                        </div>

                        <Button
                            className="w-full h-14 text-lg bg-red-600 hover:bg-red-700"
                            onClick={handleConfirm}
                            disabled={logWaste.isPending || !locationId}
                        >
                            {logWaste.isPending ? 'Registrando...' : '🗑️ Confirmar Merma'}
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
