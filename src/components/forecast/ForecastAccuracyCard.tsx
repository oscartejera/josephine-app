/**
 * ForecastAccuracyCard — Shows forecast accuracy KPIs.
 *
 * Reads from v_forecast_accuracy via useForecastAccuracy hook.
 * Displays MAPE, bias, hit rates with color-coded badges.
 * Designed to be dropped into the Sales page.
 */

import { Card } from '@/components/ui/card';
import { useForecastAccuracy, type ForecastAccuracyRow } from '@/hooks/useForecastAccuracy';
import { Target, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

// ── Helper: rating badge ─────────────────────────────────────

function AccuracyBadge({ mape }: { mape: number | null }) {
    if (mape === null) return <span className="text-xs text-muted-foreground">{t("common.noData")}</span>{t('forecast.ForecastAccuracyCard.constIsexcellentMape')} <= 5;
    const isGood = mape <= 10;
    const label = isExcellent ? 'Excelente' : isGood ? 'Bueno' : mape <= 20 ? 'Aceptable' : 'Mejorar';
    const color = isExcellent
        ? 'bg-emerald-100 text-emerald-700'
        : isGood
            ? 'bg-green-100 text-green-700'
            : mape <= 20
                ? 'bg-amber-100 text-amber-700'
                : 'bg-red-100 text-red-700';
    return (
        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', color)}>
            {label}
        </span>
    );
}

// ── KPI mini card ────────────────────────────────────────────

function KpiMini({
    icon: Icon,
    label,
    value,
    suffix = '',
    good,
}: {
    icon: typeof Target;
    label: string;
    value: string | number | null;
    suffix?: string;
    good?: boolean;
}) {
    return (
        <div className="flex items-center gap-3">
            <div className={cn(
                'flex items-center justify-center h-9 w-9 rounded-lg',
                good === true ? 'bg-emerald-50 text-emerald-600' :
                    good === false ? 'bg-rose-50 text-rose-600' :
                        'bg-gray-50 text-gray-500',
            )}>
                <Icon className="h-4 w-4" />
            </div>
            <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-semibold leading-none mt-0.5">
                    {value !== null && value !== undefined ? `${value}${suffix}` : '—'}
                </p>
            </div>
        </div>
    );
}

// ── Main component ───────────────────────────────────────────

interface ForecastAccuracyCardProps {
    locationIds: string[];
}

export function ForecastAccuracyCard({ locationIds }: ForecastAccuracyCardProps) {
  const { t } = useTranslation();
    const { data: rows, isLoading } = useForecastAccuracy({ locationIds });

    if (isLoading) {
        return (
            <Card className="p-5 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-40 mb-4" />
                <div className="grid grid-cols-4 gap-4">
                    <div className="h-14 bg-gray-100 rounded" />
                    <div className="h-14 bg-gray-100 rounded" />
                    <div className="h-14 bg-gray-100 rounded" />
                    <div className="h-14 bg-gray-100 rounded" />
                </div>
            </Card>
        );
    }

    // Aggregate across all locations/models (pick latest model or aggregate)
    const agg = aggregateAccuracy(rows || []);

    if (!agg || agg.daysEvaluated === 0) {
        return (
            <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        {t('forecast.ForecastAccuracyCard.forecastAccuracy')}
                    </h3>
                </div>
                <p className="text-sm text-muted-foreground">
                    {t('forecast.ForecastAccuracyCard.ejecuta')} <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{t('forecast.ForecastAccuracyCard.backfillforecastaccuracy')}</code> {t('forecast.ForecastAccuracyCard.paraEmpezarAMedirLa')}
                </p>
            </Card>
        );
    }

    return (
        <Card className="p-5 bg-white">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    {t('forecast.ForecastAccuracyCard.forecastAccuracy1')}
                    <span className="text-xs font-normal text-muted-foreground">
                        (últimos 90 días · {agg.daysEvaluated} días evaluados)
                    </span>
                </h3>
                <AccuracyBadge mape={agg.mape} />
            </div>

            <div className="grid grid-cols-4 gap-4">
                <KpiMini
                    icon={Target}
                    label="MAPE"
                    value={agg.mape?.toFixed(1) ?? null}
                    suffix="%"
                    good={agg.mape !== null ? agg.mape <= 10 : undefined}
                />
                <KpiMini
                    icon={agg.biasEur !== null && agg.biasEur >= 0 ? TrendingUp : TrendingDown}
                    label={t('forecast.ForecastAccuracyCard.bias')}
                    value={agg.biasEur !== null ? `€${Math.abs(agg.biasEur).toLocaleString('es-ES')}` : null}
                    suffix={agg.biasEur !== null ? (agg.biasEur >= 0 ? ' (sobre)' : ' (bajo)') : ''}
                    good={agg.biasEur !== null ? Math.abs(agg.biasEur) <= 200 : undefined}
                />
                <KpiMini
                    icon={BarChart3}
                    label={t('forecast.ForecastAccuracyCard.hitRate10')}
                    value={agg.hitRate10?.toFixed(1) ?? null}
                    suffix="%"
                    good={agg.hitRate10 !== null ? agg.hitRate10 >= 85 : undefined}
                />
                <KpiMini
                    icon={BarChart3}
                    label={t('forecast.ForecastAccuracyCard.hitRate5')}
                    value={agg.hitRate5?.toFixed(1) ?? null}
                    suffix="%"
                    good={agg.hitRate5 !== null ? agg.hitRate5 >= 70 : undefined}
                />
            </div>
        </Card>
    );
}

// ── Aggregation helper ───────────────────────────────────────

interface AggregatedAccuracy {
    daysEvaluated: number;
    mape: number | null;
    biasEur: number | null;
    hitRate10: number | null;
    hitRate5: number | null;
}

function aggregateAccuracy(rows: ForecastAccuracyRow[]): AggregatedAccuracy {
    if (rows.length === 0) {
        return { daysEvaluated: 0, mape: null, biasEur: null, hitRate10: null, hitRate5: null };
    }

    // Weighted average by days evaluated
    let totalDays = 0;
    let sumMape = 0;
    let sumBias = 0;
    let sumHit10 = 0;
    let sumHit5 = 0;

    for (const r of rows) {
        const d = r.days_evaluated || 0;
        totalDays += d;
        sumMape += (r.mape || 0) * d;
        sumBias += (r.bias_eur || 0) * d;
        sumHit10 += (r.hit_rate_10pct || 0) * d;
        sumHit5 += (r.hit_rate_5pct || 0) * d;
    }

    return {
        daysEvaluated: totalDays,
        mape: totalDays > 0 ? sumMape / totalDays : null,
        biasEur: totalDays > 0 ? sumBias / totalDays : null,
        hitRate10: totalDays > 0 ? sumHit10 / totalDays : null,
        hitRate5: totalDays > 0 ? sumHit5 / totalDays : null,
    };
}
