/**
 * useWasteShelfLife — queries inventory_lot_tracking for lots
 * that are expiring soon or already expired.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';

// ── Types ──

export interface LotAlert {
  lotId: string;
  itemName: string;
  category: string;
  lotNumber: string;
  quantity: number;
  unit: string;
  openedAt: Date | null;
  expiresAt: Date;
  hoursUntilExpiry: number;
  status: 'expired' | 'critical' | 'warning' | 'ok';
  statusLabel: string;
  action: string;
}

export interface ShelfLifeSummary {
  expiredCount: number;
  criticalCount: number;    // <24h
  warningCount: number;     // 24-48h
  okCount: number;
  totalOpenLots: number;
  estimatedExpiryLoss: number;  // € at risk
}

export interface ShelfLifeResult {
  alerts: LotAlert[];
  summary: ShelfLifeSummary;
  isLoading: boolean;
  refetch: () => void;
}

// ── Hook ──

export function useWasteShelfLife(): ShelfLifeResult {
  const { locations } = useApp();
  const [alerts, setAlerts] = useState<LotAlert[]>([]);
  const [summary, setSummary] = useState<ShelfLifeSummary>({
    expiredCount: 0,
    criticalCount: 0,
    warningCount: 0,
    okCount: 0,
    totalOpenLots: 0,
    estimatedExpiryLoss: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const locationIds = locations.map(l => l.id);

  const fetchLots = useCallback(async () => {
    if (locationIds.length === 0) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Fetch open/expired lots with their items
      const { data: lots, error } = await supabase
        .from('inventory_lot_tracking' as any)
        .select('id, inventory_item_id, lot_number, quantity, unit, opened_at, expires_at, status, inventory_items(name, category_name, last_cost)')
        .in('location_id', locationIds)
        .in('status', ['open', 'expired'])
        .order('expires_at', { ascending: true });

      if (error) {
        console.error('Error fetching lot tracking:', error);
        setIsLoading(false);
        return;
      }

      const now = new Date();
      const lotAlerts: LotAlert[] = [];
      let expiredCount = 0;
      let criticalCount = 0;
      let warningCount = 0;
      let okCount = 0;
      let estimatedLoss = 0;

      (lots || []).forEach((lot: any) => {
        const expiresAt = new Date(lot.expires_at);
        const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

        const itemInfo = lot.inventory_items as any;
        const itemName = itemInfo?.name || 'Desconocido';
        const category = itemInfo?.category_name || 'Otros';
        const unitCost = itemInfo?.last_cost || 5; // fallback €5
        const lotValue = (lot.quantity || 0) * unitCost;

        let status: LotAlert['status'];
        let statusLabel: string;
        let action: string;

        if (lot.status === 'expired' || hoursUntilExpiry < 0) {
          status = 'expired';
          statusLabel = 'Caducado';
          action = 'Descartar inmediatamente';
          expiredCount++;
          estimatedLoss += lotValue;
        } else if (hoursUntilExpiry <= 24) {
          status = 'critical';
          statusLabel = `Caduca en ${Math.max(1, Math.round(hoursUntilExpiry))}h`;
          action = 'Usar hoy o descartar';
          criticalCount++;
          estimatedLoss += lotValue * 0.8; // 80% likely loss
        } else if (hoursUntilExpiry <= 48) {
          status = 'warning';
          statusLabel = `Caduca en ${Math.round(hoursUntilExpiry)}h`;
          action = 'Priorizar en producción';
          warningCount++;
          estimatedLoss += lotValue * 0.3; // 30% risk
        } else {
          status = 'ok';
          statusLabel = `${Math.round(hoursUntilExpiry / 24)} días restantes`;
          action = 'Normal — rotación FIFO';
          okCount++;
        }

        lotAlerts.push({
          lotId: lot.id,
          itemName,
          category,
          lotNumber: lot.lot_number || '-',
          quantity: lot.quantity || 0,
          unit: lot.unit || 'kg',
          openedAt: lot.opened_at ? new Date(lot.opened_at) : null,
          expiresAt,
          hoursUntilExpiry,
          status,
          statusLabel,
          action,
        });
      });

      // Sort: expired first, then critical, then warning, then ok
      const statusOrder = { expired: 0, critical: 1, warning: 2, ok: 3 };
      lotAlerts.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

      setAlerts(lotAlerts);
      setSummary({
        expiredCount,
        criticalCount,
        warningCount,
        okCount,
        totalOpenLots: lotAlerts.length,
        estimatedExpiryLoss: estimatedLoss,
      });
    } catch (err) {
      console.error('Shelf life fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [locationIds.join(',')]);

  useEffect(() => {
    fetchLots();
  }, [fetchLots]);

  return {
    alerts,
    summary,
    isLoading,
    refetch: fetchLots,
  };
}
