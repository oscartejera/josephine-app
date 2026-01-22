import { AlertTriangle, X, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { KDSAlert } from '@/hooks/useKDSAlerts';

interface KDSAlertsPanelProps {
  alerts: KDSAlert[];
  onDismiss: (alertId: string) => void;
  onDismissAll: () => void;
}

const destinationLabels: Record<string, string> = {
  kitchen: 'Cocina',
  bar: 'Bar',
  prep: 'Prep',
};

export function KDSAlertsPanel({ alerts, onDismiss, onDismissAll }: KDSAlertsPanelProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 max-h-[50vh] overflow-hidden flex flex-col bg-zinc-900 border-2 border-red-500 rounded-lg shadow-2xl shadow-red-500/20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-red-500/20 border-b border-red-500/30">
        <div className="flex items-center gap-2 text-red-400">
          <AlertTriangle className="h-5 w-5 animate-pulse" />
          <span className="font-bold">{alerts.length} Alerta{alerts.length !== 1 ? 's' : ''}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismissAll}
          className="text-white hover:text-red-300 hover:bg-red-500/20 h-8 px-2"
        >
          <XCircle className="h-4 w-4 mr-1" />
          Cerrar todas
        </Button>
      </div>

      {/* Alerts list */}
      <div className="flex-1 overflow-y-auto">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={cn(
              "flex items-start gap-3 px-4 py-3 border-b border-zinc-800 last:border-b-0",
              "bg-gradient-to-r from-red-500/10 to-transparent",
              "animate-pulse"
            )}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white truncate">{alert.itemName}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-300">
                  {destinationLabels[alert.destination]}
                </span>
              </div>
              <p className="text-sm text-zinc-400 mt-0.5">
                {alert.tableName} • <span className="text-red-400 font-medium">+{alert.overdueMinutes} min excedido</span>
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDismiss(alert.id)}
              className="shrink-0 h-8 w-8 text-white hover:text-white hover:bg-zinc-800"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
