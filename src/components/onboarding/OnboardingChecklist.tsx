/**
 * OnboardingChecklist — shown on Dashboard for new users.
 * Guides them through initial setup steps.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Circle, ArrowRight, Plug2, Users, Upload, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';

interface Step {
    id: string;
    title: string;
    description: string;
    icon: typeof Plug2;
    path: string;
    checkFn: () => {t('onboarding.OnboardingChecklist.promise')}<boolean>;
}

export function OnboardingChecklist() {
  const { t } = useTranslation();
    const navigate = useNavigate();
    const { locations, group } = useApp();
    const [completed, setCompleted] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [dismissed, setDismissed] = useState(false);

    const steps: Step[] = [
        {
            id: 'pos',
            title: 'Conectar tu POS',
            description: 'Conecta Square o importa datos CSV',
            icon: Plug2,
            path: '/integrations',
            checkFn: async () => {
                // Check if any integration or import exists
                const { count } = await (supabase as any)
                    .from('sales_daily_unified')
                    .select('*', { count: 'exact', head: true })
                    .limit(1);
                return (count || 0) > 0;
            },
        },
        {
            id: 'team',
            title: t('onboarding.anadirTuEquipo'),
            description: 'Invita a managers y empleados',
            icon: Users,
            path: '/workforce/team',
            checkFn: async () => {
                const { count } = await (supabase as any)
                    .from('employees')
                    .select('*', { count: 'exact', head: true })
                    .limit(1);
                return (count || 0) > 0;
            },
        },
        {
            id: 'inventory',
            title: t('onboarding.configurarInventario'),
            description: t('onboarding.creaArticulosYRecetas'),
            icon: Upload,
            path: '/inventory-setup/items',
            checkFn: async () => {
                const { count } = await supabase
                    .from('inventory_items')
                    .select('*', { count: 'exact', head: true })
                    .limit(1);
                return (count || 0) > 0;
            },
        },
        {
            id: 'forecast',
            title: 'Tu primer forecast',
            description: t('onboarding.estaraListoCuandoTengamos7'),
            icon: BarChart3,
            path: '/insights/sales',
            checkFn: async () => {
                const { count } = await supabase
                    .from('forecast_daily_metrics')
                    .select('*', { count: 'exact', head: true })
                    .limit(1);
                return (count || 0) > 0;
            },
        },
    ];

    useEffect(() => {
        const checkAll = async () => {
            const results: Record<string, boolean> = {};
            for (const step of steps) {
                try {
                    results[step.id] = await step.checkFn();
                } catch {
                    results[step.id] = false;
                }
            }
            setCompleted(results);
            setLoading(false);
        };
        checkAll();

        // Check localStorage for dismissal
        const dismissedUntil = localStorage.getItem('onboarding_dismissed_until');
        if (dismissedUntil && new Date(dismissedUntil) > new Date()) {
            setDismissed(true);
        }
    }, []);

    const completedCount = Object.values(completed).filter(Boolean).length;
    const allDone = completedCount === steps.length;

    // Don't show if all done or dismissed
    if (allDone || dismissed || loading) return null;

    const handleDismiss = () => {
        // Dismiss for 24h
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        localStorage.setItem('onboarding_dismissed_until', tomorrow.toISOString());
        setDismissed(true);
    };

    return (
        <Card className="border-violet-200 bg-gradient-to-r from-violet-50 to-indigo-50">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                        {t('onboarding.OnboardingChecklist.empiezaConJosephine')}
                        <span className="text-xs font-normal text-muted-foreground">({completedCount}/{steps.length} completados)</span>
                    </CardTitle>
                    <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={handleDismiss}>
                        {t('onboarding.OnboardingChecklist.ocultarPorHoy')}
                    </Button>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 bg-violet-200 rounded-full mt-2">
                    <div
                        className="h-full bg-violet-600 rounded-full transition-all duration-500"
                        style={{ width: `${(completedCount / steps.length) * 100}%` }}
                    />
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {steps.map((step) => {
                        const Icon = step.icon;
                        const done = completed[step.id];
                        return (
                            <button
                                key={step.id}
                                onClick={() => !done && navigate(step.path)}
                                className={`flex items-start gap-3 p-3 rounded-lg text-left transition-colors ${done ? 'bg-white/50 opacity-60' : 'bg-white hover:bg-white/80 cursor-pointer shadow-sm'}`}
                            >
                                {done ? (
                                    <CheckCircle className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                                ) : (
                                    <Circle className="h-5 w-5 text-violet-400 mt-0.5 shrink-0" />
                                )}
                                <div>
                                    <p className={`text-sm font-medium ${done ? 'line-through text-muted-foreground' : ''}`}>{step.title}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
