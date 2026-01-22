import { useState, useEffect, useCallback, useRef } from 'react';
import type { KDSOrder, KDSTicketLine } from './useKDSData';
import { useNotificationStore } from '@/stores/notificationStore';

export interface KDSAlertSettings {
  kitchen: number; // minutes
  bar: number;
  prep: number;
}

export interface KDSAlert {
  id: string;
  itemId: string;
  itemName: string;
  destination: 'kitchen' | 'bar' | 'prep';
  overdueMinutes: number;
  ticketId: string;
  tableName: string | null;
  triggeredAt: Date;
}

const DEFAULT_SETTINGS: KDSAlertSettings = {
  kitchen: 8,
  bar: 3,
  prep: 5,
};

const STORAGE_KEY = 'kds-alert-settings';

export function useKDSAlerts(orders: KDSOrder[]) {
  const [settings, setSettings] = useState<KDSAlertSettings>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
  });
  
  const [alerts, setAlerts] = useState<KDSAlert[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const addNotification = useNotificationStore((state) => state.addNotification);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const notifiedItemsRef = useRef<Set<string>>(new Set());

  // Persist settings
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = useCallback((newSettings: Partial<KDSAlertSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const playAlertSound = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/sounds/notification.mp3');
    }
    audioRef.current.play().catch(console.error);
  }, []);

  const dismissAlert = useCallback((alertId: string) => {
    setDismissedAlerts(prev => new Set(prev).add(alertId));
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  }, []);

  const dismissAllAlerts = useCallback(() => {
    const allIds = alerts.map(a => a.id);
    setDismissedAlerts(prev => {
      const newSet = new Set(prev);
      allIds.forEach(id => newSet.add(id));
      return newSet;
    });
    setAlerts([]);
  }, [alerts]);

  // Check for overdue items
  useEffect(() => {
    const checkAlerts = () => {
      const now = Date.now();
      const newAlerts: KDSAlert[] = [];

      for (const order of orders) {
        for (const item of order.items) {
          // Only check items that are being prepared
          if (item.prep_status !== 'preparing' || !item.prep_started_at) continue;

          const startTime = new Date(item.prep_started_at).getTime();
          const elapsedMinutes = Math.floor((now - startTime) / 60000);
          // Use product-specific time if set, otherwise use station default
          const threshold = item.target_prep_time ?? settings[item.destination];

          if (elapsedMinutes >= threshold) {
            const alertId = `${item.id}-${Math.floor(elapsedMinutes / threshold)}`;
            
            // Skip if already dismissed
            if (dismissedAlerts.has(alertId)) continue;

            newAlerts.push({
              id: alertId,
              itemId: item.id,
              itemName: item.item_name,
              destination: item.destination,
              overdueMinutes: elapsedMinutes - threshold,
              ticketId: order.ticketId,
              tableName: order.tableName || order.tableNumber || 'Sin mesa',
              triggeredAt: new Date(),
            });

            // Send notification only once per item crossing threshold
            const notifKey = `${item.id}-overdue`;
            if (!notifiedItemsRef.current.has(notifKey)) {
              notifiedItemsRef.current.add(notifKey);
              playAlertSound();
              addNotification({
                type: 'alert',
                title: '⏰ Tiempo excedido',
                message: `${item.item_name} en ${order.tableName || order.tableNumber || 'Sin mesa'} supera los ${threshold} min`,
                data: { itemId: item.id, ticketId: order.ticketId },
              });
            }
          }
        }
      }

      setAlerts(newAlerts);
    };

    // Initial check
    checkAlerts();

    // Check every 30 seconds
    const interval = setInterval(checkAlerts, 30000);
    return () => clearInterval(interval);
  }, [orders, settings, dismissedAlerts, addNotification, playAlertSound]);

  // Clear notified items when they're no longer preparing
  useEffect(() => {
    const currentPreparingIds = new Set(
      orders.flatMap(o => 
        o.items
          .filter(i => i.prep_status === 'preparing')
          .map(i => `${i.id}-overdue`)
      )
    );

    notifiedItemsRef.current.forEach(key => {
      if (!currentPreparingIds.has(key)) {
        notifiedItemsRef.current.delete(key);
      }
    });
  }, [orders]);

  // Calculate overdue count per item (for visual indicators)
  const getItemOverdueInfo = useCallback((item: KDSTicketLine): { isOverdue: boolean; overdueMinutes: number; threshold: number } => {
    if (item.prep_status !== 'preparing' || !item.prep_started_at) {
      return { isOverdue: false, overdueMinutes: 0, threshold: 0 };
    }

    const startTime = new Date(item.prep_started_at).getTime();
    const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
    // Use product-specific time if set, otherwise use station default
    const threshold = item.target_prep_time ?? settings[item.destination];
    const overdueMinutes = elapsedMinutes - threshold;

    return {
      isOverdue: overdueMinutes >= 0,
      overdueMinutes: Math.max(0, overdueMinutes),
      threshold,
    };
  }, [settings]);

  return {
    settings,
    updateSettings,
    alerts,
    alertCount: alerts.length,
    dismissAlert,
    dismissAllAlerts,
    getItemOverdueInfo,
  };
}
