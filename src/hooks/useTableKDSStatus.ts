/**
 * useTableKDSStatus Hook
 * Tracks KDS status for tables based on ticket lines
 */

import { useCallback } from 'react';

interface TicketTableMapping {
  ticketId: string;
  tableId?: string;
}

interface TableKDSInfo {
  hasActiveOrders: boolean;
  pendingCount: number;
  preparingCount: number;
  readyCount: number;
  allReady: boolean;
}

export function useTableKDSStatus(
  locationId: string,
  ticketTableMappings: TicketTableMapping[]
) {
  const getTableStatus = useCallback((tableId: string): TableKDSInfo => {
    // For now, return default status
    // In production, would track actual KDS status per table
    const hasOrders = ticketTableMappings.some(m => m.tableId === tableId);

    return {
      hasActiveOrders: hasOrders,
      pendingCount: 0,
      preparingCount: 0,
      readyCount: 0,
      allReady: false,
    };
  }, [ticketTableMappings]);

  return {
    getTableStatus,
  };
}
