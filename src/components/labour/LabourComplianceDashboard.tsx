/**
 * LabourComplianceDashboard — Employee compliance scorecard
 *
 * Calls check_labour_compliance RPC to show per-employee
 * compliance status: overtime, rest violations, weekly rest,
 * and overall risk score. All thresholds from labour_rules
 * table — nothing hardcoded.
 */

import { useQuery } from '@tanstack/react-query';
import { format, startOfWeek } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface LabourComplianceDashboardProps {
    locationId: string | null;
    weekStart?: Date;
}

interface ComplianceEmployee {
    employee_id: string;
    employee_name: string;
    role: string | null;
    total_hours: number;
    shift_count: number;
    days_worked: number;
    days_off: number;
    overtime_status: 'ok' | 'warning' | 'breach';
    hours_until_overtime: number;
    overtime_excess: number;
    min_rest_ok: boolean;
    min_rest_hours: number;
    weekly_rest_ok: boolean;
    risk_score: number;
}

interface ComplianceResult {
    week_start: string;
    week_end: string;
    location_id: string;
    thresholds: {
        max_weekly_hours: number;
        min_rest_hours: number;
        min_weekly_rest_days: number;
        overtime_warning_hours: number;
        target_splh: number;
    };
    employees: ComplianceEmployee[];
    summary: {
        total_employees: number;
        overtime_warnings: number;
        overtime_breaches: number;
        rest_violations: number;
        weekly_rest_violations: number;
        avg_risk_score: number;
    };
}

function RiskBadge({ score }: { score: number }) {
    const level = score >= 40 ? 'critical' : score >= 20 ? 'warning' : 'ok';
    const config = {
        ok: { text: 'Bajo', bg: 'bg-emerald-100', color: 'text-emerald-700', icon: '✓' },
        warning: { text: 'Medio', bg: 'bg-amber-100', color: 'text-amber-700', icon: '⚠' },
        critical: { text: 'Alto', bg: 'bg-red-100', color: 'text-red-700', icon: '✗' },
    }[level];

    return (
        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase", config.bg, config.color)}>
            {config.icon} {config.text} ({score})
        </span>
    );
}

function StatusDot({ ok, label }: { ok: boolean; label: string }) {
    return (
        <div className="flex items-center gap-1.5">
            <div className={cn("w-2 h-2 rounded-full", ok ? 'bg-emerald-500' : 'bg-red-500')} />
            <span className="text-xs text-gray-600">{label}</span>
        </div>
    );
}

export function LabourComplianceDashboard({ locationId, weekStart }: LabourComplianceDashboardProps) {
  const { t } = useTranslation();
    const { profile } = useAuth();
    const orgId = profile?.group_id;
    const ws = weekStart || startOfWeek(new Date(), { weekStartsOn: 1 });

    const { data, isLoading, isError } = useQuery({
        queryKey: ['labour-compliance', orgId, locationId, format(ws, 'yyyy-MM-dd')],
        queryFn: async (): Promise<ComplianceResult | null> => {
            if (!orgId) return null;
            const { data, error } = await supabase.rpc('check_labour_compliance' as any, {
                p_org_id: orgId,
                p_location_id: locationId,
                p_week_start: format(ws, 'yyyy-MM-dd'),
            });
            if (error) { console.error('Compliance RPC error:', error); return null; }
            return data as ComplianceResult;
        },
        enabled: !!orgId && !!locationId,
        staleTime: 60000,
    });

    if (isLoading) {
        return (
            <Card className="bg-white">
                <CardHeader><CardTitle className="text-base">Cumplimiento Laboral</CardTitle></CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (isError || !data || data.employees.length === 0) {
        return (
            <Card className="bg-white">
                <CardHeader><CardTitle className="text-base">Cumplimiento Laboral</CardTitle></CardHeader>
                <CardContent>
                    <p className="text-sm text-gray-500 text-center py-4">
                        {!locationId ? 'Selecciona una ubicación para ver compliance' : 'No hay turnos programados esta semana'}
                    </p>
                </CardContent>
            </Card>
        );
    }

    const { employees, summary, thresholds } = data;

    return (
        <Card className="bg-white">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base font-semibold">Cumplimiento Laboral</CardTitle>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Semana {format(ws, 'dd MMM')} — Límites configurables
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {summary.overtime_breaches > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                                {summary.overtime_breaches} OVERTIME
                            </span>
                        )}
                        {summary.overtime_warnings > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                {summary.overtime_warnings} AVISO
                            </span>
                        )}
                        {summary.rest_violations > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                                {summary.rest_violations} DESCANSO
                            </span>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {/* Thresholds info */}
                <div className="flex items-center gap-4 mb-4 pb-3 border-b border-gray-100 text-[10px] text-gray-400">
                    <span>Máx: {thresholds.max_weekly_hours}h/sem</span>
                    <span>Descanso: {thresholds.min_rest_hours}h entre turnos</span>
                    <span>Libre: {thresholds.min_weekly_rest_days} días/sem</span>
                    <span>Aviso: {thresholds.overtime_warning_hours}h</span>
                </div>

                {/* Employee rows */}
                <div className="space-y-2">
                    {employees.map(emp => (
                        <div key={emp.employee_id} className={cn(
                            "flex items-center justify-between p-3 rounded-lg border transition-colors",
                            emp.risk_score >= 40 ? "border-red-200 bg-red-50/50" :
                                emp.risk_score >= 20 ? "border-amber-200 bg-amber-50/50" :
                                    "border-gray-100 bg-gray-50/30"
                        )}>
                            <div className="flex items-center gap-3 min-w-[180px]">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                                    {emp.employee_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-gray-900">{emp.employee_name}</div>
                                    <div className="text-[10px] text-gray-500">{emp.role || 'Equipo'}</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className={cn(
                                    "text-sm font-semibold",
                                    emp.overtime_status === 'breach' ? 'text-red-600' :
                                        emp.overtime_status === 'warning' ? 'text-amber-600' :
                                            'text-gray-700'
                                )}>
                                    {emp.total_hours.toFixed(1)}h
                                </span>
                                <span className="text-xs text-gray-400">/ {thresholds.max_weekly_hours}h</span>
                            </div>

                            <div className="flex items-center gap-3">
                                <StatusDot ok={emp.overtime_status === 'ok'} label="Horas" />
                                <StatusDot ok={emp.min_rest_ok} label="Descanso" />
                                <StatusDot ok={emp.weekly_rest_ok} label="Libre" />
                            </div>

                            <RiskBadge score={emp.risk_score} />
                        </div>
                    ))}
                </div>

                {/* Summary */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
                    <span>{summary.total_employees} empleados • Riesgo medio: {summary.avg_risk_score}</span>
                    <span className="text-[10px] text-gray-400">Umbrales configurables en Ajustes → Reglas Laborales</span>
                </div>
            </CardContent>
        </Card>
    );
}
