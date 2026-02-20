/**
 * Data Access Layer — Reconciliation
 *
 * Queries reconciliation data via the rpc_reconciliation_summary RPC.
 */

import { supabase } from '@/integrations/supabase/client';
import { type QueryContext, type DateRange } from './types';
import { assertContext, hasNoLocations } from './client';

// ─── RPC Response Types ─────────────────────────────────────────────────────

export interface ReconciliationLineRpc {
  inventory_item_id: string;
  item_name: string;
  unit: string;
  unit_cost: number;
  opening_qty: number;
  deliveries_qty: number;
  transfers_net_qty: number;
  closing_qty: number;
  used_qty: number;
  sales_qty: number;
  variance_qty: number;
  batch_balance: number;
  variance_value: number;
}

export interface ReconciliationHeaderRpc {
  id: string;
  location_id: string;
  location_name: string;
  start_date: string;
  end_date: string;
  status: string;
  line_count: number;
  total_variance_qty: number;
  created_at: string;
}

export interface ReconciliationTotalsRpc {
  opening_qty: number;
  deliveries_qty: number;
  transfers_net_qty: number;
  closing_qty: number;
  used_qty: number;
  sales_qty: number;
  variance_qty: number;
  batch_balance: number;
  variance_value: number;
}

export interface ReconciliationSummary {
  count_headers: ReconciliationHeaderRpc[];
  lines: ReconciliationLineRpc[];
  totals: ReconciliationTotalsRpc;
}

// ─── Empty result ────────────────────────────────────────────────────────────

const EMPTY_TOTALS: ReconciliationTotalsRpc = {
  opening_qty: 0,
  deliveries_qty: 0,
  transfers_net_qty: 0,
  closing_qty: 0,
  used_qty: 0,
  sales_qty: 0,
  variance_qty: 0,
  batch_balance: 0,
  variance_value: 0,
};

export const EMPTY_RECONCILIATION_SUMMARY: ReconciliationSummary = {
  count_headers: [],
  lines: [],
  totals: EMPTY_TOTALS,
};

// ─── Query Function ──────────────────────────────────────────────────────────

export async function getReconciliationSummary(
  ctx: QueryContext,
  range: DateRange,
  status?: string
): Promise<ReconciliationSummary> {
  assertContext(ctx);

  if (hasNoLocations(ctx)) {
    return EMPTY_RECONCILIATION_SUMMARY;
  }

  const { data, error } = await supabase.rpc('rpc_reconciliation_summary', {
    p_org_id: ctx.orgId,
    p_location_ids: ctx.locationIds,
    p_from: range.from,
    p_to: range.to,
    p_status: status || null,
  });

  if (error) {
    console.error('rpc_reconciliation_summary error:', error.message);
    throw error;
  }

  return (data as unknown as ReconciliationSummary) || EMPTY_RECONCILIATION_SUMMARY;
}
