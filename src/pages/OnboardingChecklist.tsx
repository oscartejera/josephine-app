/**
 * OnboardingChecklist — in-app guide for restaurant owners
 * Shows progress through setup steps when activating Josephine.
 * Checks real data presence in Supabase to auto-detect completion.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    CheckCircle2,
    Circle,
    ArrowRight,
    Wifi,
    Users,
    Calendar,
    Package,
    ChefHat,
    DollarSign,
    BarChart3,
    Star,
    Loader2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ChecklistStep {
    id: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    link: string;
    category: 'connection' | 'team' | 'inventory' | 'intelligence';
    isComplete: boolean;
    isLoading: boolean;
}

export default function OnboardingChecklist() {
  const { t } = useTranslation();
    const navigate = useNavigate();
    const { dataSource, locations, group } = useApp();
    const [steps, setSteps] = useState<ChecklistStep[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function checkProgress() {
            setLoading(true);

            const orgId = group?.id;

            // Run all checks in parallel
            const [
                employeesRes,
                shiftsRes,
                suppliersRes,
                recipesRes,
                inventoryRes,
                budgetsRes,
            ] = await Promise.all([
                supabase.from('employees').select('id', { count: 'exact', head: true }).eq('active', true),
                supabase.from('shifts').select('id', { count: 'exact', head: true }),
                supabase.from('suppliers').select('id', { count: 'exact', head: true }),
                supabase.from('recipes').select('id', { count: 'exact', head: true }),
                (supabase as any).from('inventory_items').select('id', { count: 'exact', head: true }),
                (supabase as any).from('budgets_daily').select('id', { count: 'exact', head: true }),
            ]);

            const hasEmployees = (employeesRes.count ?? 0) > 0;
            const hasShifts = (shiftsRes.count ?? 0) > 0;
            const hasSuppliers = (suppliersRes.count ?? 0) > 0;
            const hasRecipes = (recipesRes.count ?? 0) > 0;
            const hasInventory = (inventoryRes.count ?? 0) > 0;
            const hasBudgets = (budgetsRes.count ?? 0) > 0;
            const posConnected = dataSource === 'pos';

            setSteps([
                {
                    id: 'pos',
                    title: t('onboardingChecklist.connectPOS'),
                    description: posConnected
                        ? t('onboarding.posConectadoLosDatosDe')
                        : 'Conecta Square o Lightspeed para que las ventas, pagos y productos se sincronicen',
                    icon: <Wifi className="h-5 w-5" />,
                    link: '/settings',
                    category: 'connection',
                    isComplete: posConnected,
                    isLoading: false,
                },
                {
                    id: 'employees',
                    title: t('onboardingChecklist.createTeam'),
                    description: hasEmployees
                        ? `✓ ${employeesRes.count} empleados activos`
                        : t('onboarding.anadeEmpleadosConNombreRol'),
                    icon: <Users className="h-5 w-5" />,
                    link: '/workforce',
                    category: 'team',
                    isComplete: hasEmployees,
                    isLoading: false,
                },
                {
                    id: 'schedule',
                    title: t('onboardingChecklist.createSchedule'),
                    description: hasShifts
                        ? `✓ ${shiftsRes.count} turnos creados`
                        : t('onboarding.creaTurnosParaTuEquipo'),
                    icon: <Calendar className="h-5 w-5" />,
                    link: '/scheduling',
                    category: 'team',
                    isComplete: hasShifts,
                    isLoading: false,
                },
                {
                    id: 'suppliers',
                    title: t('onboardingChecklist.configureSuppliers'),
                    description: hasSuppliers
                        ? `✓ ${suppliersRes.count} proveedores registrados`
                        : t('onboarding.addSuppliersForProcurement'),
                    icon: <Package className="h-5 w-5" />,
                    link: '/procurement',
                    category: 'inventory',
                    isComplete: hasSuppliers,
                    isLoading: false,
                },
                {
                    id: 'recipes',
                    title: t('onboardingChecklist.createRecipes'),
                    description: hasRecipes
                        ? `✓ ${recipesRes.count} recetas configuradas`
                        : t('onboarding.creaRecetasConIngredientesY'),
                    icon: <ChefHat className="h-5 w-5" />,
                    link: '/inventory-setup/recipes',
                    category: 'inventory',
                    isComplete: hasRecipes,
                    isLoading: false,
                },
                {
                    id: 'inventory',
                    title: t('onboardingChecklist.createInventory'),
                    description: hasInventory
                        ? t('onboarding.itemsInCatalog', { count: inventoryRes.count })
                        : t('onboarding.anadeLosProductosQueGestionas'),
                    icon: <Package className="h-5 w-5" />,
                    link: '/inventory-setup/items',
                    category: 'inventory',
                    isComplete: hasInventory,
                    isLoading: false,
                },
                {
                    id: 'budgets',
                    title: t('onboardingChecklist.setBudgets'),
                    description: hasBudgets
                        ? `✓ Presupuestos configurados`
                        : 'Define metas de venta diarias/mensuales para activar Budget vs Actual',
                    icon: <DollarSign className="h-5 w-5" />,
                    link: '/budgets',
                    category: 'intelligence',
                    isComplete: hasBudgets,
                    isLoading: false,
                },
            ]);

            setLoading(false);
        }

        checkProgress();
    }, [dataSource, group?.id]);

    const completedCount = steps.filter(s => s.isComplete).length;
    const totalCount = steps.length;
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    const categories = [
        { id: 'connection', label: t('onboarding.conexion'), color: 'text-blue-600' },
        { id: 'team', label: '👥 Equipo', color: 'text-violet-600' },
        { id: 'inventory', label: t('onboarding.inventario2'), color: 'text-emerald-600' },
        { id: 'intelligence', label: '📊 Inteligencia', color: 'text-amber-600' },
    ];

    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">{t("onboarding.configTitle")}</h1>
                <p className="text-muted-foreground mt-1">
                    {t('onboardingChecklist.sigueEstosPasosParaActivar')}
                </p>
            </div>

            {/* Progress bar */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{t("onboarding.configProgress")}</span>
                        <Badge variant={progressPercent === 100 ? 'default' : 'secondary'}>
                            {completedCount}/{totalCount} completados
                        </Badge>
                    </div>
                    <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                    {progressPercent === 100 && (
                        <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-2 font-medium">
                            {t('onboardingChecklist.todoConfiguradoJosephineEstaLista')}
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Steps by category */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">{t("onboarding.verifyingConfig")}</span>
                </div>
            ) : (
                categories.map(cat => {
                    const categorySteps = steps.filter(s => s.category === cat.id);
                    if (categorySteps.length === 0) return null;

                    return (
                        <div key={cat.id} className="space-y-3">
                            <h2 className={`text-sm font-semibold uppercase tracking-wider ${cat.color}`}>
                                {cat.label}
                            </h2>
                            {categorySteps.map(step => (
                                <Card
                                    key={step.id}
                                    className={`cursor-pointer transition-all hover:shadow-md ${step.isComplete
                                            ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20'
                                            : 'hover:border-primary/30'
                                        }`}
                                    onClick={() => navigate(step.link)}
                                >
                                    <CardContent className="flex items-center gap-4 py-4">
                                        {/* Status icon */}
                                        <div className={`shrink-0 ${step.isComplete ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                                            {step.isComplete ? (
                                                <CheckCircle2 className="h-6 w-6" />
                                            ) : (
                                                <Circle className="h-6 w-6" />
                                            )}
                                        </div>

                                        {/* Icon */}
                                        <div className={`shrink-0 p-2 rounded-lg ${step.isComplete
                                                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600'
                                                : 'bg-muted text-muted-foreground'
                                            }`}>
                                            {step.icon}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-medium ${step.isComplete ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>
                                                {step.title}
                                            </p>
                                            <p className="text-sm text-muted-foreground truncate">
                                                {step.description}
                                            </p>
                                        </div>

                                        {/* Arrow */}
                                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    );
                })
            )}

            {/* What happens automatically */}
            <Card className="border-blue-200 dark:border-blue-800">
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-blue-500" />
                        {t('onboardingChecklist.seActivanAutomaticamenteAlConectar')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        {[
                            'Sales Analytics',
                            'Dashboard KPIs',
                            'P&L en tiempo real',
                            'Cash Management',
                            'Morning Briefing AI',
                            'Top Products',
                        ].map(feature => (
                            <div key={feature} className="flex items-center gap-2 text-muted-foreground">
                                <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                {feature}
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Future integrations */}
            <Card className="border-amber-200 dark:border-amber-800">
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Star className="h-5 w-5 text-amber-500" />
                        {t('onboardingChecklist.proximamente')}
                    </CardTitle>
                    <CardDescription>{t("onboarding.pendingIntegrations")}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                        {[
                            'Google Business Reviews',
                            'TripAdvisor Reviews',
                            'TheFork Reviews',
                            'Notificaciones Push',
                        ].map(feature => (
                            <div key={feature} className="flex items-center gap-2">
                                <Circle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                                {feature}
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
