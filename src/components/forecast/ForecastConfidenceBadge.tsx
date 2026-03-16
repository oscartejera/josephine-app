/**
 * ForecastConfidenceBadge — Reusable trust-building badge
 * 
 * Shows forecast accuracy as a confidence metric, e.g. "🎯 95% preciso"
 * Designed to be dropped into any page header that uses forecast data.
 */

import { useForecastAccuracy } from '@/hooks/useForecastAccuracy';
import { useApp } from '@/contexts/AppContext';
import { Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface ForecastConfidenceBadgeProps {
    className?: string;
    compact?: boolean;
}

export function ForecastConfidenceBadge({ className, compact = false }: ForecastConfidenceBadgeProps) {
  const { t } = useTranslation();
    const { locations } = useApp();
    const locationIds = locations.map(l => l.id);

    const { data: accuracyRows } = useForecastAccuracy({ locationIds, enabled: locationIds.length > 0 });

    const accuracy = (() => {
        if (!accuracyRows || accuracyRows.length === 0) return null;
        const totalDays = accuracyRows.reduce((s, r) => s + (r.days_evaluated || 0), 0);
        if (totalDays === 0) return null;
        const mape = accuracyRows.reduce((s, r) => s + (r.mape || 0) * (r.days_evaluated || 0), 0) / totalDays;
        return { confidence: Math.round(100 - mape), days: totalDays, mape: Math.round(mape * 10) / 10 };
    })();

    if (!accuracy) return null;

    const { confidence, days } = accuracy;
    const isExcellent = confidence >= 95;
    const isGood = confidence >= 90;

    const badgeColor = isExcellent
        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
        : isGood
            ? 'bg-green-100 text-green-700 border-green-200'
            : confidence >= 80
                ? 'bg-amber-100 text-amber-700 border-amber-200'
                : 'bg-red-100 text-red-700 border-red-200';

    if (compact) {
        return (
            <span className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border',
                badgeColor,
                className
            )}>
                <Target className="h-3 w-3" />
                {confidence}%
            </span>
        );
    }

    return (
        <span className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
            badgeColor,
            className
        )}>
            <Target className="h-3.5 w-3.5" />
            {confidence}% preciso
            <span className="text-[10px] font-normal opacity-70">({days}d)</span>
        </span>
    );
}
