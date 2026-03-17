/**
 * Pricing / Billing page — Stripe integration
 * Shows plans, current subscription, and upgrade/downgrade options.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles, Building2, Zap, Crown } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import posthog from 'posthog-js';
import { useTranslation } from 'react-i18next';

const STRIPE_PK = import.meta.env.VITE_STRIPE_PK || 'pk_live_51SsXizC46WZ7nQ8jQMm0oKqU4Dg3MXzakAT1jE6vqqHn3aJ8Zsa1OrKpoDvgay7ew4LDc73yVZhBVFiYcKSNJhxi00rb2FXHT7';

interface Plan {
    id: string;
    name: string;
    price: number;
    interval: string;
    icon: typeof Sparkles;
    color: string;
    features: string[];
    highlighted?: boolean;
    stripePriceId?: string;
}

const PLANS: Plan[] = [
    {
        id: 'free',
        name: 'Starter',
        price: 0,
        interval: 'mes',
        icon: Zap,
        color: 'text-gray-500',
        features: [
            t('pricing.1Ubicacion'),
            t('pricing.dashboardBasico'),
            t('pricing.ventasEInventario'),
            t('pricing.hasta30DiasDeHistorico'),
            'Soporte por email',
        ],
    },
    {
        id: 'pro',
        name: 'Pro',
        price: 49,
        interval: 'mes',
        icon: Sparkles,
        color: 'text-violet-600',
        highlighted: true,
        stripePriceId: 'price_1T7y8hC46WZ7nQ8jTQc6JFD0',
        features: [
            'Hasta 3 ubicaciones',
            'AI Forecast (Prophet + XGBoost)',
            'Auto-scheduling',
            'Josephine Chat AI',
            'Procurement AI',
            t('pricing.historicoIlimitado'),
            t('pricing.exportarCsvpdf'),
            'Soporte prioritario',
        ],
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        price: 149,
        interval: 'mes',
        icon: Crown,
        color: 'text-amber-600',
        stripePriceId: 'price_1T7y8iC46WZ7nQ8jEJPQZZcU8',
        features: [
            'Ubicaciones ilimitadas',
            'Todo en Pro +',
            'Multi-chain analytics',
            'API acceso completo',
            'SSO / SAML',
            'Account Manager dedicado',
            'SLA 99.9%',
            'Onboarding personalizado',
        ],
    },
];

export default function Pricing() {
  const { t } = useTranslation();
    const { group } = useApp();
    const { session } = useAuth();
    const [loading, setLoading] = useState<string | null>(null);

    // Current plan — check from org metadata
    const currentPlan = group?.plan || 'free';

    const handleUpgrade = async (plan: Plan) => {
        if (!plan.stripePriceId) {
            toast.info(t('pricing.toastFreePlan'));
            return;
        }

        setLoading(plan.id);
        posthog.capture('plan_upgrade_clicked', {
            plan_id: plan.id,
            plan_name: plan.name,
            price: plan.price,
            current_plan: currentPlan,
        });
        try {
            // Call edge function to create Stripe Checkout session
            const { data, error } = await supabase.functions.invoke('create_checkout_session', {
                body: {
                    priceId: plan.stripePriceId,
                    successUrl: `${window.location.origin}/settings/billing?success=true`,
                    cancelUrl: `${window.location.origin}/settings/billing?canceled=true`,
                },
            });

            if (error) {
                console.error('Supabase function error:', error);
                toast.error(`Error: ${error.message || 'No se pudo conectar con el servidor'}`);
                return;
            }

            // Edge function might return error in the body
            if (data?.error) {
                console.error('Checkout session error:', data.error);
                toast.error(`Error de Stripe: ${data.error}`);
                return;
            }

            if (data?.url) {
                posthog.capture('checkout_started', {
                    plan_id: plan.id,
                    plan_name: plan.name,
                });
                window.location.href = data.url;
            } else {
                console.error('No checkout URL received:', data);
                toast.error(t('pricing.toastPaymentError'));
            }
        } catch (err: any) {
            console.error('Stripe checkout error:', err);
            toast.error(`Error: ${err?.message || t('pricing.errorAlConectarConStripe')}`);
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="p-6 space-y-8 max-w-5xl mx-auto">
            <div className="text-center">
                <h1 className="text-3xl font-display font-bold">Planes y Precios</h1>
                <p className="text-muted-foreground mt-2 text-lg">
                    Elige el plan que mejor se adapte a tu negocio
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {PLANS.map((plan) => {
                    const Icon = plan.icon;
                    const isCurrent = currentPlan === plan.id;
                    return (
                        <Card
                            key={plan.id}
                            className={`relative transition-shadow ${plan.highlighted ? 'border-violet-400 shadow-lg shadow-violet-100 ring-2 ring-violet-200' : ''}`}
                        >
                            {plan.highlighted && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <Badge className="bg-violet-600 text-white">{t('pricing.masPopular')}</Badge>
                                </div>
                            )}
                            <CardHeader className="text-center pb-2">
                                <Icon className={`h-8 w-8 mx-auto mb-2 ${plan.color}`} />
                                <CardTitle className="text-xl">{plan.name}</CardTitle>
                                <div className="mt-2">
                                    <span className="text-4xl font-bold">€{plan.price}</span>
                                    <span className="text-muted-foreground">/{plan.interval}</span>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <ul className="space-y-2.5">
                                    {plan.features.map((f, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm">
                                            <Check className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                                            <span>{f}</span>
                                        </li>
                                    ))}
                                </ul>

                                <Button
                                    className={`w-full ${plan.highlighted ? 'bg-violet-600 hover:bg-violet-700' : ''}`}
                                    variant={plan.highlighted ? 'default' : 'outline'}
                                    disabled={isCurrent || loading === plan.id}
                                    onClick={() => handleUpgrade(plan)}
                                >
                                    {loading === plan.id ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                                    ) : isCurrent ? (
                                        'Plan Actual'
                                    ) : plan.price === 0 ? (
                                        'Plan Gratuito'
                                    ) : (
                                        `Upgrade a ${plan.name}`
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* FAQ */}
            <Card>
                <CardHeader>
                    <CardTitle>Preguntas Frecuentes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                    <div>
                        <p className="font-medium">{t('pricing.puedoCambiarDePlanEn')}</p>
                        <p className="text-muted-foreground">{t('pricing.siLosUpgradesSonInmediatos')}</p>
                    </div>
                    <div>
                        <p className="font-medium">{t('pricing.hayPeriodoDePrueba')}</p>
                        <p className="text-muted-foreground">El plan Starter es gratuito para siempre. Pro y Enterprise tienen 14 días de prueba gratis.</p>
                    </div>
                    <div>
                        <p className="font-medium">{t('pricing.comoFuncionaLaFacturacion')}</p>
                        <p className="text-muted-foreground">{t('pricing.cobramosMensualmenteViaStripeRecibiras')}</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
