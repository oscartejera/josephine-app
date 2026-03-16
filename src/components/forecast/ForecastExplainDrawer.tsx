/**
 * ForecastExplainDrawer — "¿Por qué este número?"
 *
 * Shows a breakdown of why the forecast predicts a specific value.
 * Reads the explanation/components data from forecast_daily_metrics.
 * Can be triggered by clicking on any forecast value.
 */

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Brain, Cloud, Calendar, TrendingUp, Sparkles } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

interface ForecastExplainDrawerProps {
    open: boolean;
    onClose: () => void;
    locationId: string;
    date: string; // yyyy-MM-dd
}

interface ForecastDetail {
    forecast_sales: number;
    forecast_orders: number;
    model_version: string;
    confidence_lower: number;
    confidence_upper: number;
    trend: number;
    weekly: number;
    yearly: number;
    regressor_total: number;
    explanation: string;
    weather_temp: number | null;
    is_holiday: boolean;
    holiday_name: string | null;
}

function ExplainFactor({
    icon: Icon,
    label,
    impact,
    detail,
    color,
}: {
    icon: typeof Brain;
    label: string;
    impact: string;
    detail: string;
    color: string;
}) {
    return (
        <div className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
            <div className={`flex items-center justify-center h-8 w-8 rounded-lg shrink-0 ${color}`}>
                <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{label}</p>
                    <span className="text-sm font-semibold">{impact}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
            </div>
        </div>
    );
}

export function ForecastExplainDrawer({ open, onClose, locationId, date }: ForecastExplainDrawerProps) {
  const { t } = useTranslation();
    const { data: detail, isLoading } = useQuery({
        queryKey: ['forecast-explain', locationId, date],
        enabled: open && !!locationId && !!date,
        queryFn: async (): Promise<ForecastDetail | null> => {
            const { data } = await supabase
                .from('forecast_daily_metrics')
                .select('*')
                .eq('location_id', locationId)
                .eq('date', date)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            return data as unknown as ForecastDetail | null;
        },
    });

    const formattedDate = date ? format(parseISO(date), "EEEE d 'de' MMMM", { locale: es }) : '';

    return (
        <Sheet open={open} onOpenChange={() => onClose()}>
            <SheetContent side="right" className="w-[400px] sm:w-[440px]">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2 text-base">
                        <Brain className="h-5 w-5 text-violet-500" />
                        ¿Por qué este forecast?
                    </SheetTitle>
                    <p className="text-sm text-muted-foreground capitalize">{formattedDate}</p>
                </SheetHeader>

                <div className="mt-6 space-y-4">
                    {isLoading && (
                        <div className="animate-pulse space-y-3">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="h-14 bg-muted rounded-lg" />
                            ))}
                        </div>
                    )}

                    {!isLoading && !detail && (
                        <p className="text-sm text-muted-foreground py-8 text-center">
                            No hay datos de forecast para esta fecha
                        </p>
                    )}

                    {detail && (
                        <>
                            {/* Summary */}
                            <div className="bg-violet-50 rounded-lg p-4">
                                <p className="text-sm font-medium text-violet-900">
                                    Previsión: €{detail.forecast_sales?.toLocaleString('es-ES', { maximumFractionDigits: 0 }) ?? '—'}
                                </p>
                                <p className="text-xs text-violet-700 mt-1">
                                    Rango: €{detail.confidence_lower?.toLocaleString('es-ES', { maximumFractionDigits: 0 }) ?? '?'} — €{detail.confidence_upper?.toLocaleString('es-ES', { maximumFractionDigits: 0 }) ?? '?'}
                                </p>
                                <p className="text-[10px] text-violet-600 mt-1">
                                    Modelo: {detail.model_version || 'Prophet v6 + XGBoost'}
                                </p>
                            </div>

                            {/* Decomposition factors */}
                            <div className="space-y-0">
                                <ExplainFactor
                                    icon={TrendingUp}
                                    label="Tendencia Base"
                                    impact={`€${Math.round(detail.trend || 0).toLocaleString('es-ES')}`}
                                    detail={t("bi.longTermGrowthTrend")}
                                    color="bg-blue-50 text-blue-600"
                                />
                                <ExplainFactor
                                    icon={Calendar}
                                    label="Patrón Semanal"
                                    impact={detail.weekly ? `${detail.weekly > 0 ? '+' : ''}${(detail.weekly * 100).toFixed(0)}%` : '—'}
                                    detail={`Efecto del día de la semana (${format(parseISO(date), 'EEEE', { locale: es })})`}
                                    color="bg-indigo-50 text-indigo-600"
                                />
                                <ExplainFactor
                                    icon={Sparkles}
                                    label="Patrón Anual"
                                    impact={detail.yearly ? `${detail.yearly > 0 ? '+' : ''}${(detail.yearly * 100).toFixed(0)}%` : '—'}
                                    detail="Efecto estacional (temporada alta/baja)"
                                    color="bg-purple-50 text-purple-600"
                                />
                                {detail.weather_temp !== null && (
                                    <ExplainFactor
                                        icon={Cloud}
                                        label="Clima"
                                        impact={`${Math.round(detail.weather_temp)}°C`}
                                        detail="Temperatura prevista (afecta demanda de terraza)"
                                        color="bg-cyan-50 text-cyan-600"
                                    />
                                )}
                                {detail.is_holiday && (
                                    <ExplainFactor
                                        icon={Calendar}
                                        label="Festivo"
                                        impact={detail.holiday_name || 'Festivo'}
                                        detail="Los festivos modifican el patrón de demanda"
                                        color="bg-rose-50 text-rose-600"
                                    />
                                )}
                                <ExplainFactor
                                    icon={Brain}
                                    label="Regresores Externos"
                                    impact={detail.regressor_total ? `${detail.regressor_total > 0 ? '+' : ''}${(detail.regressor_total * 100).toFixed(1)}%` : '0%'}
                                    detail="Impacto combinado de clima, eventos, festivos"
                                    color="bg-violet-50 text-violet-600"
                                />
                            </div>

                            {/* Natural language explanation */}
                            {detail.explanation && (
                                <div className="bg-muted/50 rounded-lg p-3 mt-2">
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Explicación AI</p>
                                    <p className="text-sm leading-relaxed">{detail.explanation}</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
