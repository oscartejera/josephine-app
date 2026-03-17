/**
 * EmployeeRevenueTable — Per-employee revenue scores
 *
 * Calls get_employee_revenue_scores RPC to show each employee's
 * estimated revenue contribution, SPLH, cost, and ROI.
 * Useful for identifying top performers and coaching opportunities.
 */

import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface EmployeeRevenueTableProps {
    locationId?: string | null;
    dateFrom?: Date;
    dateTo?: Date;
}

interface EmployeeScore {
    employee_id: string;
    employee_name: string;
    role: string | null;
    hourly_cost: number;
    total_hours: number;
    shift_count: number;
    revenue_share: number;
    splh: number;
    total_cost: number;
    roi: number;
    trend: string;
}

interface RevenueResult {
    total_sales: number;
    employees: EmployeeScore[];
    summary: {
        employee_count: number;
        avg_splh: number;
        avg_roi: number;
        top_performer: string;
    };
}

function formatCurrency(v: number) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

function RoiBadge({ roi }: { roi: number }) {
    const level = roi >= 5 ? 'excellent' : roi >= 3 ? 'good' : roi >= 1 ? 'fair' : 'low';
    const config = {
        excellent: { text: 'Excelente', bg: 'bg-emerald-100', color: 'text-emerald-700' },
        good: { text: 'Bueno', bg: 'bg-blue-100', color: 'text-blue-700' },
        fair: { text: 'Normal', bg: 'bg-gray-100', color: 'text-gray-600' },
        low: { text: 'Bajo', bg: 'bg-amber-100', color: 'text-amber-700' },
    }[level];

    return (
        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase", config.bg, config.color)}>
            {roi.toFixed(1)}x {config.text}
        </span>
    );
}

export function EmployeeRevenueTable({ locationId, dateFrom, dateTo }: EmployeeRevenueTableProps) {
  const { t } = useTranslation();
    const { profile } = useAuth();
    const { accessibleLocations } = useApp();
    const orgId = profile?.group_id;
    const from = dateFrom || startOfMonth(new Date());
    const to = dateTo || endOfMonth(new Date());

    // Use first location if none specified
    const effectiveLocationId = locationId || (accessibleLocations.length > 0 ? accessibleLocations[0].id : null);

    const { data, isLoading } = useQuery({
        queryKey: ['employee-revenue', orgId, effectiveLocationId, format(from, 'yyyy-MM-dd'), format(to, 'yyyy-MM-dd')],
        queryFn: async (): Promise<RevenueResult | null> => {
            if (!orgId || !effectiveLocationId) return null;
            const { data, error } = await supabase.rpc('get_employee_revenue_scores' as any, {
                p_org_id: orgId,
                p_location_id: effectiveLocationId,
                p_date_from: format(from, 'yyyy-MM-dd'),
                p_date_to: format(to, 'yyyy-MM-dd'),
            });
            if (error) { console.error('Revenue scores error:', error); return null; }
            return data as RevenueResult;
        },
        enabled: !!orgId && !!effectiveLocationId,
        staleTime: 60000,
    });

    if (isLoading) {
        return (
            <Card className="bg-white">
                <CardHeader><CardTitle className="text-base">{t('labour.revenuePorEmpleado')}</CardTitle></CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!data || data.employees.length === 0) {
        return (
            <Card className="bg-white">
                <CardHeader><CardTitle className="text-base">{t('labour.revenuePorEmpleado')}</CardTitle></CardHeader>
                <CardContent>
                    <p className="text-sm text-gray-500 text-center py-4">
                        {t('labour.EmployeeRevenueTable.noHayDatosDeTurnos')}
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
                        <CardTitle className="text-base font-semibold">{t('labour.revenuePorEmpleado')}</CardTitle>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Ventas totales: {formatCurrency(data.total_sales)} • Top: {data.summary.top_performer}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                            SPLH med: €{data.summary.avg_splh}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            ROI med: {data.summary.avg_roi}x
                        </span>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {/* Table header */}
                <div className="grid grid-cols-8 gap-2 mb-2 pb-2 border-b border-gray-100 text-[10px] font-semibold text-gray-500 uppercase">
                    <span className="col-span-2">{t('payroll.empleado')}</span>
                    <span className="text-right">{t('labour.EmployeeRevenueTable.horas')}</span>
                    <span className="text-right">{t('labour.EmployeeRevenueTable.revenue')}</span>
                    <span className="text-right">{t('labour.EmployeeRevenueTable.splh')}</span>
                    <span className="text-right">{t('labour.EmployeeRevenueTable.coste')}</span>
                    <span className="text-right">ROI</span>
                    <span className="text-center">{t('labour.EmployeeRevenueTable.nivel')}</span>
                </div>

                {/* Employee rows */}
                <div className="space-y-1">
                    {data.employees.map((emp, idx) => (
                        <div key={emp.employee_id} className={cn(
                            "grid grid-cols-8 gap-2 items-center py-2.5 px-2 rounded-lg text-sm",
                            idx === 0 ? 'bg-amber-50/50 border border-amber-200' :
                                idx < 3 ? 'bg-emerald-50/30' : 'bg-gray-50/30'
                        )}>
                            <div className="col-span-2 flex items-center gap-2">
                                <div className={cn(
                                    "w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold",
                                    idx === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-600' :
                                        idx < 3 ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' :
                                            'bg-gradient-to-br from-gray-400 to-gray-500'
                                )}>
                                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-gray-900 truncate">{emp.employee_name}</div>
                                    <div className="text-[10px] text-gray-500">{emp.role || 'Equipo'}</div>
                                </div>
                            </div>
                            <span className="text-right text-gray-600">{emp.total_hours.toFixed(1)}h</span>
                            <span className="text-right font-medium text-gray-800">{formatCurrency(emp.revenue_share)}</span>
                            <span className={cn("text-right font-semibold",
                                emp.splh >= data.summary.avg_splh ? 'text-emerald-600' : 'text-amber-600'
                            )}>€{emp.splh}</span>
                            <span className="text-right text-gray-500">{formatCurrency(emp.total_cost)}</span>
                            <span className="text-right font-semibold text-gray-700">{emp.roi.toFixed(1)}x</span>
                            <div className="text-center">
                                <RoiBadge roi={emp.roi} />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                    {t('labour.EmployeeRevenueTable.revenueAtribuidoProporcionalmenteAHoras')}
                </div>
            </CardContent>
        </Card>
    );
}
