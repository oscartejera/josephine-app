/**
 * SmartCountingFlow — Guided inventory count with variance alerts
 * Similar to Nory's "smart counting" feature
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { format } from 'date-fns';
import { Package, CheckCircle2, AlertTriangle, ArrowRight, RotateCcw, ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface CountItem {
    id: string;
    name: string;
    unit: string;
    expectedQty: number;
    countedQty: number | null;
    variance: number | null;
    variancePct: number | null;
    status: 'pending' | 'counted' | 'variance';
    categoryName: string;
}

export function SmartCountingFlow({ locationId }: { locationId: string | null }) {
  const { t } = useTranslation();
    const { group } = useApp();
    const [items, setItems] = useState<CountItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [countValue, setCountValue] = useState('');
    const [phase, setPhase] = useState<'idle' | 'counting' | 'review'>('idle');
    const [saving, setSaving] = useState(false);

    const loadItems = useCallback(async () => {
        if (!group?.id) return;
        setLoading(true);
        try {
            const { data: invItems } = await (supabase
                .from('inventory_items')
                .select('id, name, unit, last_cost, category_id, inventory_categories(name)')
                .eq('org_id', group.id)
                .eq('is_active', true)
                .order('name')
                .limit(200) as any);

            if (!invItems) { setLoading(false); return; }

            // Get latest counts for reference
            const itemIds = invItems.map((i: any) => i.id);
            const { data: latestCounts } = await (supabase
                .from('inventory_counts' as any)
                .select('item_id, counted_qty')
                .in('item_id', itemIds)
                .order('count_date', { ascending: false })
                .limit(500) as any);

            const countMap = new Map<string, number>();
            if (latestCounts) {
                for (const c of latestCounts) {
                    if (!countMap.has(c.item_id)) countMap.set(c.item_id, Number(c.counted_qty) || 0);
                }
            }

            setItems(invItems.map((item: any) => ({
                id: item.id,
                name: item.name,
                unit: item.unit || 'ud',
                expectedQty: countMap.get(item.id) || 0,
                countedQty: null,
                variance: null,
                variancePct: null,
                status: 'pending',
                categoryName: item.inventory_categories?.name || t('inventory.sinCategoria'),
            })));
        } catch (err) {
            console.error('Smart counting load error:', err);
        } finally {
            setLoading(false);
        }
    }, [group?.id]);

    useEffect(() => { loadItems(); }, [loadItems]);

    const startCounting = () => {
        setPhase('counting');
        setCurrentIndex(0);
        setCountValue('');
    };

    const submitCount = () => {
        const value = parseFloat(countValue);
        if (isNaN(value) || value < 0) {
            toast.error(t('smartCounting.toastInvalidQty'));
            return;
        }

        setItems(prev => prev.map((item, i) => {
            if (i !== currentIndex) return item;
            const variance = value - item.expectedQty;
            const variancePct = item.expectedQty > 0 ? (variance / item.expectedQty) * 100 : 0;
            return {
                ...item,
                countedQty: value,
                variance,
                variancePct,
                status: Math.abs(variancePct) > 10 ? 'variance' : 'counted',
            };
        }));

        // Move to next or finish
        if (currentIndex < items.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setCountValue('');
        } else {
            setPhase('review');
        }
    };

    const skipItem = () => {
        if (currentIndex < items.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setCountValue('');
        } else {
            setPhase('review');
        }
    };

    const saveAll = async () => {
        setSaving(true);
        try {
            const counted = items.filter(i => i.countedQty !== null);
            if (counted.length === 0) {
                toast.error(t('smartCounting.toastNoCountsToSave'));
                setSaving(false);
                return;
            }

            // Save as stock movements
            const movements = counted.map(item => ({
                item_id: item.id,
                qty_delta: (item.variance || 0),
                reason: 'count_adjustment',
                recorded_by: 'smart_count',
                unit_cost: 0,
                created_at: new Date().toISOString(),
            }));

            // Try to insert (table may or may not exist)
            await (supabase.from('stock_movements') as any).insert(movements);

            toast.success(`${counted.length} contajes guardados correctamente`);
            setPhase('idle');
            loadItems();
        } catch (err: any) {
            toast.error(t('smartCounting.toastSaveError'), { description: err.message });
        } finally {
            setSaving(false);
        }
    };

    const countedCount = items.filter(i => i.countedQty !== null).length;
    const varianceCount = items.filter(i => i.status === 'variance').length;
    const progress = items.length > 0 ? (countedCount / items.length) * 100 : 0;

    if (loading) {
        return <div className="text-center py-8 text-muted-foreground">{t('inventory.cargandoInventario')}</div>;
    }

    // IDLE: Show start button
    if (phase === 'idle') {
        return (
            <Card>
                <CardContent className="py-8 text-center">
                    <ClipboardCheck className="h-12 w-12 mx-auto mb-4 text-primary/60" />
                    <h3 className="text-lg font-semibold mb-2">Smart Counting</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Contaje guiado de {items.length} artículos con alertas de variación automáticas
                    </p>
                    <Button onClick={startCounting} disabled={items.length === 0}>
                        <Package className="h-4 w-4 mr-2" />
                        Iniciar Contaje
                    </Button>
                </CardContent>
            </Card>
        );
    }

    // COUNTING: One item at a time
    if (phase === 'counting') {
        const current = items[currentIndex];
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Smart Counting</h3>
                    <Badge variant="outline">{currentIndex + 1} / {items.length}</Badge>
                </div>
                <Progress value={(currentIndex / items.length) * 100} />

                <Card className="border-primary/20">
                    <CardContent className="py-6 text-center">
                        <Badge className="mb-3">{current.categoryName}</Badge>
                        <h2 className="text-xl font-bold mb-1">{current.name}</h2>
                        <p className="text-sm text-muted-foreground mb-4">
                            Último contaje: {current.expectedQty} {current.unit}
                        </p>

                        <div className="flex items-center gap-3 max-w-xs mx-auto">
                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={countValue}
                                onChange={e => setCountValue(e.target.value)}
                                placeholder={t('inventory.quantityInUnit', { unit: current.unit })}
                                className="text-center text-lg"
                                autoFocus
                                onKeyDown={e => e.key === 'Enter' && submitCount()}
                            />
                            <span className="text-sm text-muted-foreground whitespace-nowrap">{current.unit}</span>
                        </div>

                        <div className="flex gap-2 justify-center mt-4">
                            <Button variant="ghost" size="sm" onClick={skipItem}>
                                Saltar
                            </Button>
                            <Button onClick={submitCount} disabled={!countValue}>
                                <ArrowRight className="h-4 w-4 mr-1" />
                                {currentIndex < items.length - 1 ? t('settings.siguiente') : 'Finalizar'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // REVIEW: Show all results
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold">{t('inventory.revisionDelContaje')}</h3>
                <div className="flex gap-2">
                    <Badge variant="outline">{countedCount} contados</Badge>
                    {varianceCount > 0 && (
                        <Badge variant="destructive">{varianceCount} variaciones</Badge>
                    )}
                </div>
            </div>
            <Progress value={progress} />

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {items.filter(i => i.countedQty !== null).map(item => (
                    <Card key={item.id} className={item.status === 'variance' ? 'border-amber-300' : ''}>
                        <CardContent className="py-2 px-4 flex items-center justify-between">
                            <div>
                                <p className="font-medium text-sm">{item.name}</p>
                                <p className="text-xs text-muted-foreground">{item.categoryName}</p>
                            </div>
                            <div className="text-right flex items-center gap-3">
                                <div>
                                    <p className="text-sm">
                                        <span className="text-muted-foreground">{item.expectedQty}</span>
                                        <span className="mx-1">→</span>
                                        <span className="font-medium">{item.countedQty}</span>
                                        <span className="text-xs text-muted-foreground ml-1">{item.unit}</span>
                                    </p>
                                    {item.variance !== 0 && (
                                        <p className={`text-xs ${(item.variancePct || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {(item.variance || 0) > 0 ? '+' : ''}{item.variance?.toFixed(1)} ({item.variancePct?.toFixed(1)}%)
                                        </p>
                                    )}
                                </div>
                                {item.status === 'variance' ? (
                                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                                ) : (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => { setPhase('idle'); }}>
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Reiniciar
                </Button>
                <Button onClick={saveAll} disabled={saving}>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    {saving ? 'Guardando...' : t('inventory.saveCounts', { count: countedCount })}
                </Button>
            </div>
        </div>
    );
}
