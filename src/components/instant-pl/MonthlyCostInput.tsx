/**
 * MonthlyCostInput — Native COGS input for manual entry
 *
 * Simple modal/form to enter monthly COGS by category.
 * Stores to monthly_cost_entries table via Supabase.
 * Accessible from both P&L page and Labour page.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const COGS_CATEGORIES = [
    { key: 'food', label: 'Alimentación', icon: '🍖', description: 'Materias primas' },
    { key: 'beverage', label: 'Bebidas', icon: '🍷', description: 'Vinos, refrescos, café' },
    { key: 'packaging', label: 'Packaging', icon: '📦', description: 'Envases, bolsas, cajas' },
    { key: 'supplies', label: 'Suministros', icon: '🧴', description: 'Limpieza, desechables' },
    { key: 'other', label: 'Otros', icon: '📋', description: 'Otros costes directos' },
] as const;

interface MonthlyCostInputProps {
    year: number;
    month: number;
    locationId?: string;
    onSaved?: () => void;
    className?: string;
}

interface CostEntry {
    category: string;
    amount: number;
    id?: string;
}

export function MonthlyCostInput({ year, month, locationId, onSaved, className }: MonthlyCostInputProps) {
    const { profile } = useAuth();
    const orgId = profile?.group_id;
    const [entries, setEntries] = useState<Record<string, number>>({});
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);

    const monthName = new Date(year, month - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

    // Load existing entries
    useEffect(() => {
        async function load() {
            if (!orgId) return;
            setLoading(true);
            const { data, error } = await supabase
                .from('monthly_cost_entries')
                .select('category, amount')
                .eq('org_id', orgId)
                .eq('period_year', year)
                .eq('period_month', month)
                .eq('location_id', locationId || 'all');

            if (!error && data) {
                const map: Record<string, number> = {};
                (data as any[]).forEach((row) => {
                    map[row.category] = Number(row.amount) || 0;
                });
                setEntries(map);
            }
            setLoading(false);
        }
        load();
    }, [orgId, year, month, locationId]);

    const handleChange = (category: string, value: string) => {
        const num = parseFloat(value) || 0;
        setEntries(prev => ({ ...prev, [category]: num }));
        setSaved(false);
    };

    const handleSave = async () => {
        if (!orgId) return;
        setSaving(true);

        try {
            for (const cat of COGS_CATEGORIES) {
                const amount = entries[cat.key] || 0;
                await supabase
                    .from('monthly_cost_entries')
                    .upsert(
                        {
                            org_id: orgId,
                            location_id: locationId || 'all',
                            period_year: year,
                            period_month: month,
                            category: cat.key,
                            amount,
                            source: 'manual',
                            created_by: profile?.id,
                        },
                        { onConflict: 'org_id,location_id,period_year,period_month,category' }
                    );
            }
            setSaved(true);
            onSaved?.();
        } catch (err) {
            console.error('Error saving COGS entries:', err);
        } finally {
            setSaving(false);
        }
    };

    const totalCogs = Object.values(entries).reduce((sum, v) => sum + (v || 0), 0);

    return (
        <Card className={cn("bg-white", className)}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base font-semibold">Costes Directos (COGS)</CardTitle>
                        <p className="text-xs text-gray-500 mt-0.5">{monthName} — Entrada manual</p>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-amber-100 text-amber-700">
                        ~ Manual
                    </span>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {loading ? (
                    <div className="space-y-3">
                        {COGS_CATEGORIES.map(cat => (
                            <div key={cat.key} className="h-10 bg-gray-100 rounded animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <>
                        {COGS_CATEGORIES.map(cat => (
                            <div key={cat.key} className="flex items-center gap-3">
                                <div className="flex items-center gap-2 min-w-[160px]">
                                    <span className="text-base">{cat.icon}</span>
                                    <div>
                                        <Label className="text-sm font-medium text-gray-700">{cat.label}</Label>
                                        <p className="text-[10px] text-gray-400">{cat.description}</p>
                                    </div>
                                </div>
                                <div className="flex-1 relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={entries[cat.key] || ''}
                                        onChange={e => handleChange(cat.key, e.target.value)}
                                        className="pl-7 h-9 text-right"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                        ))}

                        {/* Total row */}
                        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                            <span className="text-sm font-semibold text-gray-700">Total COGS</span>
                            <span className="text-lg font-bold text-gray-900">
                                {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(totalCogs)}
                            </span>
                        </div>

                        {/* Save button */}
                        <Button
                            onClick={handleSave}
                            disabled={saving}
                            className={cn(
                                "w-full",
                                saved
                                    ? "bg-emerald-600 hover:bg-emerald-700"
                                    : "bg-indigo-600 hover:bg-indigo-700"
                            )}
                        >
                            {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar COGS'}
                        </Button>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
