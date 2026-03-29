/**
 * useWasteAutoActions — monitors waste metrics against configurable
 * thresholds and triggers in-app notifications. Provides infrastructure
 * stubs for push/email notifications via Edge Functions.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { toast } from 'sonner';

// ── Types ──

export interface WasteThreshold {
  warningMultiplier: number;   // e.g. 1.5 = 150% of target
  criticalMultiplier: number;  // e.g. 2.0 = 200% of target
  notifyInApp: boolean;
  notifyEmail: boolean;        // placeholder
  notifyPush: boolean;         // placeholder
}

export interface WasteAutoAction {
  id: string;
  type: 'warning' | 'critical';
  title: string;
  message: string;
  triggeredAt: Date;
  wastePercent: number;
  threshold: number;
  dismissed: boolean;
}

export interface AutoActionsResult {
  actions: WasteAutoAction[];
  thresholds: WasteThreshold;
  setThresholds: (t: WasteThreshold) => void;
  dismissAction: (id: string) => void;
  hasCritical: boolean;
  hasWarning: boolean;
}

// ── LocalStorage key ──
const THRESHOLDS_KEY = 'josephine_waste_thresholds';
const DISMISSED_KEY = 'josephine_waste_dismissed_actions';

// ── Default thresholds ──
const DEFAULT_THRESHOLDS: WasteThreshold = {
  warningMultiplier: 1.5,
  criticalMultiplier: 2.0,
  notifyInApp: true,
  notifyEmail: false,
  notifyPush: false,
};

function loadThresholds(): WasteThreshold {
  try {
    const saved = localStorage.getItem(THRESHOLDS_KEY);
    if (saved) return { ...DEFAULT_THRESHOLDS, ...JSON.parse(saved) };
  } catch {}
  return DEFAULT_THRESHOLDS;
}

function loadDismissed(): Set<string> {
  try {
    const saved = localStorage.getItem(DISMISSED_KEY);
    if (saved) return new Set(JSON.parse(saved));
  } catch {}
  return new Set();
}

// ── Push/Email Infrastructure (stubs for future Edge Function integration) ──

interface NotificationPayload {
  type: 'warning' | 'critical';
  title: string;
  message: string;
  wastePercent: number;
  orgId?: string;
  userId?: string;
}

/**
 * Send notification via Edge Function.
 * TODO: Implement actual Edge Function `send-waste-alert`
 *
 * Expected Edge Function contract:
 * POST /functions/v1/send-waste-alert
 * Body: { type, title, message, channels: ['email', 'push'], recipients: [userId] }
 *
 * For now, logs to console and shows in-app toast.
 */
async function sendExternalNotification(payload: NotificationPayload, channels: { email: boolean; push: boolean }) {
  if (!channels.email && !channels.push) return;

  console.log('[WasteAutoActions] External notification queued:', {
    ...payload,
    channels,
    timestamp: new Date().toISOString(),
  });

  // Future implementation:
  // const { data, error } = await supabase.functions.invoke('send-waste-alert', {
  //   body: { ...payload, channels: { email: channels.email, push: channels.push } }
  // });
}

// ── Hook ──

export function useWasteAutoActions(
  wastePercent: number,
  wasteTarget: number,
  totalWaste: number,
): AutoActionsResult {
  const [thresholds, setThresholdsState] = useState<WasteThreshold>(loadThresholds);
  const [actions, setActions] = useState<WasteAutoAction[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed);
  const lastNotified = useRef<{ warning: boolean; critical: boolean }>({ warning: false, critical: false });

  const setThresholds = useCallback((t: WasteThreshold) => {
    setThresholdsState(t);
    localStorage.setItem(THRESHOLDS_KEY, JSON.stringify(t));
  }, []);

  const dismissAction = useCallback((id: string) => {
    setDismissed(prev => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
      return next;
    });
    setActions(prev => prev.map(a => a.id === id ? { ...a, dismissed: true } : a));
  }, []);

  // Monitor thresholds
  useEffect(() => {
    if (wastePercent <= 0 || wasteTarget <= 0) return;

    const warningThreshold = wasteTarget * thresholds.warningMultiplier;
    const criticalThreshold = wasteTarget * thresholds.criticalMultiplier;

    const newActions: WasteAutoAction[] = [];
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);

    // Critical threshold
    if (wastePercent >= criticalThreshold) {
      const actionId = `critical-${todayKey}`;
      if (!lastNotified.current.critical) {
        lastNotified.current.critical = true;

        const action: WasteAutoAction = {
          id: actionId,
          type: 'critical',
          title: '🚨 Merma crítica',
          message: `La merma actual (${wastePercent.toFixed(1)}%) supera ${thresholds.criticalMultiplier}× el objetivo (${criticalThreshold.toFixed(1)}%). Total: €${totalWaste.toFixed(0)}`,
          triggeredAt: now,
          wastePercent,
          threshold: criticalThreshold,
          dismissed: dismissed.has(actionId),
        };

        newActions.push(action);

        if (thresholds.notifyInApp && !dismissed.has(actionId)) {
          toast.error(action.title, {
            description: action.message,
            duration: 10000,
          });
        }

        // Queue external notifications
        sendExternalNotification({
          type: 'critical',
          title: action.title,
          message: action.message,
          wastePercent,
        }, { email: thresholds.notifyEmail, push: thresholds.notifyPush });
      }
    }

    // Warning threshold
    if (wastePercent >= warningThreshold && wastePercent < criticalThreshold) {
      const actionId = `warning-${todayKey}`;
      if (!lastNotified.current.warning) {
        lastNotified.current.warning = true;

        const action: WasteAutoAction = {
          id: actionId,
          type: 'warning',
          title: '⚠️ Merma por encima del objetivo',
          message: `La merma actual (${wastePercent.toFixed(1)}%) supera ${thresholds.warningMultiplier}× el objetivo (${warningThreshold.toFixed(1)}%). Revisa las causas principales.`,
          triggeredAt: now,
          wastePercent,
          threshold: warningThreshold,
          dismissed: dismissed.has(actionId),
        };

        newActions.push(action);

        if (thresholds.notifyInApp && !dismissed.has(actionId)) {
          toast.warning(action.title, {
            description: action.message,
            duration: 8000,
          });
        }

        sendExternalNotification({
          type: 'warning',
          title: action.title,
          message: action.message,
          wastePercent,
        }, { email: thresholds.notifyEmail, push: thresholds.notifyPush });
      }
    }

    // Reset if below warning
    if (wastePercent < warningThreshold) {
      lastNotified.current = { warning: false, critical: false };
    }

    if (newActions.length > 0) {
      setActions(prev => [...newActions, ...prev].slice(0, 20));
    }
  }, [wastePercent, wasteTarget, totalWaste, thresholds, dismissed]);

  return {
    actions: actions.filter(a => !a.dismissed),
    thresholds,
    setThresholds,
    dismissAction,
    hasCritical: actions.some(a => a.type === 'critical' && !a.dismissed),
    hasWarning: actions.some(a => a.type === 'warning' && !a.dismissed),
  };
}
