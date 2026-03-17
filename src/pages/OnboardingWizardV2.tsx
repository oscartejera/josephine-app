/**
 * OnboardingWizardV2 — New user onboarding flow
 *
 * 2-step wizard:
 * 1. Connect POS (Square/Lightspeed/CSV/Skip)
 * 2. "Your account is ready" confirmation + optional product tour
 *
 * Shown to new users on first login via localStorage flag.
 * Includes react-joyride product tour of the Dashboard.
 */

import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
    Zap, Rocket, ChevronRight, ChevronLeft,
    CheckCircle, Link2, FileSpreadsheet,
    ArrowRight, Sparkles, SkipForward, Loader2
} from 'lucide-react';
import Joyride, { Step as JoyrideStep, STATUS, CallBackProps } from 'react-joyride';


// ── Types ─────────────────────────────────────────────────────────
type WizardStep = 1 | 2;

// ── Product Tour Steps (for Dashboard) ────────────────────────────
const TOUR_STEPS: JoyrideStep[] = [
    {
        target: '[data-tour="sidebar"]',
        content: t('onboarding.tourMainMenu'),
        placement: 'right',
        disableBeacon: true,
    },
    {
        target: '[data-tour="control-tower"]',
        content: t('onboarding.tourControlTower'),
        placement: 'bottom',
    },
    {
        target: '[data-tour="kpi-cards"]',
        content: t('onboarding.tourKpiCards'),
        placement: 'bottom',
    },
    {
        target: '[data-tour="insights"]',
        content: t('onboarding.tourInsights'),
        placement: 'right',
    },
    {
        target: '[data-tour="workforce"]',
        content: t('onboarding.tourWorkforce'),
        placement: 'right',
    },
    {
        target: '[data-tour="integrations"]',
        content: 'Conecta los sistemas POS que usas — Square, Lightspeed, o importa datos por CSV.',
        placement: 'right',
    },
];

// ── Storage key ───────────────────────────────────────────────────
const ONBOARDING_COMPLETE_KEY = 'josephine_onboarding_complete';
const TOUR_COMPLETE_KEY = 'josephine_tour_complete';

export function isOnboardingComplete(): boolean {
  const { t } = useTranslation();
    return localStorage.getItem(ONBOARDING_COMPLETE_KEY) === 'true';
}

export function markOnboardingComplete(): void {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
}

export function isTourComplete(): boolean {
    return localStorage.getItem(TOUR_COMPLETE_KEY) === 'true';
}

export function markTourComplete(): void {
    localStorage.setItem(TOUR_COMPLETE_KEY, 'true');
}

// ── Loading Transition Component ──────────────────────────────────
function SetupTransition() {
    return (
        <div className="fixed inset-0 z-[100] bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950 flex flex-col items-center justify-center gap-6">
            <div className="relative">
                <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl animate-pulse">
                    <Rocket className="h-10 w-10 text-white" />
                </div>
                <div className="absolute -inset-2 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 animate-ping" />
            </div>
            <div className="text-center space-y-2">
                <h2 className="text-xl font-bold">{t('onboardingWizardV2.configurandoTuCuenta')}</h2>
                <p className="text-sm text-muted-foreground">{t('onboardingWizardV2.preparandoJosephineParaTi')}</p>
            </div>
            <div className="flex gap-1.5">
                <div className="h-2 w-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:0ms]" />
                <div className="h-2 w-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:150ms]" />
                <div className="h-2 w-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:300ms]" />
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────
export default function OnboardingWizardV2() {
    const navigate = useNavigate();
    const { selectedLocationId, setOnboardingComplete } = useApp();
    const { session, user, profile } = useAuth();

    const [step, setStep] = useState<WizardStep>{t('onboardingWizardV2.1ConstPoschoiceSetposchoiceUsestate')}<'square' | 'lightspeed' | 'csv' | 'skip' | null>(null);
    const [showTour, setShowTour] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showTransition, setShowTransition] = useState(false);

    // Get restaurant name from sessionStorage (set during signup)
    const restaurantName = sessionStorage.getItem('josephine_restaurant_name') || t('onboarding.miRestaurante');

    // ── Step navigation ──────────────────────────────────────────
    const nextStep = () => setStep(s => Math.min(s + 1, 2) as WizardStep);
    const prevStep = () => setStep(s => Math.max(s - 1, 1) as WizardStep);

    const progress = step === 1 ? 0 : 100;

    // ── POS connect handlers ─────────────────────────────────────
    const handlePosConnect = (pos: 'square' | 'lightspeed') => {
        setPosChoice(pos);
        toast.success(t('onboarding.posSelectedLater', { pos: pos === 'square' ? 'Square' : 'Lightspeed' }));
    };

    // ── Finalize onboarding ──────────────────────────────────────
    const handleFinish = async () => {
        setSaving(true);
        setShowTransition(true);

        try {
            // Use server-side RPC to create group + location + owner role
            if (user && (!profile?.group_id)) {
                const { data, error } = await supabase.rpc('setup_new_owner', {
                    p_user_id: user.id,
                    p_group_name: restaurantName,
                    p_location_name: restaurantName,
                });

                if (error) {
                    console.error('Setup new owner error:', error);
                    toast.error(t('onboarding.toastError'));
                    setSaving(false);
                    setShowTransition(false);
                    return;
                }

                console.log('Owner setup complete:', data);
            }

            // Mark onboarding complete in localStorage + refresh AppContext
            markOnboardingComplete();
            await setOnboardingComplete();

            // Send welcome email (fire and forget — don't block the flow)
            supabase.functions.invoke('send_welcome_email', {
                body: {
                    email: user?.email,
                    fullName: profile?.full_name || user?.user_metadata?.full_name,
                    restaurantName,
                },
            }).catch(err => console.warn('Welcome email failed:', err));

            // Clean up sessionStorage
            sessionStorage.removeItem('josephine_restaurant_name');

            // Small delay for the transition animation
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Navigate based on POS choice
            if (posChoice === 'square') {
                navigate('/integrations/square');
            } else if (posChoice === 'lightspeed') {
                navigate('/integrations/lightspeed');
            } else if (posChoice === 'csv') {
                navigate('/settings/import');
            } else {
                navigate('/dashboard');
            }

            toast.success(t('onboarding.toastWelcome'));
        } catch (err) {
            console.error('Onboarding finish error:', err);
            toast.error(t('onboarding.toastFinalError'));
            setShowTransition(false);
        } finally {
            setSaving(false);
        }
    };

    const handleStartTour = async () => {
        await handleFinish();
        // Tour will auto-trigger from Dashboard via DashboardTour component
    };

    // ── Render: Step 1 — Connect POS ─────────────────────────────
    const renderStep1 = () => (
        <div className="space-y-6">
            <div className="text-center space-y-2">
                <div className="h-16 w-16 rounded-2xl bg-indigo-500/10 mx-auto flex items-center justify-center">
                    <Link2 className="h-8 w-8 text-indigo-500" />
                </div>
                <h2 className="text-2xl font-bold">{t('onboardingWizardV2.conectaTuSistemaPos')}</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                    {t('onboardingWizardV2.josephineImportaDatosDeTu')}
                </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 max-w-lg mx-auto">
                {/* Square */}
                <button
                    onClick={() => handlePosConnect('square')}
                    className={`p-5 rounded-xl border-2 text-left transition-all hover:shadow-md ${posChoice === 'square' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' : 'border-border hover:border-indigo-300'
                        }`}
                >
                    <Zap className="h-8 w-8 text-indigo-500 mb-2" />
                    <p className="font-semibold">{t('onboardingWizardV2.squarePos')}</p>
                    <p className="text-xs text-muted-foreground">{t('onboarding.conexionDirectaViaOauth')}</p>
                    {posChoice === 'square' && <CheckCircle className="h-5 w-5 text-indigo-500 mt-2" />}
                </button>

                {/* Lightspeed */}
                <button
                    onClick={() => handlePosConnect('lightspeed')}
                    className={`p-5 rounded-xl border-2 text-left transition-all hover:shadow-md ${posChoice === 'lightspeed' ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30' : 'border-border hover:border-amber-300'
                        }`}
                >
                    <Zap className="h-8 w-8 text-amber-500 mb-2" />
                    <p className="font-semibold">{t('onboardingWizardV2.lightspeed')}</p>
                    <p className="text-xs text-muted-foreground">{t('onboarding.conexionDirectaViaOauth')}</p>
                    {posChoice === 'lightspeed' && <CheckCircle className="h-5 w-5 text-amber-500 mt-2" />}
                </button>

                {/* CSV */}
                <button
                    onClick={() => { setPosChoice('csv'); }}
                    className={`p-5 rounded-xl border-2 text-left transition-all hover:shadow-md ${posChoice === 'csv' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'border-border hover:border-emerald-300'
                        }`}
                >
                    <FileSpreadsheet className="h-8 w-8 text-emerald-500 mb-2" />
                    <p className="font-semibold">{t('onboarding.subirCsv')}</p>
                    <p className="text-xs text-muted-foreground">{t('onboardingWizardV2.importaDatosDeCualquierPos')}</p>
                    {posChoice === 'csv' && <CheckCircle className="h-5 w-5 text-emerald-500 mt-2" />}
                </button>

                {/* Skip */}
                <button
                    onClick={() => { setPosChoice('skip'); }}
                    className={`p-5 rounded-xl border-2 text-left transition-all hover:shadow-md ${posChoice === 'skip' ? 'border-slate-400 bg-slate-50 dark:bg-slate-800' : 'border-border hover:border-slate-300'
                        }`}
                >
                    <SkipForward className="h-8 w-8 text-slate-400 mb-2" />
                    <p className="font-semibold">{t('onboarding.loHareDespues')}</p>
                    <p className="text-xs text-muted-foreground">{t('onboardingWizardV2.empiezaConDatosDeDemo')}</p>
                    {posChoice === 'skip' && <CheckCircle className="h-5 w-5 text-slate-400 mt-2" />}
                </button>
            </div>
        </div>
    );

    // ── Render: Step 2 — Confirmation ──────────────────────────
    const renderStep2 = () => {
        return (
            <div className="space-y-6">
                <div className="text-center space-y-2">
                    <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-500 mx-auto flex items-center justify-center">
                        <Rocket className="h-10 w-10 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold">{t('onboardingWizardV2.todoListo')}</h2>
                    <p className="text-muted-foreground max-w-md mx-auto">
                        <strong>{restaurantName}</strong>{t('onboarding.yaEstaConfiguradoEnJosephine')}<strong>{t('onboardingWizardV2.menosDe24Horas')}</strong>.
                    </p>
                </div>

                {/* Summary */}
                <div className="max-w-md mx-auto space-y-3">
                    <div className="p-4 rounded-xl bg-muted/50 space-y-2">
                        <div className="flex items-center gap-3">
                            <CheckCircle className="h-5 w-5 text-emerald-500" />
                            <span className="text-sm">
                                <strong>{t('onboardingWizardV2.pos')}</strong>{' '}
                                {posChoice === 'square' ? t('onboarding.squareConnectLater') :
                                    posChoice === 'lightspeed' ? t('onboarding.lightspeedConnectLater') :
                                        posChoice === 'csv' ? t('onboarding.importacionCsv') : t('onboarding.seConfiguraraDespues')}
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <CheckCircle className="h-5 w-5 text-emerald-500" />
                            <span className="text-sm">
                                <strong>{t('onboarding.restaurante')}</strong> {restaurantName}
                            </span>
                        </div>
                    </div>

                    <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800">
                        <div className="flex items-start gap-3">
                            <Sparkles className="h-5 w-5 text-indigo-500 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-medium text-indigo-700 dark:text-indigo-300">{t('onboarding.tuPrimeraPrevisionEn24h')}</p>
                                <p className="text-indigo-600 dark:text-indigo-400 mt-1">
                                    {t('onboardingWizardV2.josephineAnalizaraTusDatosY')}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 pt-2">
                        <Button
                            size="lg"
                            onClick={async () => {
                                await handleFinish();
                            }}
                            disabled={saving}
                            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white h-14 text-lg rounded-xl"
                        >
                            <Rocket className="h-5 w-5 mr-2" />
                            {t('onboardingWizardV2.empezarAUsarJosephine')}
                        </Button>

                        <Button
                            variant="outline"
                            size="lg"
                            onClick={async () => {
                                await handleStartTour();
                            }}
                            disabled={saving}
                            className="w-full h-12 rounded-xl"
                        >
                            <Sparkles className="h-4 w-4 mr-2" />
                            {t('onboardingWizardV2.empezarConTourGuiado')}
                        </Button>
                    </div>
                </div>
            </div>
        );
    };

    // ── Can proceed ──────────────────────────────────────────
    const canNext = () => {
        switch (step) {
            case 1: return posChoice !== null;
            default: return true;
        }
    };

    // ── Show loading transition ──────────────────────────────────
    if (showTransition) {
        return <SetupTransition />;
    }

    // ── Render ───────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950 flex flex-col z-50">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <span className="text-white font-bold text-sm">J</span>
                    </div>
                    <span className="font-display font-bold text-lg">{t('onboardingWizardV2.josephine')}</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                        Paso {step} de 2
                    </span>
                    <div className="w-32">
                        <Progress value={progress} className="h-2" />
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex items-center justify-center p-6 overflow-auto">
                <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                </div>
            </div>

            {/* Footer — only show on step 1 */}
            {step === 1 && (
                <div className="flex items-center justify-end px-6 py-4 border-t bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                    <Button
                        onClick={nextStep}
                        disabled={!canNext()}
                    >{t('settings.siguiente')}<ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                </div>
            )}
        </div>
    );
}

// ── Dashboard Tour Component ──────────────────────────────────────
// Use this in Dashboard.tsx to show the product tour
export function DashboardTour() {
    const [run, setRun] = useState(false);

    useEffect(() => {
        // Check if user just completed onboarding and wants tour
        const params = new URLSearchParams(window.location.search);
        if (params.get('tour') === 'true' || (!isTourComplete() && isOnboardingComplete())) {
            // Small delay to let Dashboard mount with data-tour attributes
            setTimeout(() => setRun(true), 1000);
        }
    }, []);

    const handleCallback = (data: CallBackProps) => {
        const { status } = data;
        if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
            markTourComplete();
            setRun(false);
        }
    };

    if (!run) return null;

    return (
        <Joyride
            steps={TOUR_STEPS}
            run={run}
            continuous
            showProgress
            showSkipButton
            scrollToFirstStep
            disableOverlayClose
            callback={handleCallback}
            locale={{
                back: t('onboarding.atras'),
                close: t('onboarding.cerrar'),
                last: 'Listo',
                next: 'Siguiente',
                skip: 'Saltar tour',
            }}
            styles={{
                options: {
                    primaryColor: '#6366f1',
                    zIndex: 10000,
                },
                tooltip: {
                    borderRadius: 12,
                    fontSize: 14,
                },
                buttonNext: {
                    borderRadius: 8,
                    padding: '8px 16px',
                },
                buttonBack: {
                    borderRadius: 8,
                    marginRight: 8,
                },
            }}
        />
    );
}
