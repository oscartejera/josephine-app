import { useState, useEffect, useCallback, useRef } from 'react';
import type { KDSOrder, KDSTicketLine } from './useKDSData';
import { useNotificationStore } from '@/stores/notificationStore';
import { kdsSoundManager, type KDSSoundSettings, DEFAULT_SOUND_SETTINGS } from '@/lib/kdsSounds';

export interface KDSAlertSettings {
  kitchen: number; // minutes threshold
  bar: number;
}

export interface KDSAlert {
  id: string;
  itemId: string;
  itemName: string;
  destination: 'kitchen' | 'bar';
  overdueMinutes: number;
  ticketId: string;
  tableName: string | null;
  triggeredAt: Date;
  isRush?: boolean;
}

const DEFAULT_ALERT_SETTINGS: KDSAlertSettings = {
  kitchen: 10,
  bar: 18,
};

const STORAGE_KEY = 'kds-alert-settings';

export function useKDSAlerts(orders: KDSOrder[]) {
  const [settings, setSettings] = useState<KDSAlertSettings>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_ALERT_SETTINGS;
  });
  
  const [soundSettings, setSoundSettings] = useState<KDSSoundSettings>(() => {
    return kdsSoundManager.getSettings();
  });
  
  const [alerts, setAlerts] = useState<KDSAlert[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const addNotification = useNotificationStore((state) => state.addNotification);
  const notifiedItemsRef = useRef<Set<string>>(new Set());
  const previousOrderCountRef = useRef(orders.length);

  // Persist alert settings
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = useCallback((newSettings: Partial<KDSAlertSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const updateSoundSettings = useCallback((newSettings: Partial<KDSSoundSettings>) => {
    kdsSoundManager.updateSettings(newSettings);
    setSoundSettings(kdsSoundManager.getSettings());
  }, []);

  const playAlertSound = useCallback((destination: 'kitchen' | 'bar', isRush: boolean = false) => {
    if (isRush) {
      kdsSoundManager.playSound('rush');
    } else {
      kdsSoundManager.playSound(destination);
    }
  }, []);

  const playNewOrderSound = useCallback(() => {
    kdsSoundManager.playSound('newOrder');
  }, []);

  const testSound = useCallback((station: 'kitchen' | 'bar' | 'rush' | 'newOrder') => {
    kdsSoundManager.testSound(station);
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

  // Check for new orders and play sound
  useEffect(() => {
    if (orders.length > previousOrderCountRef.current) {
      // New order(s) arrived
      const newOrders = orders.slice(previousOrderCountRef.current);
      
      // Check if any new order has rush items
      const hasRushOrder = newOrders.some(order => 
        order.items.some(item => item.is_rush)
      );
      
      if (hasRushOrder) {
        kdsSoundManager.playSound('rush');
      } else if (newOrders.length > 0) {
        // Play sound based on first item's destination
        const firstItem = newOrders[0]?.items[0];
        if (firstItem) {
          kdsSoundManager.playSound(firstItem.destination);
        } else {
          kdsSoundManager.playSound('newOrder');
        }
      }
    }
    previousOrderCountRef.current = orders.length;
  }, [orders]);

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
          // Map 'prep' to 'kitchen' for threshold lookup (prep is deprecated)
          const effectiveDestination = item.destination === 'prep' ? 'kitchen' : item.destination;
          const threshold = item.target_prep_time ?? settings[effectiveDestination];

          if (elapsedMinutes >= threshold) {
            const alertId = `${item.id}-${Math.floor(elapsedMinutes / threshold)}`;
            
            if (dismissedAlerts.has(alertId)) continue;

            newAlerts.push({
              id: alertId,
              itemId: item.id,
              itemName: item.item_name,
              destination: effectiveDestination,
              overdueMinutes: elapsedMinutes - threshold,
              ticketId: order.ticketId,
              tableName: order.tableName || order.tableNumber || 'Sin mesa',
              triggeredAt: new Date(),
              isRush: item.is_rush,
            });

            // Send notification only once per item crossing threshold
            const notifKey = `${item.id}-overdue`;
            if (!notifiedItemsRef.current.has(notifKey)) {
              notifiedItemsRef.current.add(notifKey);
              
              // Play station-specific sound (effectiveDestination already excludes 'prep')
              playAlertSound(effectiveDestination, item.is_rush);
              
              addNotification({
                type: 'alert',
                title: item.is_rush ? '🔥 RUSH excedido' : '⏰ Tiempo excedido',
                message: `${item.item_name} en ${order.tableName || order.tableNumber || 'Sin mesa'} supera los ${threshold} min`,
                data: { itemId: item.id, ticketId: order.ticketId },
              });
            }
          }
        }
      }

      setAlerts(newAlerts);
    };

    checkAlerts();
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

  // Calculate overdue info per item
  // Timer starts from when the item was created (entered the queue), NOT when preparation starts
  // This ensures items waiting too long in queue are also flagged
  const getItemOverdueInfo = useCallback((item: KDSTicketLine): { 
    isOverdue: boolean; 
    isWarning: boolean;
    overdueMinutes: number; 
    elapsedMinutes: number;
    threshold: number;
    progressPercent: number;
  } => {
    const defaultResult = { 
      isOverdue: false, 
      isWarning: false, 
      overdueMinutes: 0, 
      elapsedMinutes: 0,
      threshold: 0,
      progressPercent: 0 
    };

    // Items already completed are never overdue
    if (item.prep_status === 'ready' || item.prep_status === 'served') {
      return defaultResult;
    }

    // Use sent_at as the start time - timer starts when order is sent to kitchen
    // This ensures items waiting in queue too long are also flagged
    const startTime = item.sent_at 
      ? new Date(item.sent_at).getTime() 
      : Date.now();
    
    const elapsedMs = Date.now() - startTime;
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    
    // Map 'prep' to 'kitchen' for threshold lookup (prep is deprecated)
    const effectiveDestination = item.destination === 'prep' ? 'kitchen' : item.destination;
    const threshold = item.target_prep_time ?? settings[effectiveDestination];
    const overdueMinutes = elapsedMinutes - threshold;
    const progressPercent = threshold > 0 ? Math.round((elapsedMs / (threshold * 60000)) * 100) : 0;

    return {
      isOverdue: overdueMinutes >= 0, // At or over threshold
      isWarning: progressPercent >= 50 && progressPercent < 100,
      overdueMinutes: Math.max(0, overdueMinutes),
      elapsedMinutes,
      threshold,
      progressPercent,
    };
  }, [settings]);

  return {
    settings,
    updateSettings,
    soundSettings,
    updateSoundSettings,
    testSound,
    alerts,
    alertCount: alerts.length,
    dismissAlert,
    dismissAllAlerts,
    getItemOverdueInfo,
  };
}

// Re-export types
export type { KDSSoundSettings };
export { DEFAULT_SOUND_SETTINGS };
