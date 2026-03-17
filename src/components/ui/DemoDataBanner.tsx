/**
 * DemoDataBanner — shows a subtle banner when data is from demo/seeded sources.
 * Used on pages that have demo data fallback (Reviews, Inventory Insights, etc.)
 */

import { AlertTriangle } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useTranslation } from 'react-i18next';

interface DemoDataBannerProps {
    /** Optional custom message */
    message?: string;
    /** Force show regardless of data source */
    forceShow?: boolean;
}

export function DemoDataBanner({ message, forceShow }: DemoDataBannerProps) {
  const { t } = useTranslation();
    const { dataSource } = useApp();

    // Show when in demo mode or forced
    const isDemoMode = dataSource === 'demo' || forceShow;
    if (!isDemoMode) return null;

    return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
                {message || '{t('common.demoDataBanner')}'}
            </span>
        </div>
    );
}

/**
 * DemoDataBadge — inline badge for small spaces  
 */
export function DemoDataBadge() {
    const { dataSource } = useApp();
    if (dataSource !== 'demo') return null;

    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-3 w-3" />
            Demo
        </span>
    );
}
