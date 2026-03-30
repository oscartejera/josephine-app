import { useState, useEffect } from 'react';
import { Check, Clock, Search, Zap, Plus, Minus, ChevronRight, Mic, MicOff, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWasteQuickLog } from '@/hooks/useWasteQuickLog';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useWasteVoiceParser } from '@/hooks/useWasteVoiceParser';
import { WASTE_REASONS } from '@/hooks/useWasteEntry';
import type { WasteReasonCode } from '@/hooks/useWasteEntry';

interface WasteQuickLogProps {
  defaultLocationId?: string;
  onSuccess?: () => void;
}

export function WasteQuickLog({ defaultLocationId, onSuccess }: WasteQuickLogProps) {
  const {
    frequentItems,
    allItems,
    suggestedReason,
    suggestedReasonLabel,
    isLoadingItems,
    submitQuickLog,
    isSubmitting,
    lastLoggedItem,
  } = useWasteQuickLog(defaultLocationId);

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState<WasteReasonCode>(suggestedReason);
  const [step, setStep] = useState<'select' | 'confirm'>('select');

  // Voice input
  const voice = useVoiceInput('es-ES');
  const { parse } = useWasteVoiceParser(allItems);
  const [voiceDebug, setVoiceDebug] = useState<string | null>(null);

  // Process voice result when transcript is ready
  useEffect(() => {
    if (voice.status === 'done' && voice.transcript) {
      const result = parse(voice.transcript);
      setVoiceDebug(result.debugInfo);

      if (result.matchedItem) {
        setSelectedItemId(result.matchedItem.id);
        setQuantity(result.quantity || 1);
        setReason(result.reason || suggestedReason);
        setStep('confirm');
      } else if (result.quantity) {
        // Got quantity but no product — show in search
        setSearch(voice.transcript);
      }

      // Auto-clear debug after 5s
      setTimeout(() => setVoiceDebug(null), 5000);
    }
  }, [voice.status, voice.transcript]);

  // Filter items by search
  const filteredItems = search.trim()
    ? allItems.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : allItems;

  const selectedItem = allItems.find(i => i.id === selectedItemId);

  const handleSelectItem = (itemId: string) => {
    setSelectedItemId(itemId);
    setQuantity(1);
    setReason(suggestedReason);
    setStep('confirm');
  };

  const handleSubmit = async () => {
    if (!selectedItemId) return;
    await submitQuickLog(selectedItemId, quantity, reason);
    setStep('select');
    setSelectedItemId(null);
    setQuantity(1);
    setSearch('');
    onSuccess?.();
  };

  const handleClose = () => {
    setOpen(false);
    setStep('select');
    setSelectedItemId(null);
    setSearch('');
    setQuantity(1);
  };

  const wasteValue = selectedItem ? (selectedItem.lastCost * quantity) : 0;

  return (
    <Sheet open={open} onOpenChange={(v) => v ? setOpen(true) : handleClose()}>
      <SheetTrigger asChild>
        <Button className="gap-2" size="sm">
          <Zap className="h-4 w-4" />
          Quick Log
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl p-0 overflow-hidden">
        {/* Success toast overlay */}
        {lastLoggedItem && (
          <div className="absolute top-4 left-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
            <div className="bg-emerald-500 text-white px-4 py-3 rounded-xl flex items-center gap-2 shadow-lg">
              <Check className="h-5 w-5" />
              <span className="text-sm font-medium">Registrado: {lastLoggedItem}</span>
            </div>
          </div>
        )}

        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Registro Rápido de Merma
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <Clock className="h-3 w-3" />
            Motivo sugerido: <Badge variant="outline" className="text-xs">{suggestedReasonLabel}</Badge>
          </SheetDescription>
        </SheetHeader>

        {step === 'select' ? (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Search + Voice */}
            <div className="px-4 py-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar producto..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9 h-11 rounded-xl bg-muted/50"
                    autoFocus
                  />
                </div>
                {/* Voice button — always visible */}
                <Button
                  variant={voice.status === 'listening' ? 'default' : 'outline'}
                  disabled={!voice.isSupported}
                  className={`h-11 rounded-xl flex-shrink-0 transition-all gap-1.5 px-3 ${
                    voice.status === 'listening'
                      ? 'bg-red-500 hover:bg-red-600 animate-pulse text-white border-red-500'
                      : voice.isSupported
                        ? 'border-primary/30 text-primary hover:bg-primary/5 hover:border-primary'
                        : 'opacity-50'
                  }`}
                  onClick={() => {
                    if (!voice.isSupported) return;
                    if (voice.status === 'listening') {
                      voice.stopListening();
                    } else {
                      voice.reset();
                      voice.startListening();
                    }
                  }}
                  title={!voice.isSupported ? 'Tu navegador no soporta voz' : 'Registrar merma por voz'}
                >
                  {voice.status === 'listening' ? (
                    <MicOff className="h-4 w-4" />
                  ) : voice.status === 'processing' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                  <span className="text-xs font-medium hidden sm:inline">
                    {voice.status === 'listening' ? 'Parar' : voice.status === 'processing' ? 'Procesando...' : 'Voz'}
                  </span>
                </Button>
              </div>

              {/* Voice status feedback */}
              {voice.status === 'listening' && (
                <div className="mt-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-sm text-red-600 font-medium">🎙️ Escuchando… di algo como "dos kilos de pollo por caducidad"</span>
                  {voice.interimTranscript && (
                    <span className="text-xs text-muted-foreground italic truncate ml-auto">
                      "{voice.interimTranscript}"
                    </span>
                  )}
                </div>
              )}
              {voice.error && (
                <div className="mt-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <span className="text-xs text-amber-700">{voice.error}</span>
                </div>
              )}
              {voiceDebug && voice.status === 'done' && (
                <div className="mt-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                  <span className="text-xs text-emerald-700">✅ {voiceDebug}</span>
                  {voice.transcript && (
                    <p className="text-[10px] text-muted-foreground mt-1">Transcripción: "{voice.transcript}"</p>
                  )}
                </div>
              )}
            </div>

            {/* Frequent items */}
            {!search && frequentItems.length > 0 && (
              <div className="px-4 pb-2">
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Zap className="h-3 w-3 text-amber-500" /> Frecuentes
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {frequentItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleSelectItem(item.id)}
                      className="flex items-center justify-between p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 hover:bg-amber-500/10 transition-colors text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground">{item.category} · €{item.lastCost}/{item.unit}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </button>
                  ))}
                </div>
                <Separator className="mt-3" />
              </div>
            )}

            {/* All items */}
            <div className="flex-1 overflow-y-auto px-4 pb-20">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                {search ? `Resultados (${filteredItems.length})` : `Todos los productos (${allItems.length})`}
              </p>
              <div className="space-y-1">
                {isLoadingItems ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Cargando productos...</p>
                ) : filteredItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No se encontraron productos</p>
                ) : (
                  filteredItems.slice(0, 50).map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleSelectItem(item.id)}
                      className="flex items-center justify-between w-full p-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {item.category} · €{item.lastCost}/{item.unit}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Confirm step */
          <div className="px-4 py-4 space-y-5">
            {/* Selected item */}
            <div className="p-4 rounded-xl bg-muted/50">
              <p className="text-base font-bold">{selectedItem?.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedItem?.category} · €{selectedItem?.lastCost}/{selectedItem?.unit}
              </p>
            </div>

            {/* Quantity — big touch buttons */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Cantidad ({selectedItem?.unit})</p>
              <div className="flex items-center gap-3 justify-center">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-14 w-14 rounded-2xl text-lg"
                  onClick={() => setQuantity(Math.max(0.5, quantity - 1))}
                >
                  <Minus className="h-5 w-5" />
                </Button>
                <Input
                  type="number"
                  value={quantity}
                  onChange={e => setQuantity(Math.max(0.1, parseFloat(e.target.value) || 0))}
                  className="text-center text-2xl font-bold h-14 w-24 rounded-2xl"
                  step="0.5"
                  min="0.1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-14 w-14 rounded-2xl text-lg"
                  onClick={() => setQuantity(quantity + 1)}
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </div>
              {/* Quick quantity buttons */}
              <div className="flex justify-center gap-2 mt-3">
                {[0.5, 1, 2, 5, 10].map(q => (
                  <button
                    key={q}
                    onClick={() => setQuantity(q)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      quantity === q
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Reason */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Motivo</p>
              <Select value={reason} onValueChange={(v) => setReason(v as WasteReasonCode)}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WASTE_REASONS.map(r => (
                    <SelectItem key={r.code} value={r.code}>
                      {r.icon} {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Value preview */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-red-500/5 border border-red-500/15">
              <span className="text-sm text-muted-foreground">Coste estimado</span>
              <span className="text-lg font-bold text-red-600">€{wasteValue.toFixed(2)}</span>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-xl"
                onClick={() => { setStep('select'); setSelectedItemId(null); }}
              >
                ← Cambiar
              </Button>
              <Button
                className="flex-1 h-12 rounded-xl text-base font-semibold"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Guardando...' : '✓ Registrar'}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
