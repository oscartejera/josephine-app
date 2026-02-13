/**
 * DataSourceBadge — Shows current data source (POS/Demo) with reason tooltip.
 * Displays warning when manual POS is blocked due to stale sync.
 */

import { useEffectiveDataSource } from '@/hooks/useEffectiveDataSource';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AlertTriangle, Database, Radio } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const REASON_LABELS: Record<string, string> = {
  auto_pos_recent: 'POS sincronizado (auto)',
  auto_demo_no_sync: 'Sin POS, datos simulados',
  manual_demo: 'Modo demo (manual)',
  manual_pos_recent: 'POS forzado (manual)',
  manual_pos_blocked_no_sync: 'POS solicitado pero sync caducado',
  legacy_pos_connected: 'POS conectado (legacy)',
  legacy_no_pos: 'Sin POS (legacy)',
  no_session: 'Sin sesión',
  loading: 'Cargando...',
};

export function DataSourceBadge() {
  const { dsUnified: dataSource, mode, reason, lastSyncedAt, isLoading: loading, blocked } = useEffectiveDataSource();
  const { t } = useTranslation();

  if (loading) return null;

  const isPOS = dataSource === 'pos';
  const reasonLabel = REASON_LABELS[reason] || reason;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1.5">
            <Badge
              variant={blocked ? 'destructive' : isPOS ? 'default' : 'secondary'}
              className="text-xs font-medium gap-1"
            >
              {blocked && <AlertTriangle className="h-3 w-3" />}
              {isPOS ? <Radio className="h-3 w-3" /> : <Database className="h-3 w-3" />}
              {isPOS ? 'POS' : 'Demo'}
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1 text-xs">
            <p className="font-semibold">{t('data_source', 'Fuente de datos')}: {isPOS ? 'POS (Square)' : 'Demo (simulado)'}</p>
            <p className="text-muted-foreground">{reasonLabel}</p>
            <p className="text-muted-foreground">
              {t('mode', 'Modo')}: {mode === 'auto' ? 'Automático' : 'Manual'}
            </p>
            {lastSyncedAt && (
              <p className="text-muted-foreground">
                {t('last_sync', 'Última sync')}: {lastSyncedAt.toLocaleString('es-ES')}
              </p>
            )}
            {blocked && (
              <p className="text-destructive font-medium mt-1">
                Sync caducado ({'>'}24h). Mostrando datos demo hasta próxima sincronización.
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
