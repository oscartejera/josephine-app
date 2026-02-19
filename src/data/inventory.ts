/**
 * Data Access Layer — Inventory & Procurement
 *
 * getLowStockAlerts: reads from `inventory_position_unified` contract view
 *   (joins inventory_items + inventory_item_location for real on_hand values).
 * createPurchaseOrderDraftFromAlerts: writes to `purchase_orders` + `purchase_order_lines`
 *   with idempotency check (no duplicate draft POs for same supplier+location+day).
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
 * Items whose on_hand is below par_level, read from inventory_position_unified.
 * Falls back to inventory_items if the view is not available.
 */
export async function getLowStockAlerts(
  ctx: QueryContext
): Promise<LowStockAlert[]> {
  assertContext(ctx);
  if (hasNoLocations(ctx)) return [];

  // Try the contract view first (has real on_hand from inventory_item_location)
  const { data, error } = await supabase
    .from('inventory_position_unified' as any)
    .select('item_id, name, unit, on_hand, par_level, location_id, deficit')
    .eq('org_id', ctx.orgId)
    .in('location_id', ctx.locationIds)
    .gt('deficit', 0);

  if (error) {
    // Fallback to inventory_items if view doesn't exist yet
    console.warn('[data/inventory] inventory_position_unified error, falling back:', error.message);
    return getLowStockAlertsFallback(ctx);
  }

  return (data || [])
    .map((r: any) => ({
      itemId: r.item_id,
      itemName: r.name,
      locationId: r.location_id || '',
      currentStock: Number(r.on_hand) || 0,
      parLevel: Number(r.par_level) || 0,
      deficit: Number(r.deficit) || 0,
      unit: r.unit || 'unit',
    }))
    .sort((a, b) => b.deficit - a.deficit);
}

/** Fallback: read from inventory_items (current_stock may be 0) */
async function getLowStockAlertsFallback(
  ctx: QueryContext
): Promise<LowStockAlert[]> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id, name, unit, current_stock, par_level, group_id')
    .eq('group_id', ctx.orgId)
    .not('par_level', 'is', null);

  if (error) {
    console.error('[data/inventory] getLowStockAlerts fallback error:', error.message);
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
      locationId: '',
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
 * Idempotent: checks if a draft PO already exists for the same
 * org + location + supplier + today before creating a new one.
 */
export async function createPurchaseOrderDraftFromAlerts(
  ctx: QueryContext,
  draft: PurchaseOrderDraft
): Promise<PurchaseOrderResult> {
  assertContext(ctx);

  // Idempotency check: look for existing draft PO for same supplier+location+today
  const today = new Date().toISOString().split('T')[0];
  const { data: existingPo } = await supabase
    .from('purchase_orders')
    .select('id, status')
    .eq('supplier_id', draft.supplierId)
    .eq('location_id', draft.locationId)
    .eq('status', 'draft')
    .gte('created_at', `${today}T00:00:00`)
    .lte('created_at', `${today}T23:59:59`)
    .limit(1)
    .maybeSingle();

  if (existingPo) {
    // Return existing draft PO — no duplicate created
    const { count } = await supabase
      .from('purchase_order_lines')
      .select('id', { count: 'exact', head: true })
      .eq('purchase_order_id', existingPo.id);

    return {
      id: existingPo.id,
      status: existingPo.status,
      totalLines: count || 0,
    };
  }

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
    }
  }

  return {
    id: po.id,
    status: po.status,
    totalLines: lines.length,
  };
}
