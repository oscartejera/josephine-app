/**
 * OnboardingWizardV2 — New user onboarding flow
 *
 * 4-step wizard:
 * 1. Connect POS (Square/Lightspeed/CSV/Skip)
 * 2. Configure team (import from POS or add manually)
 * 3. Import menu (from POS, CSV, or skip)
 * 4. "First forecast in 24h" confirmation + optional product tour
 *
 * Shown to new users on first login via localStorage flag.
 * Includes react-joyride product tour of the Dashboard.
 */

import { useState, useCallback, useEffect } from 'react';
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
    Zap, Users, ChefHat, Rocket, ChevronRight, ChevronLeft,
    Plus, Trash2, CheckCircle, Link2, FileSpreadsheet,
    ArrowRight, Sparkles, Upload, SkipForward
} from 'lucide-react';
import Joyride, { Step as JoyrideStep, STATUS, CallBackProps } from 'react-joyride';

// ── Types ─────────────────────────────────────────────────────────
type WizardStep = 1 | 2 | 3 | 4;

interface TeamMember {
    name: string;
    role: string;
}

const ROLES = [
    'Camarero/a', 'Cocinero/a', 'Barista', 'Gerente',
    'Repartidor/a', 'Lavaplatos', 'Hostess',
];

// ── Product Tour Steps (for Dashboard) ────────────────────────────
const TOUR_STEPS: JoyrideStep[] = [
    {
        target: '[data-tour="sidebar"]',
        content: 'Aquí tienes el menú principal. Navega entre las distintas secciones de Josephine.',
        placement: 'right',
        disableBeacon: true,
    },
    {
        target: '[data-tour="control-tower"]',
        content: 'El Control Tower es tu centro de mando. Aquí ves un resumen de todo tu negocio.',
        placement: 'bottom',
    },
    {
        target: '[data-tour="kpi-cards"]',
        content: 'Las tarjetas KPI muestran métricas clave: ventas, personal, costes y previsiones.',
        placement: 'bottom',
    },
    {
        target: '[data-tour="insights"]',
        content: 'En Insights encontrarás análisis detallados: ventas, personal, P&L, reseñas, inventario y más.',
        placement: 'right',
    },
    {
        target: '[data-tour="workforce"]',
        content: 'Workforce gestiona tu equipo: turnos, fichajes, onboarding y más.',
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

// ── Main Component ────────────────────────────────────────────────
export default function OnboardingWizardV2() {
    const navigate = useNavigate();
    const { selectedLocationId, setOnboardingComplete } = useApp();
    const { session, user, profile } = useAuth();

    const [step, setStep] = useState<WizardStep>(1);
    const [posChoice, setPosChoice] = useState<'square' | 'lightspeed' | 'csv' | 'skip' | null>(null);
    const [team, setTeam] = useState<TeamMember[]>([
        { name: '', role: 'Camarero/a' },
    ]);
    const [menuChoice, setMenuChoice] = useState<'pos' | 'csv' | 'skip' | null>(null);
    const [showTour, setShowTour] = useState(false);
    const [saving, setSaving] = useState(false);

    // ── Step navigation ──────────────────────────────────────────
    const nextStep = () => setStep(s => Math.min(s + 1, 4) as WizardStep);
    const prevStep = () => setStep(s => Math.max(s - 1, 1) as WizardStep);

    const progress = ((step - 1) / 3) * 100;

    // ── Team management ──────────────────────────────────────────
    const addMember = () => setTeam(prev => [...prev, { name: '', role: 'Camarero/a' }]);
    const removeMember = (i: number) => setTeam(prev => prev.filter((_, idx) => idx !== i));
    const updateMember = (i: number, field: 'name' | 'role', value: string) => {
        setTeam(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
    };

    // ── POS connect handlers ─────────────────────────────────────
    const handlePosConnect = (pos: 'square' | 'lightspeed') => {
        setPosChoice(pos);
        toast.success(`${pos === 'square' ? 'Square' : 'Lightspeed'} seleccionado. Lo conectaremos después.`);
    };

    // ── Save team to DB ──────────────────────────────────────────
    const saveTeam = async (orgId?: string) => {
        const locationId = selectedLocationId && selectedLocationId !== 'all' ? selectedLocationId : null;
        const groupId = orgId || profile?.group_id;
        const validMembers = team.filter(m => m.name.trim());
        if (validMembers.length === 0 || !groupId) return;

        setSaving(true);
        try {
            const ROLE_MAP: Record<string, string> = {
                'Camarero/a': 'waiter',
                'Cocinero/a': 'cook',
                'Barista': 'bartender',
                'Gerente': 'manager',
                'Repartidor/a': 'delivery',
                'Lavaplatos': 'dishwasher',
                'Hostess': 'host',
            };

            for (const member of validMembers) {
                await supabase.from('employees').insert({
                    full_name: member.name.trim(),
                    role_name: ROLE_MAP[member.role] || 'employee',
                    location_id: locationId || undefined,
                    org_id: groupId,
                    active: true,
                });
            }
            toast.success(`${validMembers.length} miembros añadidos al equipo`);
        } catch (e) {
            console.error('Save team error:', e);
        } finally {
            setSaving(false);
        }
    };

    // ── Finalize onboarding ──────────────────────────────────────
    const handleFinish = async () => {
        setSaving(true);
        try {
            // Ensure user has a group + location in DB
            // This is critical for demo data to flow correctly
            if (user && (!profile?.group_id)) {
                // Create group
                const { data: newGroup, error: groupErr } = await supabase
                    .from('groups')
                    .insert({ name: 'Mi Restaurante', owner_id: user.id })
                    .select('id')
                    .single();

                if (groupErr) {
                    console.error('Error creating group:', groupErr);
                } else if (newGroup) {
                    // Create default location
                    await supabase
                        .from('locations')
                        .insert({
                            group_id: newGroup.id,
                            org_id: newGroup.id,
                            name: 'Mi Local',
                            city: 'Mi Ciudad',
                            active: true,
                        });

                    // Link user profile to group
                    await supabase
                        .from('profiles')
                        .update({ group_id: newGroup.id })
                        .eq('id', user.id);

                    // Assign owner role
                    const { data: ownerRole } = await supabase
                        .from('roles')
                        .select('id')
                        .eq('name', 'owner')
                        .single();

                    if (ownerRole) {
                        await supabase
                            .from('user_roles')
                            .upsert({ user_id: user.id, role_id: ownerRole.id, location_id: null });
                    }
                }
            }

            // Save team members if any were added
            const teamCount = team.filter(m => m.name.trim()).length;
            if (teamCount > 0) {
                const orgId = profile?.group_id || undefined;
                await saveTeam(orgId);
            }

            // Mark onboarding complete in localStorage + refresh AppContext
            markOnboardingComplete();
            await setOnboardingComplete();

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

            toast.success('¡Bienvenido a Josephine!');
        } catch (err) {
            console.error('Onboarding finish error:', err);
            toast.error('Error al finalizar. Intenta de nuevo.');
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
                <h2 className="text-2xl font-bold">Conecta tu sistema POS</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                    Josephine importa datos de tu POS para generar insights automáticos. Elige tu sistema o sube datos manualmente.
                </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 max-w-lg mx-auto">
                {/* Square */}
                <button
                    onClick={() => handlePosConnect('square')}
                    className={`p-5 rounded-xl border-2 text-left transition-all hover:shadow-md ${posChoice === 'square' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' : 'border-border hover:border-indigo-300'
                        }`}
                >
                    <span className="text-3xl block mb-2">🔷</span>
                    <p className="font-semibold">Square POS</p>
                    <p className="text-xs text-muted-foreground">Conexión directa vía OAuth</p>
                    {posChoice === 'square' && <CheckCircle className="h-5 w-5 text-indigo-500 mt-2" />}
                </button>

                {/* Lightspeed */}
                <button
                    onClick={() => handlePosConnect('lightspeed')}
                    className={`p-5 rounded-xl border-2 text-left transition-all hover:shadow-md ${posChoice === 'lightspeed' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30' : 'border-border hover:border-yellow-300'
                        }`}
                >
                    <span className="text-3xl block mb-2">⚡</span>
                    <p className="font-semibold">Lightspeed</p>
                    <p className="text-xs text-muted-foreground">Conexión directa vía OAuth</p>
                    {posChoice === 'lightspeed' && <CheckCircle className="h-5 w-5 text-yellow-500 mt-2" />}
                </button>

                {/* CSV */}
                <button
                    onClick={() => { setPosChoice('csv'); }}
                    className={`p-5 rounded-xl border-2 text-left transition-all hover:shadow-md ${posChoice === 'csv' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'border-border hover:border-emerald-300'
                        }`}
                >
                    <FileSpreadsheet className="h-8 w-8 text-emerald-500 mb-2" />
                    <p className="font-semibold">Subir CSV</p>
                    <p className="text-xs text-muted-foreground">Importa datos de cualquier POS</p>
                    {posChoice === 'csv' && <CheckCircle className="h-5 w-5 text-emerald-500 mt-2" />}
                </button>

                {/* Skip */}
                <button
                    onClick={() => { setPosChoice('skip'); }}
                    className={`p-5 rounded-xl border-2 text-left transition-all hover:shadow-md ${posChoice === 'skip' ? 'border-slate-400 bg-slate-50 dark:bg-slate-800' : 'border-border hover:border-slate-300'
                        }`}
                >
                    <SkipForward className="h-8 w-8 text-slate-400 mb-2" />
                    <p className="font-semibold">Lo haré después</p>
                    <p className="text-xs text-muted-foreground">Empieza con datos de demo</p>
                    {posChoice === 'skip' && <CheckCircle className="h-5 w-5 text-slate-400 mt-2" />}
                </button>
            </div>
        </div>
    );

    // ── Render: Step 2 — Team ────────────────────────────────────
    const renderStep2 = () => (
        <div className="space-y-6">
            <div className="text-center space-y-2">
                <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 mx-auto flex items-center justify-center">
                    <Users className="h-8 w-8 text-emerald-500" />
                </div>
                <h2 className="text-2xl font-bold">Configura tu equipo</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                    Añade los miembros de tu equipo. Podrán fichar, ver turnos y recibir notificaciones.
                </p>
            </div>

            <div className="max-w-lg mx-auto space-y-3">
                {team.map((member, i) => (
                    <div key={i} className="flex gap-2 items-center">
                        <Input
                            placeholder="Nombre completo"
                            value={member.name}
                            onChange={e => updateMember(i, 'name', e.target.value)}
                            className="flex-1"
                        />
                        <select
                            value={member.role}
                            onChange={e => updateMember(i, 'role', e.target.value)}
                            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        {team.length > 1 && (
                            <Button variant="ghost" size="icon" onClick={() => removeMember(i)}>
                                <Trash2 className="h-4 w-4 text-red-400" />
                            </Button>
                        )}
                    </div>
                ))}

                <Button variant="outline" size="sm" onClick={addMember} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Añadir otro miembro
                </Button>

                <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                    <Sparkles className="h-4 w-4 shrink-0" />
                    <span>Puedes añadir más miembros después desde Workforce → Equipo</span>
                </div>
            </div>
        </div>
    );

    // ── Render: Step 3 — Menu ────────────────────────────────────
    const renderStep3 = () => (
        <div className="space-y-6">
            <div className="text-center space-y-2">
                <div className="h-16 w-16 rounded-2xl bg-amber-500/10 mx-auto flex items-center justify-center">
                    <ChefHat className="h-8 w-8 text-amber-500" />
                </div>
                <h2 className="text-2xl font-bold">Importa tu menú</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                    Tu menú ayuda a Josephine a calcular rentabilidad, food cost y sugerencias de precios.
                </p>
            </div>

            <div className="max-w-md mx-auto space-y-3">
                {posChoice && posChoice !== 'skip' && posChoice !== 'csv' && (
                    <button
                        onClick={() => setMenuChoice('pos')}
                        className={`w-full p-5 rounded-xl border-2 text-left transition-all hover:shadow-md flex items-center gap-4 ${menuChoice === 'pos' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' : 'border-border'
                            }`}
                    >
                        <Zap className="h-8 w-8 text-indigo-500" />
                        <div>
                            <p className="font-semibold">Importar desde {posChoice === 'square' ? 'Square' : 'Lightspeed'}</p>
                            <p className="text-xs text-muted-foreground">Sincroniza automáticamente tu catálogo</p>
                        </div>
                        {menuChoice === 'pos' && <CheckCircle className="h-5 w-5 text-indigo-500 ml-auto" />}
                    </button>
                )}

                <button
                    onClick={() => setMenuChoice('csv')}
                    className={`w-full p-5 rounded-xl border-2 text-left transition-all hover:shadow-md flex items-center gap-4 ${menuChoice === 'csv' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'border-border'
                        }`}
                >
                    <Upload className="h-8 w-8 text-emerald-500" />
                    <div>
                        <p className="font-semibold">Subir archivo CSV</p>
                        <p className="text-xs text-muted-foreground">Usa nuestra plantilla de menú</p>
                    </div>
                    {menuChoice === 'csv' && <CheckCircle className="h-5 w-5 text-emerald-500 ml-auto" />}
                </button>

                <button
                    onClick={() => setMenuChoice('skip')}
                    className={`w-full p-5 rounded-xl border-2 text-left transition-all hover:shadow-md flex items-center gap-4 ${menuChoice === 'skip' ? 'border-slate-400 bg-slate-50 dark:bg-slate-800' : 'border-border'
                        }`}
                >
                    <SkipForward className="h-8 w-8 text-slate-400" />
                    <div>
                        <p className="font-semibold">Añadir después</p>
                        <p className="text-xs text-muted-foreground">Puedes configurar el menú más tarde</p>
                    </div>
                    {menuChoice === 'skip' && <CheckCircle className="h-5 w-5 text-slate-400 ml-auto" />}
                </button>
            </div>
        </div>
    );

    // ── Render: Step 4 — Confirmation ────────────────────────────
    const renderStep4 = () => {
        const teamCount = team.filter(m => m.name.trim()).length;
        return (
            <div className="space-y-6">
                <div className="text-center space-y-2">
                    <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-500 mx-auto flex items-center justify-center">
                        <Rocket className="h-10 w-10 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold">¡Todo listo!</h2>
                    <p className="text-muted-foreground max-w-md mx-auto">
                        Josephine ya está configurada. Tu primera previsión de ventas estará lista en <strong>menos de 24 horas</strong>.
                    </p>
                </div>

                {/* Summary */}
                <div className="max-w-md mx-auto space-y-3">
                    <div className="p-4 rounded-xl bg-muted/50 space-y-2">
                        <div className="flex items-center gap-3">
                            <CheckCircle className="h-5 w-5 text-emerald-500" />
                            <span className="text-sm">
                                <strong>POS:</strong>{' '}
                                {posChoice === 'square' ? 'Square (se conectará al finalizar)' :
                                    posChoice === 'lightspeed' ? 'Lightspeed (se conectará al finalizar)' :
                                        posChoice === 'csv' ? 'Importación CSV' : 'Se configurará después'}
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <CheckCircle className="h-5 w-5 text-emerald-500" />
                            <span className="text-sm">
                                <strong>Equipo:</strong> {teamCount > 0 ? `${teamCount} miembro${teamCount > 1 ? 's' : ''}` : 'Se añadirá después'}
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <CheckCircle className="h-5 w-5 text-emerald-500" />
                            <span className="text-sm">
                                <strong>Menú:</strong>{' '}
                                {menuChoice === 'pos' ? `Se importará desde ${posChoice === 'square' ? 'Square' : 'Lightspeed'}` :
                                    menuChoice === 'csv' ? 'Se importará por CSV' : 'Se configurará después'}
                            </span>
                        </div>
                    </div>

                    <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800">
                        <div className="flex items-start gap-3">
                            <Sparkles className="h-5 w-5 text-indigo-500 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-medium text-indigo-700 dark:text-indigo-300">Tu primera previsión en 24h</p>
                                <p className="text-indigo-600 dark:text-indigo-400 mt-1">
                                    Josephine analizará tus datos y generará tu primer forecast de ventas, labor y demanda.
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
                            {saving ? 'Guardando...' : 'Empezar a usar Josephine'}
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
                            Empezar con tour guiado
                        </Button>
                    </div>
                </div>
            </div>
        );
    };

    // ── Can proceed ──────────────────────────────────────────────
    const canNext = () => {
        switch (step) {
            case 1: return posChoice !== null;
            case 2: return true; // Team is optional
            case 3: return menuChoice !== null;
            default: return true;
        }
    };

    // ── Render ───────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950 flex flex-col z-50">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <span className="text-white font-bold text-sm">J</span>
                    </div>
                    <span className="font-display font-bold text-lg">Josephine</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                        Paso {step} de 4
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
                    {step === 3 && renderStep3()}
                    {step === 4 && renderStep4()}
                </div>
            </div>

            {/* Footer */}
            {step < 4 && (
                <div className="flex items-center justify-between px-6 py-4 border-t bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                    <Button
                        variant="ghost"
                        onClick={prevStep}
                        disabled={step === 1}
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Atrás
                    </Button>
                    <Button
                        onClick={() => {
                            if (step === 2 && team.filter(m => m.name.trim()).length > 0) {
                                saveTeam();
                            }
                            nextStep();
                        }}
                        disabled={!canNext()}
                    >
                        Siguiente
                        <ChevronRight className="h-4 w-4 ml-1" />
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
                back: 'Atrás',
                close: 'Cerrar',
                last: '¡Listo!',
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
