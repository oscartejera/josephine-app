/**
 * WasteAlertBanner — threshold warning banners for the waste page.
 *
 * Consumes alerts from useWasteAlerts and renders dismissible banners
 * with severity-coded styling (critical / warning / info).
 */

import { useState } from 'react';
import { AlertTriangle, Info, X, ShieldAlert, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { WasteAlert } from '@/hooks/useWasteAlerts';
import { useTranslation } from 'react-i18next';

interface WasteAlertBannerProps {
  alerts: WasteAlert[];
  className?: string;
}

const SEVERITY_STYLES = {
  critical: {
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-800',
    icon: ShieldAlert,
    iconColor: 'text-red-500',
    badge: 'bg-red-100 text-red-700',
  },
  warning: {
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-800',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
    badge: 'bg-amber-100 text-amber-700',
  },
  info: {
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-800',
    icon: Info,
    iconColor: 'text-blue-500',
    badge: 'bg-blue-100 text-blue-700',
  },
} as const;

export function WasteAlertBanner({
  const { t } = useTranslation(); alerts, className }: WasteAlertBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  if (!alerts.length) return null;

  const visibleAlerts = alerts.filter(a => !dismissed.has(a.id));
  if (!visibleAlerts.length) return null;

  const handleDismiss = (alertId: string) => {
    setDismissed(prev => new Set([...prev, alertId]));
  };

  return (
    <div className={cn("space-y-2", className)}>
      {visibleAlerts.map((alert) => {
        const style = SEVERITY_STYLES[alert.severity];
        const Icon = style.icon;

        return (
          <div
            key={alert.id}
            className={cn(
              "flex items-start gap-3 px-4 py-3 rounded-lg border transition-all",
              style.bg,
              style.text,
            )}
          >
            <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", style.iconColor)} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{alert.title}</span>
                <span className={cn(
                  "text-[10px] font-medium px-1.5 py-0.5 rounded-full uppercase tracking-wider",
                  style.badge
                )}>
                  {alert.severity}
                </span>
              </div>
              <p className="text-sm mt-0.5 opacity-90">{alert.message}</p>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 opacity-60 hover:opacity-100"
              onClick={() => handleDismiss(alert.id)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
