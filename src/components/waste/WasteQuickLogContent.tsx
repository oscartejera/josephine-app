/**
 * WasteQuickLogContent v2 — "El Registro Perfecto"
 *
 * Sprint 1 upgrades:
 * - Prominent cost feedback (€ in red) on confirm screen
 * - Animated success with confetti, cost, daily counter & streak
 * - Unit-adaptive quantity chips (kg/L/ud)
 * - Improved favorites section
 */

import { useState, useEffect, useMemo } from 'react';
import { Check, Clock, Search, Zap, Plus, Minus, ChevronRight, Mic, MicOff, Loader2, ArrowLeft, Flame, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
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

interface WasteQuickLogContentProps {
  defaultLocationId?: string;
  onSuccess?: () => void;
  onBack?: () => void;
}

// ── Daily stats helper (localStorage) ──
const DAILY_STATS_KEY = 'josephine_waste_daily';
const STREAK_KEY = 'josephine_waste_streak';

interface DailyStats {
  date: string;
  count: number;
  totalCost: number;
}

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getDailyStats(): DailyStats {
  try {
    const stored = localStorage.getItem(DAILY_STATS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as DailyStats;
      if (parsed.date === getTodayStr()) return parsed;
    }
  } catch { /* ignore */ }
  return { date: getTodayStr(), count: 0, totalCost: 0 };
}

function bumpDailyStats(cost: number): DailyStats {
  const stats = getDailyStats();
  stats.count += 1;
  stats.totalCost += cost;
  localStorage.setItem(DAILY_STATS_KEY, JSON.stringify(stats));
  return stats;
}

function getStreak(): number {
  try {
    const stored = localStorage.getItem(STREAK_KEY);
    if (stored) {
      const { lastDate, streak } = JSON.parse(stored);
      const today = getTodayStr();
      if (lastDate === today) return streak;
      // Check if yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (lastDate === yesterday.toISOString().slice(0, 10)) return streak;
    }
  } catch { /* ignore */ }
  return 0;
}

function bumpStreak(): number {
  const today = getTodayStr();
  try {
    const stored = localStorage.getItem(STREAK_KEY);
    if (stored) {
      const { lastDate, streak } = JSON.parse(stored);
      if (lastDate === today) return streak; // Already bumped today
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const newStreak = lastDate === yesterday.toISOString().slice(0, 10) ? streak + 1 : 1;
      localStorage.setItem(STREAK_KEY, JSON.stringify({ lastDate: today, streak: newStreak }));
      return newStreak;
    }
  } catch { /* ignore */ }
  localStorage.setItem(STREAK_KEY, JSON.stringify({ lastDate: today, streak: 1 }));
  return 1;
}

// ── Global counters for WastePersonalStats ──
const TOTAL_LOGS_KEY = 'josephine_waste_total_logs';
const TOTAL_VALUE_KEY = 'josephine_waste_total_value';
const WEEK_LOGS_KEY = 'josephine_waste_week_logs';

function getWeekStr() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().slice(0, 10);
}

function bumpGlobalCounters(cost: number) {
  // Total logs
  const totalLogs = parseInt(localStorage.getItem(TOTAL_LOGS_KEY) || '0', 10) + 1;
  localStorage.setItem(TOTAL_LOGS_KEY, String(totalLogs));

  // Total value
  const totalValue = parseFloat(localStorage.getItem(TOTAL_VALUE_KEY) || '0') + cost;
  localStorage.setItem(TOTAL_VALUE_KEY, String(totalValue));

  // Week logs
  const weekStr = getWeekStr();
  let weekData = { week: weekStr, count: 0 };
  try {
    const stored = localStorage.getItem(WEEK_LOGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.week === weekStr) weekData = parsed;
    }
  } catch { /* ignore */ }
  weekData.count += 1;
  weekData.week = weekStr;
  localStorage.setItem(WEEK_LOGS_KEY, JSON.stringify(weekData));
}

// ── Unit-adaptive quantity chips ──
function getQuantityChips(unit: string): number[] {
  const u = (unit || 'ud').toLowerCase();
  if (u === 'l' || u === 'lt' || u === 'litro' || u === 'litros') return [0.5, 1, 2, 5, 10];
  if (u === 'kg' || u === 'kilo' || u === 'kilos') return [0.25, 0.5, 1, 2, 5];
  if (u === 'g' || u === 'gramos') return [100, 250, 500, 1000, 2000];
  if (u === 'ml' || u === 'mililitros') return [50, 100, 250, 500, 1000];
  return [1, 2, 5, 10, 20]; // ud, unidades
}

export function WasteQuickLogContent({ defaultLocationId, onSuccess, onBack }: WasteQuickLogContentProps) {
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

  const [search, setSearch] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState<WasteReasonCode>(suggestedReason);
  const [step, setStep] = useState<'select' | 'confirm'>('select');

  // Success animation state
  const [successInfo, setSuccessInfo] = useState<{
    name: string;
    cost: number;
    dailyCount: number;
    dailyCost: number;
    streak: number;
  } | null>(null);

  // Voice input
  const voice = useVoiceInput('es-ES');
  const { parse } = useWasteVoiceParser(allItems);
  const [voiceDebug, setVoiceDebug] = useState<string | null>(null);

  // Process voice result
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
        setSearch(voice.transcript);
      }

      setTimeout(() => setVoiceDebug(null), 5000);
    }
  }, [voice.status, voice.transcript]);

  const selectedItem = selectedItemId ? allItems.find(i => i.id === selectedItemId) : null;

  const filteredItems = useMemo(() => {
    if (!search.trim()) return allItems;
    const q = search.toLowerCase();
    return allItems.filter(i => i.name.toLowerCase().includes(q));
  }, [allItems, search]);

  const handleSelectItem = (itemId: string) => {
    setSelectedItemId(itemId);
    setQuantity(1);
    setReason(suggestedReason);
    setStep('confirm');
  };

  const handleSubmit = async () => {
    if (!selectedItemId || !selectedItem) return;
    const cost = selectedItem.lastCost * quantity;
    await submitQuickLog(selectedItemId, quantity, reason);

    // Bump stats
    const dailyStats = bumpDailyStats(cost);
    const streak = bumpStreak();
    bumpGlobalCounters(cost);

    // Show success animation
    setSuccessInfo({
      name: `${selectedItem.name} (${selectedItem.unit})`,
      cost,
      dailyCount: dailyStats.count,
      dailyCost: dailyStats.totalCost,
      streak,
    });

    setStep('select');
    setSelectedItemId(null);
    setQuantity(1);
    setSearch('');
    onSuccess?.();

    // Clear success after 4s
    setTimeout(() => setSuccessInfo(null), 4000);
  };

  const wasteValue = selectedItem ? (selectedItem.lastCost * quantity) : 0;
  const chips = selectedItem ? getQuantityChips(selectedItem.unit) : [0.5, 1, 2, 5, 10];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="flex-shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex-1">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Registro Rápido de Merma
            </h3>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Motivo sugerido: <Badge variant="outline" className="text-xs">{suggestedReasonLabel}</Badge>
            </p>
          </div>
          {/* Daily counter badge */}
          {getDailyStats().count > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <TrendingDown className="h-3 w-3" />
              {getDailyStats().count} hoy
              {getStreak() >= 2 && (
                <span className="flex items-center gap-0.5 text-orange-500">
                  <Flame className="h-3 w-3" />
                  {getStreak()}d
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Success animation — enhanced with cost, counter, streak */}
      {(successInfo || lastLoggedItem) && (
        <div className="px-4 animate-in slide-in-from-top-2 duration-300">
          {successInfo ? (
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg shadow-emerald-500/25 space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center">
                  <Check className="h-4 w-4" />
                </div>
                <span className="text-sm font-semibold">✓ Registrado: {successInfo.name}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-white/90">
                <span className="flex items-center gap-3">
                  <span>💰 −€{successInfo.cost.toFixed(2)}</span>
                  <span>📊 {successInfo.dailyCount} registros hoy</span>
                  {successInfo.streak >= 2 && (
                    <span>🔥 Racha: {successInfo.streak} días</span>
                  )}
                </span>
              </div>
            </div>
          ) : lastLoggedItem ? (
            <div className="bg-emerald-500 text-white px-4 py-3 rounded-xl flex items-center gap-2 shadow-lg">
              <Check className="h-5 w-5" />
              <span className="text-sm font-medium">Registrado: {lastLoggedItem}</span>
            </div>
          ) : null}
        </div>
      )}

      {step === 'select' ? (
        <>
          {/* Search + Voice */}
          <div className="px-4 py-2 flex-shrink-0">
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
              {/* Voice button */}
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

            {/* Voice status */}
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

          {/* ⚡ Frequent items — improved layout */}
          {!search && frequentItems.length > 0 && (
            <div className="px-4 py-2 flex-shrink-0">
              <p className="text-xs font-medium text-muted-foreground mb-2">⚡ Tus frecuentes</p>
              <div className="grid grid-cols-2 gap-2">
                {frequentItems.slice(0, 6).map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleSelectItem(item.id)}
                    className="flex items-center justify-between p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 hover:bg-amber-500/10 hover:border-amber-500/40 transition-all text-left group"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground">{item.category} · €{item.lastCost}/{item.unit}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-1 group-hover:translate-x-0.5 transition-transform" />
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
        </>
      ) : (
        /* ── Confirm step v2 — prominent cost feedback ── */
        <div className="px-4 py-4 space-y-5 overflow-y-auto">
          <div className="p-4 rounded-xl bg-muted/50">
            <p className="text-base font-bold">{selectedItem?.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedItem?.category} · €{selectedItem?.lastCost}/{selectedItem?.unit}
            </p>
          </div>

          {/* Quantity — with unit-adaptive chips */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Cantidad ({selectedItem?.unit})</p>
            <div className="flex items-center gap-3 justify-center">
              <Button
                variant="outline"
                size="icon"
                className="h-14 w-14 rounded-2xl text-lg"
                onClick={() => setQuantity(Math.max(0.1, quantity - (chips[0] || 1)))}
              >
                <Minus className="h-5 w-5" />
              </Button>
              <Input
                type="number"
                value={quantity}
                onChange={e => setQuantity(Math.max(0.1, parseFloat(e.target.value) || 0))}
                className="text-center text-2xl font-bold h-14 w-24 rounded-2xl"
                step={chips[0]}
                min="0.1"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-14 w-14 rounded-2xl text-lg"
                onClick={() => setQuantity(quantity + (chips[0] || 1))}
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
            {/* Unit-adaptive quick chips */}
            <div className="flex justify-center gap-2 mt-3">
              {chips.map(q => (
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

          {/* ── Cost preview — PROMINENT (Sprint 1 key feature) ── */}
          <div className="relative overflow-hidden rounded-2xl border-2 border-red-500/30 bg-gradient-to-r from-red-500/5 to-red-500/10">
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">💸 Coste estimado de esta merma</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {quantity} {selectedItem?.unit} × €{selectedItem?.lastCost?.toFixed(2)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-red-600 tabular-nums">
                  €{wasteValue.toFixed(2)}
                </p>
              </div>
            </div>
            {/* Animated bottom bar for visual weight */}
            <div
              className="h-1 bg-gradient-to-r from-red-400 to-red-600 transition-all duration-500"
              style={{ width: `${Math.min(100, (wasteValue / 50) * 100)}%` }}
            />
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
              className="flex-1 h-12 rounded-xl text-base font-semibold bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {isSubmitting ? 'Guardando...' : '✓ Registrar'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
