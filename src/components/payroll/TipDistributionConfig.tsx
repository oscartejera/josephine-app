/**
 * TipDistributionConfig — Configure and preview tip distribution
 *
 * Allows setting tip distribution rules per location,
 * entering daily tips, and previewing/applying distributions.
 * Stores to tip_distribution_rules + tip_entries + tip_distributions
 * via calculate_tip_distribution RPC.
 */

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

const DISTRIBUTION_METHODS = [
    { value: 'hours_worked', label: 'Por horas trabajadas', description: 'Proporcional a las horas de cada persona' },
    { value: 'equal_split', label: 'Reparto equitativo', description: 'Igual para todos los que trabajaron' },
    { value: 'role_weighted', label: 'Por rol/puesto', description: t('payroll.pesosDiferentesSegunElPuesto') },
] as const;

interface TipDistributionConfigProps {
    locationId: string | null;
    className?: string;
}

interface Distribution {
    employee_id: string;
    employee_name: string;
    role: string;
    hours_worked: number;
    weight: number;
    share_amount: number;
}

interface DistributionResult {
    tip_entry_id: string;
    date: string;
    total_tips: number;
    pool_percentage: number;
    pool_amount: number;
    method: string;
    distributions: Distribution[];
    employee_count: number;
}

function formatCurrency(v: number) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v);
}

export function TipDistributionConfig({ locationId, className }: TipDistributionConfigProps) {
  const { t } = useTranslation();
    const { profile } = useAuth();
    const { accessibleLocations } = useApp();
    const orgId = profile?.group_id;
    const effectiveLocationId = locationId || (accessibleLocations.length > {t('payroll.TipDistributionConfig.0Accessiblelocations0idNullConstTipamoun')}<number>{t('payroll.TipDistributionConfig.0ConstTipdateSettipdateUsestateformatnew')}<string>{t('payroll.TipDistributionConfig.hoursworkedConstPoolpctSetpoolpctUsestat')}<number>{t('payroll.TipDistributionConfig.100ConstSavingSetsavingUsestatefalse')}<DistributionResult | null>(null);
    const [ruleLoaded, setRuleLoaded] = useState(false);

    // Load existing rule
    useEffect(() => {
        async function loadRule() {
            if (!orgId || !effectiveLocationId) return;
            const { data } = await supabase
                .from('tip_distribution_rules' as any)
                .select('method, pool_percentage')
                .eq('org_id', orgId)
                .eq('location_id', effectiveLocationId)
                .eq('is_active', true)
                .maybeSingle();

            if (data) {
                setMethod((data as any).method);
                setPoolPct(Number((data as any).pool_percentage));
            }
            setRuleLoaded(true);
        }
        loadRule();
    }, [orgId, effectiveLocationId]);

    const handleDistribute = async () => {
        if (!orgId || !effectiveLocationId || tipAmount <= 0) return;
        setSaving(true);

        try {
            // 1) Upsert the rule
            await supabase.from('tip_distribution_rules' as any).upsert({
                org_id: orgId,
                location_id: effectiveLocationId,
                rule_name: 'default',
                method,
                pool_percentage: poolPct,
                is_active: true,
            }, { onConflict: 'org_id,location_id,rule_name' });

            // 2) Upsert the tip entry
            const { data: entryData } = await supabase
                .from('tip_entries' as any)
                .upsert({
                    org_id: orgId,
                    location_id: effectiveLocationId,
                    date: tipDate,
                    total_tips: tipAmount,
                    source: 'manual',
                    created_by: profile?.id,
                }, { onConflict: 'org_id,location_id,date' })
                .select('id')
                .single();

            if (!entryData) throw new Error('Failed to create tip entry');

            // 3) Calculate distribution
            const { data: distResult, error } = await supabase.rpc('calculate_tip_distribution' as any, {
                p_tip_entry_id: (entryData as any).id,
            });

            if (error) throw error;
            setResult(distResult as DistributionResult);
        } catch (err) {
            console.error('Tip distribution error:', err);
        } finally {
            setSaving(false);
        }
    };

    if (!effectiveLocationId) {
        return (
            <Card className={cn("bg-white", className)}>
                <CardHeader><CardTitle className="text-base">{t('payroll.distribucionDePropinas')}</CardTitle></CardHeader>
                <CardContent>
                    <p className="text-sm text-gray-500 text-center py-4">{t('payroll.seleccionaUnaUbicacion')}</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={cn("bg-white", className)}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base font-semibold">{t('payroll.distribucionDePropinas')}</CardTitle>
                        <p className="text-xs text-gray-500 mt-0.5">{t('payroll.TipDistributionConfig.configuraReglasYDistribuyePropinas')}</p>
                    </div>
                    {result && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            {t('payroll.TipDistributionConfig.distribuido')}
                        </span>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Input row */}
                <div className="grid grid-cols-3 gap-3">
                    <div>
                        <Label className="text-xs font-medium text-gray-600">{t('ai.fecha')}</Label>
                        <Input
                            type="date"
                            value={tipDate}
                            onChange={e => setTipDate(e.target.value)}
                            className="h-9 mt-1"
                        />
                    </div>
                    <div>
                        <Label className="text-xs font-medium text-gray-600">{t('payroll.totalPropinas')}</Label>
                        <div className="relative mt-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={tipAmount || ''}
                                onChange={e => setTipAmount(parseFloat(e.target.value) || 0)}
                                className="pl-7 h-9 text-right"
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                    <div>
                        <Label className="text-xs font-medium text-gray-600">{t('payroll.TipDistributionConfig.pool')}</Label>
                        <div className="relative mt-1">
                            <Input
                                type="number"
                                min="0"
                                max="100"
                                value={poolPct}
                                onChange={e => setPoolPct(parseFloat(e.target.value) || 100)}
                                className="h-9 text-right pr-7"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                        </div>
                    </div>
                </div>

                {/* Method selector */}
                <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600">{t('payroll.metodoDeDistribucion')}</Label>
                    <div className="grid grid-cols-3 gap-2">
                        {DISTRIBUTION_METHODS.map(m => (
                            <button
                                key={m.value}
                                onClick={() => setMethod(m.value)}
                                className={cn(
                                    "p-2.5 rounded-lg border text-left transition-all",
                                    method === m.value
                                        ? "border-indigo-300 bg-indigo-50 ring-1 ring-indigo-200"
                                        : "border-gray-200 bg-gray-50/50 hover:border-gray-300"
                                )}
                            >
                                <div className="text-xs font-semibold text-gray-800">{m.label}</div>
                                <div className="text-[10px] text-gray-500 mt-0.5">{m.description}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Distribute button */}
                <Button
                    onClick={handleDistribute}
                    disabled={saving || tipAmount <= 0}
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                >
                    {saving ? 'Calculando...' : 'Calcular y Distribuir'}
                </Button>

                {/* Results */}
                {result && result.distributions.length > 0 && (
                    <div className="space-y-2 pt-3 border-t border-gray-100">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                            <span>Pool: {formatCurrency(result.pool_amount)} ({result.pool_percentage}%)</span>
                            <span>{result.employee_count} empleados</span>
                        </div>
                        {result.distributions.map(d => (
                            <div key={d.employee_id} className="flex items-center justify-between py-2 px-3 bg-gray-50/50 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white text-[9px] font-bold">
                                        {d.employee_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium text-gray-800">{d.employee_name}</span>
                                        <span className="text-[10px] text-gray-400 ml-1.5">{d.role || 'Equipo'}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-gray-500">{d.hours_worked.toFixed(1)}h</span>
                                    <span className="text-sm font-bold text-emerald-600">{formatCurrency(d.share_amount)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {result && result.distributions.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-2">
                        {t('payroll.TipDistributionConfig.noHayTurnosProgramadosPara')}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
