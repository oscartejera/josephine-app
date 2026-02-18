/**
 * Data Access Layer — Inventory & Procurement
 *
 * getLowStockAlerts: reads from `inventory_items` (operational table — no mart view needed).
 * createPurchaseOrderDraftFromAlerts: writes to `purchase_orders` + `purchase_order_lines`.
 */

import { supabase, assertContext, hasNoLocations } from './client';
import {
  type QueryContext,
  type LowStockAlert,
  type PurchaseOrderDraft,
  type PurchaseOrderResult,
} from './types';

// ─── getLowStockAlerts ──────────────────────────────────────────────────────

/**
 * Items whose current_stock is below par_level for the given locations.
 */
export async function getLowStockAlerts(
  ctx: QueryContext
): Promise<LowStockAlert[]> {
  assertContext(ctx);
  if (hasNoLocations(ctx)) return [];

  // inventory_items is org-scoped (group_id), not location-scoped.
  // Filter by group_id and look for items below par.
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id, name, unit, current_stock, par_level, group_id')
    .eq('group_id', ctx.orgId)
    .not('par_level', 'is', null);

  if (error) {
    console.error('[data/inventory] getLowStockAlerts error:', error.message);
    return [];
  }

  return (data || [])
    .filter((r: any) => {
      const stock = Number(r.current_stock) || 0;
      const par = Number(r.par_level) || 0;
      return par > 0 && stock < par;
    })
    .map((r: any) => ({
      itemId: r.id,
      itemName: r.name,
      locationId: '', // inventory_items is org-scoped
      currentStock: Number(r.current_stock) || 0,
      parLevel: Number(r.par_level) || 0,
      deficit: (Number(r.par_level) || 0) - (Number(r.current_stock) || 0),
      unit: r.unit || 'unit',
    }))
    .sort((a, b) => b.deficit - a.deficit);
}

// ─── createPurchaseOrderDraftFromAlerts ──────────────────────────────────────

/**
 * Creates a draft PO from low stock alerts.
 * Inserts into `purchase_orders` (status='draft') and `purchase_order_lines`.
 */
export async function createPurchaseOrderDraftFromAlerts(
  ctx: QueryContext,
  draft: PurchaseOrderDraft
): Promise<PurchaseOrderResult> {
  assertContext(ctx);

  // 1. Create the PO header
  const { data: po, error: poErr } = await supabase
    .from('purchase_orders')
    .insert({
      supplier_id: draft.supplierId,
      location_id: draft.locationId,
      status: 'draft',
    })
    .select('id, status')
    .single();

  if (poErr || !po) {
    throw new Error(`Failed to create PO: ${poErr?.message || 'no data returned'}`);
  }

  // 2. Insert line items
  const lines = draft.lines.map((line) => ({
    purchase_order_id: po.id,
    inventory_item_id: line.itemId,
    quantity: line.qty,
    unit_price: line.priceEstimate,
  }));

  if (lines.length > 0) {
    const { error: linesErr } = await supabase
      .from('purchase_order_lines')
      .insert(lines);

    if (linesErr) {
      console.error('[data/inventory] PO lines insert error:', linesErr.message);
      // PO header was created but lines failed — caller should handle
    }
  }

  return {
    id: po.id,
    status: po.status,
    totalLines: lines.length,
  };
}
