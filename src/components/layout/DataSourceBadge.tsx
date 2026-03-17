import { useDemoMode } from '@/contexts/DemoModeContext';
import { Database, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

const REASON_LABELS: Record<string, string> = {
    auto_demo_no_sync: 'Sin datos POS',
    auto_pos_recent: 'POS sincronizado',
    auto_pos_stale: 'POS desactualizado',
    manual_demo: 'Forzado a Demo',
    manual_pos: 'Forzado a POS',
    manual_pos_blocked_no_sync: 'POS sin datos',
    legacy_pos_connected: 'POS conectado',
    legacy_no_pos: 'Sin POS',
    no_session: 'Sin sesión',
    loading: 'Cargando…',
};

interface DataSourceBadgeProps {
    collapsed?: boolean;
}

export function DataSourceBadge({ collapsed = false }: DataSourceBadgeProps) {
    const { dataSource, dataSourceMode, dataSourceReason, dataSourceBlocked } = useDemoMode();

    const isPos = dataSource === 'pos';
    const isAuto = dataSourceMode === 'auto';
    const reasonLabel = REASON_LABELS[dataSourceReason] || dataSourceReason;

    const Icon = dataSourceBlocked ? AlertTriangle : isPos ? Wifi : WifiOff;

    const badgeColor = dataSourceBlocked
        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
        : isPos
            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
            : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30';

    const dotColor = dataSourceBlocked
        ? 'bg-amber-500'
        : isPos
            ? 'bg-emerald-500'
            : 'bg-blue-500';

    const tooltipText = [
        `Fuente: ${isPos ? 'POS (real)' : 'Demo'}`,
        `Modo: ${isAuto ? 'Automático' : 'Manual'}`,
        `Razón: ${reasonLabel}`,
        dataSourceBlocked ? '⚠️ Bloqueado: datos POS no disponibles' : null,
    ].filter(Boolean).join('\n');

    if (collapsed) {
        return (
            <TooltipProvider delayDuration={0}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className={cn(
                            'mx-auto flex items-center justify-center w-8 h-8 rounded-md border cursor-default',
                            badgeColor
                        )}>
                            <Icon className="h-3.5 w-3.5" />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[200px] whitespace-pre-line text-xs">
                        {tooltipText}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    return (
        <TooltipProvider delayDuration={0}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className={cn(
                        'flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs cursor-default transition-colors',
                        badgeColor
                    )}>
                        <span className="relative flex h-2 w-2 shrink-0">
                            <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping', dotColor)} />
                            <span className={cn('relative inline-flex rounded-full h-2 w-2', dotColor)} />
                        </span>
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate font-medium">
                            {isPos ? 'POS' : 'Demo'}
                        </span>
                        <span className="text-[10px] opacity-70 truncate">
                            {isAuto ? 'auto' : 'manual'}
                        </span>
                    </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[220px] whitespace-pre-line text-xs">
                    {tooltipText}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
