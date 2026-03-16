/**
 * StaffingRecommendation — AI-driven staffing suggestions
 *
 * Uses get_staffing_recommendation RPC to show forecast-based
 * headcount per day vs actual schedule. Highlights over/under-staffed days.
 * All targets from labour_rules table.
 */

import { useQuery } from '@tanstack/react-query';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface StaffingRecommendationProps {
    locationId: string | null;
    dateFrom?: Date;
    dateTo?: Date;
}

interface DayRec {
    date: string;
    forecast_sales: number;
    recommended_hours: number;
    recommended_headcount: number;
    scheduled_hours: number;
    scheduled_headcount: number;
    delta_hours: number;
    status: 'overstaffed' | 'understaffed' | 'optimal' | 'no_schedule';
}

interface StaffingResult {
    target_splh: number;
    avg_shift_hours: number;
    location_id: string;
    days: DayRec[];
    summary: {
        total_days: number;
        overstaffed_days: number;
        understaffed_days: number;
        optimal_days: number;
        no_schedule_days: number;
    };
}

const STATUS_CONFIG = {
    overstaffed: { text: 'Exceso', bg: 'bg-amber-100', color: 'text-amber-700', icon: '⬆' },
    understaffed: { text: 'Falta', bg: 'bg-red-100', color: 'text-red-700', icon: '⬇' },
    optimal: { text: 'Óptimo', bg: 'bg-emerald-100', color: 'text-emerald-700', icon: '✓' },
    no_schedule: { text: 'Sin horario', bg: 'bg-gray-100', color: 'text-gray-500', icon: '—' },
};

function formatCurrency(v: number) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

export function StaffingRecommendation({
  const { t } = useTranslation(); locationId, dateFrom, dateTo }: StaffingRecommendationProps) {
    const { profile } = useAuth();
    const orgId = profile?.group_id;
    const from = dateFrom || new Date();
    const to = dateTo || addDays(new Date(), 6);

    const { data, isLoading } = useQuery({
        queryKey: ['staffing-rec', orgId, locationId, format(from, 'yyyy-MM-dd'), format(to, 'yyyy-MM-dd')],
        queryFn: async (): Promise<StaffingResult | null> => {
            if (!orgId || !locationId) return null;
            const { data, error } = await supabase.rpc('get_staffing_recommendation' as any, {
                p_org_id: orgId,
                p_location_id: locationId,
                p_date_from: format(from, 'yyyy-MM-dd'),
                p_date_to: format(to, 'yyyy-MM-dd'),
            });
            if (error) { console.error('Staffing RPC error:', error); return null; }
            return data as StaffingResult;
        },
        enabled: !!orgId && !!locationId,
        staleTime: 60000,
    });

    if (isLoading) {
        return (
            <Card className="bg-white">
                <CardHeader><CardTitle className="text-base">Recomendación de Personal</CardTitle></CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!data || data.days.length === 0) {
        return (
            <Card className="bg-white">
                <CardHeader><CardTitle className="text-base">Recomendación de Personal</CardTitle></CardHeader>
                <CardContent>
                    <p className="text-sm text-gray-500 text-center py-4">
                        {!locationId ? 'Selecciona una ubicación' : 'No hay previsión de ventas disponible'}
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-white">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base font-semibold">📊 Recomendación de Personal</CardTitle>
                        <p className="text-xs text-gray-500 mt-0.5">
                            SPLH objetivo: €{data.target_splh} • Turno medio: {data.avg_shift_hours}h
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {data.summary.understaffed_days > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                                {data.summary.understaffed_days} días con falta
                            </span>
                        )}
                        {data.summary.overstaffed_days > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                {data.summary.overstaffed_days} días con exceso
                            </span>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {/* Table header */}
                <div className="grid grid-cols-7 gap-2 mb-2 text-[10px] font-semibold text-gray-500 uppercase">
                    <span>Día</span>
                    <span className="text-right">Previsión</span>
                    <span className="text-right">Horas rec.</span>
                    <span className="text-right">Personal rec.</span>
                    <span className="text-right">Horas prog.</span>
                    <span className="text-right">Delta</span>
                    <span className="text-center">Estado</span>
                </div>

                {/* Day rows */}
                <div className="space-y-1">
                    {data.days.map(day => {
                        const cfg = STATUS_CONFIG[day.status];
                        const dayDate = new Date(day.date + 'T00:00:00');
                        return (
                            <div key={day.date} className={cn(
                                "grid grid-cols-7 gap-2 items-center py-2 px-2 rounded-lg text-sm",
                                day.status === 'understaffed' ? 'bg-red-50/50' :
                                    day.status === 'overstaffed' ? 'bg-amber-50/50' :
                                        'bg-gray-50/30'
                            )}>
                                <span className="font-medium text-gray-700">
                                    {format(dayDate, 'EEE d', { locale: es })}
                                </span>
                                <span className="text-right text-gray-600">{formatCurrency(day.forecast_sales)}</span>
                                <span className="text-right text-gray-600">{day.recommended_hours}h</span>
                                <span className="text-right text-gray-600">{day.recommended_headcount} pers</span>
                                <span className={cn("text-right font-medium", day.scheduled_hours === 0 ? 'text-gray-400' : 'text-gray-700')}>
                                    {day.scheduled_hours > 0 ? `${day.scheduled_hours}h` : '—'}
                                </span>
                                <span className={cn("text-right font-medium",
                                    day.delta_hours > 0 ? 'text-amber-600' : day.delta_hours < 0 ? 'text-red-600' : 'text-emerald-600'
                                )}>
                                    {day.delta_hours > 0 ? '+' : ''}{day.delta_hours.toFixed(1)}h
                                </span>
                                <span className={cn("text-center text-[10px] font-bold px-1.5 py-0.5 rounded-full", cfg.bg, cfg.color)}>
                                    {cfg.icon} {cfg.text}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                    <span>Basado en previsión de ventas × SPLH objetivo</span>
                    <span>Objetivos configurables en Ajustes → Reglas Laborales</span>
                </div>
            </CardContent>
        </Card>
    );
}
