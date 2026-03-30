/**
 * useWasteNotifications — Browser push notifications for waste tracking
 *
 * Three notification types:
 * 1. Daily reminder at configurable time (default 22:30)
 * 2. Missing data alert (no records in 2+ days)
 * 3. Threshold breach (integrated with useWasteAutoActions)
 *
 * Uses native Notification API — works when tab is in background.
 * No service worker needed for this MVP.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// ── Types ──

export interface WasteNotifPrefs {
  enabled: boolean;
  dailyReminder: boolean;
  dailyReminderHour: number;   // 0-23
  dailyReminderMinute: number; // 0-59
  missingDataAlert: boolean;
  missingDataDays: number;     // alert after N days without data
  thresholdAlert: boolean;
}

export interface WasteNotifState {
  permission: NotificationPermission | 'unsupported';
  prefs: WasteNotifPrefs;
  setPrefs: (p: WasteNotifPrefs) => void;
  requestPermission: () => Promise<boolean>;
  sendTestNotification: () => void;
  lastReminderSent: string | null; // ISO date
}

// ── Constants ──

const PREFS_KEY = 'josephine_waste_notif_prefs';
const LAST_REMINDER_KEY = 'josephine_waste_last_reminder';
const LAST_MISSING_KEY = 'josephine_waste_last_missing_alert';
const CHECK_INTERVAL_MS = 60_000; // check every 1 minute

const DEFAULT_PREFS: WasteNotifPrefs = {
  enabled: true,
  dailyReminder: true,
  dailyReminderHour: 22,
  dailyReminderMinute: 30,
  missingDataAlert: true,
  missingDataDays: 2,
  thresholdAlert: true,
};

// ── Helpers ──

function loadPrefs(): WasteNotifPrefs {
  try {
    const saved = localStorage.getItem(PREFS_KEY);
    if (saved) return { ...DEFAULT_PREFS, ...JSON.parse(saved) };
  } catch { /* fallback */ }
  return DEFAULT_PREFS;
}

function getLastSent(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch { return null; }
}

function setLastSent(key: string) {
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem(key, today);
}

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return dateStr === new Date().toISOString().slice(0, 10);
}

async function hasWasteEventsToday(): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const { count } = await supabase
    .from('waste_events')
    .select('id', { count: 'exact', head: true })
    .gte('event_date', today)
    .lt('event_date', today + 'T23:59:59');
  return (count || 0) > 0;
}

async function daysSinceLastWasteEvent(): Promise<number> {
  const { data } = await supabase
    .from('waste_events')
    .select('event_date')
    .order('event_date', { ascending: false })
    .limit(1);

  if (!data || data.length === 0) return 999;
  const lastDate = new Date(data[0].event_date);
  const now = new Date();
  return Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
}

function sendBrowserNotification(
  title: string,
  body: string,
  options?: { tag?: string; icon?: string; onClick?: () => void }
) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const notif = new Notification(title, {
    body,
    icon: options?.icon || '/pwa-icon.svg',
    badge: '/pwa-icon.svg',
    tag: options?.tag || 'josephine-waste',
    requireInteraction: false,
    silent: false,
  });

  notif.onclick = () => {
    window.focus();
    window.location.href = '/insights/waste';
    notif.close();
    options?.onClick?.();
  };

  // Auto-close after 15 seconds
  setTimeout(() => notif.close(), 15_000);
}

// ── Hook ──

export function useWasteNotifications(): WasteNotifState {
  const { session } = useAuth();
  const [prefs, setPrefsState] = useState<WasteNotifPrefs>(loadPrefs);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });
  const [lastReminderSent, setLastReminderSent] = useState<string | null>(
    getLastSent(LAST_REMINDER_KEY)
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Save prefs
  const setPrefs = useCallback((p: WasteNotifPrefs) => {
    setPrefsState(p);
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  }, []);

  // Request permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      setPermission('unsupported');
      return false;
    }
    if (Notification.permission === 'granted') {
      setPermission('granted');
      return true;
    }
    if (Notification.permission === 'denied') {
      setPermission('denied');
      return false;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    return result === 'granted';
  }, []);

  // Test notification
  const sendTestNotification = useCallback(() => {
    sendBrowserNotification(
      '🧪 Notificación de prueba',
      'Las notificaciones de merma están configuradas correctamente. ¡Recibirás recordatorios diarios!',
      { tag: 'josephine-waste-test' }
    );
  }, []);

  // ── Scheduler ──
  useEffect(() => {
    if (!session || !prefs.enabled || permission !== 'granted') return;

    async function check() {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      // 1. Daily reminder
      if (prefs.dailyReminder) {
        const isReminderTime =
          currentHour === prefs.dailyReminderHour &&
          currentMinute >= prefs.dailyReminderMinute &&
          currentMinute < prefs.dailyReminderMinute + 5; // 5 min window

        if (isReminderTime && !isToday(getLastSent(LAST_REMINDER_KEY))) {
          const hasEvents = await hasWasteEventsToday();
          if (!hasEvents) {
            sendBrowserNotification(
              '📊 ¿Registraste la merma de hoy?',
              'Abre Josephine y registra la merma del día para mantener tu racha de datos.',
              { tag: 'josephine-waste-daily' }
            );
            setLastSent(LAST_REMINDER_KEY);
            setLastReminderSent(new Date().toISOString().slice(0, 10));
          }
        }
      }

      // 2. Missing data alert (check once per day, at reminder time)
      if (prefs.missingDataAlert) {
        const isMorning = currentHour === 9 && currentMinute < 5;
        if (isMorning && !isToday(getLastSent(LAST_MISSING_KEY))) {
          const daysMissing = await daysSinceLastWasteEvent();
          if (daysMissing >= prefs.missingDataDays) {
            sendBrowserNotification(
              `⚠️ ${daysMissing} días sin registrar merma`,
              'La calidad de tus datos está bajando. Registra la merma de hoy para recuperar tu racha.',
              { tag: 'josephine-waste-missing' }
            );
            setLastSent(LAST_MISSING_KEY);
          }
        }
      }
    }

    // Run immediately + interval
    check();
    intervalRef.current = setInterval(check, CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [session, prefs, permission]);

  return {
    permission,
    prefs,
    setPrefs,
    requestPermission,
    sendTestNotification,
    lastReminderSent,
  };
}
