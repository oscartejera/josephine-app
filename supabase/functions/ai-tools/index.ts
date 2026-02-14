/**
 * ai-tools — Single Edge Function dispatcher for Josephine tool operations.
 *
 * POST /functions/v1/ai-tools
 * Body: { toolName: string, input: Record<string, unknown> }
 * Auth: Bearer <supabase-jwt> (required)
 *
 * Multi-tenant: derives orgId/role/locations from JWT + RBAC RPCs.
 * Actor injected from JWT for writes (never from client).
 * Same 9-gate writeGuard + envelope as MCP local.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";

// ── Core imports ─────────────────────────────────────────────────

import {
  ErrorCode,
  startContext,
  buildEnvelope,
  setServerVersion,
  TOOL_VERSIONS,
  getEnv,
  generateUUID,
  writeGuard,
  finalizeWrite,
  recordWriteError,
} from "../../../src/ai-tools-core/index.ts";

import type {
  ToolName,
  ToolEnvelope,
  WriteInput,
  GuardContext,
  TenantContext,
} from "../../../src/ai-tools-core/index.ts";

import { TOOL_METADATA } from "../../../src/ai-tools-core/registry.ts";

// ── Tool handlers (inline lightweight registry) ──────────────────
// Each handler receives (input, supabaseAdmin) and returns { text, envelope }.
// We import from the core lib for response/guard utilities.

import {
  resolvePagination,
  buildPaginationMeta,
} from "../../../src/ai-tools-core/lib/pagination.ts";

// ── Constants ────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const SERVER_VERSION = "0.1.0";
setServerVersion(SERVER_VERSION);

// ── Tenant context builder ───────────────────────────────────────

interface ResolvedTenant {
  userId: string;
  orgId: string;
  role: string;
  locationIds: string[];
  fullName: string;
}

async function resolveTenant(
  userClient: ReturnType<typeof createClient>,
  adminClient: ReturnType<typeof createClient>,
): Promise<ResolvedTenant> {
  // Get authenticated user from JWT
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    throw new AuthError("Invalid or expired JWT token.");
  }

  const userId = user.id;

  // Get primary role via RPC
  const { data: roleName } = await adminClient.rpc("get_user_primary_role", { _user_id: userId });
  const role = (roleName as string) ?? "employee";

  // Get user's profile for org/group
  const { data: profile } = await adminClient
    .from("profiles")
    .select("group_id, full_name")
    .eq("id", userId)
    .maybeSingle();

  let orgId = profile?.group_id ?? "";
  const fullName = profile?.full_name ?? user.email ?? userId;

  // If no profile group, try from user_roles → locations → group
  if (!orgId) {
    const { data: locs } = await adminClient
      .from("user_locations")
      .select("location_id")
      .eq("user_id", userId);

    if (locs && locs.length > 0) {
      const { data: loc } = await adminClient
        .from("locations")
        .select("group_id")
        .eq("id", locs[0].location_id)
        .single();
      orgId = loc?.group_id ?? "";
    }
  }

  // Get allowed locations
  const { data: userLocs } = await adminClient
    .from("user_locations")
    .select("location_id")
    .eq("user_id", userId);

  let locationIds = (userLocs ?? []).map((l: any) => l.location_id);

  // Owners/admins get all locations in their org
  if (["owner", "admin"].includes(role) && orgId) {
    const { data: allLocs } = await adminClient
      .from("locations")
      .select("id")
      .eq("group_id", orgId)
      .eq("active", true);
    locationIds = (allLocs ?? []).map((l: any) => l.id);
  }

  return { userId, orgId, role, locationIds, fullName };
}

class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

// ── RBAC check ───────────────────────────────────────────────────

async function checkPermission(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  permissionKey: string,
  locationId?: string,
): Promise<boolean> {
  const { data } = await adminClient.rpc("has_permission", {
    _user_id: userId,
    _permission_key: permissionKey,
    _location_id: locationId ?? null,
  });
  return data === true;
}

// ── Tool execution (delegates to admin client) ───────────────────
// This is a simplified dispatcher. Each tool's logic runs using the
// admin client (service_role) AFTER tenant/RBAC authorization.

async function executeReadTool(
  toolName: ToolName,
  input: Record<string, unknown>,
  admin: ReturnType<typeof createClient>,
  tenant: ResolvedTenant,
): Promise<{ text: string; envelope: ToolEnvelope }> {
  const ctx = startContext(toolName);

  switch (toolName) {
    case "josephine_locations_list": {
      const { limit, offset } = resolvePagination(input as any);
      let query = admin
        .from("locations")
        .select("id, name, city, timezone, currency, active, group_id, created_at", { count: "exact" })
        .eq("group_id", tenant.orgId)
        .order("name", { ascending: true })
        .range(offset, offset + limit);
      if (!input.includeInactive) query = query.eq("active", true);
      const { data, error, count } = await query;
      if (error) return { text: `Failed: ${error.message}`, envelope: buildEnvelope(ctx, { status: "error", data: null, errors: [{ code: ErrorCode.UPSTREAM_ERROR, message: error.message }] }) };
      const rows = data ?? [];
      const pagination = buildPaginationMeta(limit, offset, rows.length);
      return { text: `Found ${count ?? rows.length} location(s).`, envelope: buildEnvelope(ctx, { status: "ok", data: { locations: rows.slice(0, limit) }, pagination, meta: { totalCount: count } }) };
    }

    case "josephine_sales_summary": {
      const locationIds = (input.locationIds as string[]) ?? tenant.locationIds;
      const { data, error } = await (admin.rpc as Function)("get_sales_timeseries_unified", {
        p_org_id: tenant.orgId,
        p_location_ids: locationIds,
        p_from: input.fromISO,
        p_to: input.toISO,
      });
      if (error) return { text: `RPC failed: ${error.message}`, envelope: buildEnvelope(ctx, { status: "error", data: null, errors: [{ code: ErrorCode.UPSTREAM_ERROR, message: error.message }] }) };
      const ts = data as Record<string, unknown> | null;
      const warnings: string[] = [];
      const kpis = (ts?.kpis ?? {}) as Record<string, unknown>;
      const dataSource = (ts?.data_source as string) ?? "unknown";
      if (dataSource === "demo") warnings.push("Data source is 'demo' (simulated).");
      let finalSales = Number(kpis.actual_sales) || 0;
      let finalOrders = Number(kpis.actual_orders) || 0;
      if (finalSales === 0 && finalOrders === 0) {
        const hourly = (ts?.hourly ?? []) as Array<Record<string, unknown>>;
        if (hourly.length > 0) {
          finalSales = hourly.reduce((s, h) => s + (Number(h.actual_sales) || 0), 0);
          finalOrders = hourly.reduce((s, h) => s + (Number(h.actual_orders) || 0), 0);
        }
      }
      const forecastSales = Number(kpis.forecast_sales) || 0;
      const summary = {
        period: { from: input.fromISO, to: input.toISO },
        currency: input.currency ?? "EUR",
        dataSource,
        totalNetSales: Math.round(finalSales * 100) / 100,
        totalOrders: finalOrders,
        avgCheckSize: finalOrders > 0 ? Math.round((finalSales / finalOrders) * 100) / 100 : 0,
        forecastSales: Math.round(forecastSales * 100) / 100,
        varianceVsForecastPct: forecastSales > 0 ? Math.round(((finalSales - forecastSales) / forecastSales) * 10000) / 100 : 0,
        locationCount: locationIds.length,
      };
      return { text: `Sales: ${summary.totalNetSales}`, envelope: buildEnvelope(ctx, { status: "ok", data: summary, warnings: warnings.length > 0 ? warnings : undefined }) };
    }

    case "josephine_settings_get": {
      let query = admin.from("location_settings").select("id, location_id, target_gp_percent, target_col_percent, default_cogs_percent, default_hourly_cost, created_at");
      if (input.locationId) query = query.eq("location_id", input.locationId);
      const { data, error } = await query;
      if (error) return { text: `Failed: ${error.message}`, envelope: buildEnvelope(ctx, { status: "error", data: null, errors: [{ code: ErrorCode.UPSTREAM_ERROR, message: error.message }] }) };
      return { text: `${(data ?? []).length} setting(s).`, envelope: buildEnvelope(ctx, { status: "ok", data: { settings: data ?? [] } }) };
    }

    case "josephine_inventory_low_stock": {
      const { data: loc } = await admin.from("locations").select("group_id").eq("id", input.locationId).single();
      if (!loc) return { text: "Location not found.", envelope: buildEnvelope(ctx, { status: "error", data: null, errors: [{ code: ErrorCode.NOT_FOUND, message: "Location not found." }] }) };
      const { limit, offset } = resolvePagination(input as any);
      let query = admin.from("inventory_items").select("id, name, unit, category, current_stock, par_level, last_cost", { count: "exact" }).eq("group_id", loc.group_id).order("name").range(offset, offset + limit);
      if (input.thresholdMode === "min") query = query.or("current_stock.is.null,current_stock.lte.0");
      else query = query.not("par_level", "is", null);
      const { data, error, count } = await query;
      if (error) return { text: `Failed: ${error.message}`, envelope: buildEnvelope(ctx, { status: "error", data: null, errors: [{ code: ErrorCode.UPSTREAM_ERROR, message: error.message }] }) };
      let items = (data ?? []).map((i: any) => ({
        id: i.id, name: i.name, unit: i.unit, category: i.category,
        currentStock: i.current_stock ?? 0, parLevel: i.par_level,
        deficit: i.par_level != null ? Math.max(0, i.par_level - (i.current_stock ?? 0)) : null,
        belowPar: i.par_level != null && (i.current_stock ?? 0) < i.par_level,
      }));
      if (input.thresholdMode !== "min") items = items.filter((i: any) => i.belowPar);
      const pagination = buildPaginationMeta(limit, offset, items.length);
      return { text: `${items.length} low stock item(s).`, envelope: buildEnvelope(ctx, { status: "ok", data: { items: items.slice(0, limit), locationId: input.locationId }, pagination, meta: { totalCount: count } }) };
    }

    case "josephine_inventory_item_history": {
      const { limit, offset } = resolvePagination(input as any);
      const { data, error, count } = await admin.from("stock_movements").select("id, movement_type, quantity, unit, cost, notes, created_at", { count: "exact" }).eq("location_id", input.locationId).eq("item_id", input.itemId).gte("created_at", input.fromISO + "T00:00:00Z").lte("created_at", input.toISO + "T23:59:59Z").order("created_at", { ascending: false }).range(offset, offset + limit);
      if (error) return { text: `Failed: ${error.message}`, envelope: buildEnvelope(ctx, { status: "error", data: null, errors: [{ code: ErrorCode.UPSTREAM_ERROR, message: error.message }] }) };
      const movements = (data ?? []).map((m: any) => ({ id: m.id, type: m.movement_type, quantity: Number(m.quantity), unit: m.unit, cost: m.cost != null ? Number(m.cost) : null, notes: m.notes, createdAt: m.created_at }));
      const pagination = buildPaginationMeta(limit, offset, movements.length);
      return { text: `${count ?? movements.length} movement(s).`, envelope: buildEnvelope(ctx, { status: "ok", data: { movements: movements.slice(0, limit), period: { from: input.fromISO, to: input.toISO } }, pagination, meta: { totalCount: count } }) };
    }

    case "josephine_etl_last_runs": {
      const { limit, offset } = resolvePagination(input as any);
      let query = admin.from("integration_sync_runs").select("id, integration_account_id, started_at, ended_at, status, stats, error_text", { count: "exact" }).order("started_at", { ascending: false }).range(offset, offset + limit);
      if (input.status) {
        const statusMap: Record<string, string[]> = { success: ["ok"], failed: ["error", "partial"], running: ["running"] };
        query = query.in("status", statusMap[input.status as string] ?? [input.status as string]);
      }
      const { data, error, count } = await query;
      if (error) return { text: `Failed: ${error.message}`, envelope: buildEnvelope(ctx, { status: "error", data: null, errors: [{ code: ErrorCode.UPSTREAM_ERROR, message: error.message }] }) };
      const runs = (data ?? []).map((r: any) => ({ id: r.id, startedAt: r.started_at, endedAt: r.ended_at, status: r.status, stats: r.stats, errorText: r.error_text }));
      const pagination = buildPaginationMeta(limit, offset, runs.length);
      return { text: `${count ?? runs.length} run(s).`, envelope: buildEnvelope(ctx, { status: "ok", data: { runs: runs.slice(0, limit) }, pagination, meta: { totalCount: count } }) };
    }

    case "josephine_data_quality_report": {
      const locationIds = (input.locationIds as string[]) ?? tenant.locationIds;
      const { data, error } = await (admin.rpc as Function)("audit_data_coherence", { p_org_id: tenant.orgId, p_location_ids: locationIds, p_days: 30 });
      if (error) return { text: `Audit failed: ${error.message}`, envelope: buildEnvelope(ctx, { status: "error", data: null, errors: [{ code: ErrorCode.UPSTREAM_ERROR, message: error.message }] }) };
      const audit = data as Record<string, unknown>;
      return { text: audit?.all_pass ? "All checks passed." : "Issues detected.", envelope: buildEnvelope(ctx, { status: "ok", data: audit }) };
    }

    case "josephine_sales_timeseries": {
      const locationIds = (input.locationIds as string[]) ?? tenant.locationIds;
      const { data, error } = await (admin.rpc as Function)("get_sales_timeseries_unified", { p_org_id: tenant.orgId, p_location_ids: locationIds, p_from: input.fromISO, p_to: input.toISO });
      if (error) return { text: `RPC failed: ${error.message}`, envelope: buildEnvelope(ctx, { status: "error", data: null, errors: [{ code: ErrorCode.UPSTREAM_ERROR, message: error.message }] }) };
      const ts = data as Record<string, unknown> | null;
      const granularity = input.granularity ?? "day";
      type DP = { ts: string; actualSales: number; forecastSales: number; actualOrders: number };
      const series: DP[] = [];
      if (granularity === "hour") {
        for (const h of ((ts?.hourly ?? []) as any[])) {
          series.push({ ts: String(h.ts_hour), actualSales: Number(h.actual_sales) || 0, forecastSales: Number(h.forecast_sales) || 0, actualOrders: Number(h.actual_orders) || 0 });
        }
      } else {
        let daily = (ts?.daily ?? []) as any[];
        if (daily.length === 0) {
          const hourly = (ts?.hourly ?? []) as any[];
          const buckets = new Map<string, { s: number; o: number; fs: number }>();
          for (const h of hourly) {
            const d = new Date(String(h.ts_hour));
            const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
            const prev = buckets.get(key) ?? { s: 0, o: 0, fs: 0 };
            prev.s += Number(h.actual_sales) || 0; prev.o += Number(h.actual_orders) || 0; prev.fs += Number(h.forecast_sales) || 0;
            buckets.set(key, prev);
          }
          daily = Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, actual_sales: v.s, actual_orders: v.o, forecast_sales: v.fs }));
        }
        for (const d of daily) series.push({ ts: String(d.date), actualSales: Math.round((Number(d.actual_sales) || 0) * 100) / 100, forecastSales: Math.round((Number(d.forecast_sales) || 0) * 100) / 100, actualOrders: Number(d.actual_orders) || 0 });
      }
      return { text: `${series.length} data points.`, envelope: buildEnvelope(ctx, { status: "ok", data: { granularity, series }, meta: { pointCount: series.length } }) };
    }

    case "josephine_purchases_build_po_suggestion": {
      const { data: loc } = await admin.from("locations").select("group_id, name").eq("id", input.locationId).single();
      if (!loc) return { text: "Location not found.", envelope: buildEnvelope(ctx, { status: "error", data: null, errors: [{ code: ErrorCode.NOT_FOUND, message: "Location not found." }] }) };
      const { data: items } = await admin.from("inventory_items").select("id, name, unit, current_stock, par_level, last_cost, category").eq("group_id", loc.group_id).not("par_level", "is", null).order("name").limit(Number(input.maxItems) || 50);
      const belowPar = (items ?? []).filter((i: any) => (i.current_stock ?? 0) < (i.par_level ?? 0)).map((i: any) => {
        const deficit = (i.par_level ?? 0) - (i.current_stock ?? 0);
        return { itemId: i.id, itemName: i.name, unit: i.unit ?? "units", currentStock: i.current_stock ?? 0, parLevel: i.par_level ?? 0, suggestedQty: deficit, estimatedCost: deficit * (i.last_cost ?? 0) };
      });
      return { text: `${belowPar.length} item(s) below par.`, envelope: buildEnvelope(ctx, { status: "ok", data: { source: "par_level_analysis", locationId: input.locationId, lines: belowPar } }) };
    }

    default:
      return { text: `Read tool ${toolName} not implemented in dispatcher.`, envelope: buildEnvelope(ctx, { status: "not_supported", data: null, errors: [{ code: ErrorCode.NOT_SUPPORTED, message: `Tool ${toolName} is not yet available in the Edge dispatcher.` }] }) };
  }
}

async function executeWriteTool(
  toolName: ToolName,
  input: Record<string, unknown>,
  admin: ReturnType<typeof createClient>,
  tenant: ResolvedTenant,
): Promise<{ text: string; envelope: ToolEnvelope }> {
  const ctx = startContext(toolName);

  // Inject actor from JWT (never from client)
  const writeInput: Record<string, unknown> = {
    ...input,
    actor: { name: tenant.fullName, role: tenant.role },
  };

  // Estimate rows for bulk-cap
  let estimatedRows = 1;
  if (toolName === "josephine_purchases_create_po" && Array.isArray(input.lines)) {
    estimatedRows = 1 + (input.lines as unknown[]).length;
  }
  if (toolName === "josephine_inventory_adjust_onhand") estimatedRows = 2;

  const guard = await writeGuard(ctx, writeInput as WriteInput, writeInput, admin, { estimatedRows });
  if (guard.action !== "execute") {
    return { text: guard.text!, envelope: guard.envelope! };
  }

  const guardCtx = guard.guardCtx!;

  switch (toolName) {
    case "josephine_locations_upsert": {
      const loc = input.location as Record<string, unknown>;
      let groupId = tenant.orgId;
      if (!groupId) return { text: "No org found.", envelope: buildEnvelope(ctx, { status: "error", data: null, errors: [{ code: ErrorCode.NOT_FOUND, message: "No org." }], meta: { execution: "preview" } }) };
      const upsertData = {
        ...(loc.id && { id: loc.id }),
        group_id: groupId,
        name: loc.name,
        timezone: loc.timezone ?? "Europe/Madrid",
        city: loc.city ?? null,
        currency: loc.currency ?? "EUR",
        active: loc.status !== "inactive",
      };
      const { data, error } = loc.id
        ? await admin.from("locations").update(upsertData).eq("id", loc.id).select().single()
        : await admin.from("locations").insert(upsertData).select().single();
      if (error) { recordWriteError(toolName); return { text: `Failed: ${error.message}`, envelope: buildEnvelope(ctx, { status: "error", data: null, errors: [{ code: ErrorCode.UPSTREAM_ERROR, message: error.message }], meta: { execution: "preview" } }) }; }
      await finalizeWrite(admin, guardCtx, data);
      return { text: `Location "${data.name}" ${loc.id ? "updated" : "created"}.`, envelope: buildEnvelope(ctx, { status: "ok", data: { location: data }, meta: { execution: "executed", rowsTouched: 1 } }) };
    }

    case "josephine_inventory_upsert_item": {
      const item = input.item as Record<string, unknown>;
      const upsertData = {
        ...(item.id && { id: item.id }),
        group_id: tenant.orgId,
        name: item.name,
        unit: item.unit ?? null,
        category: item.category ?? null,
        par_level: item.par ?? null,
        current_stock: item.currentStock ?? null,
        last_cost: item.lastCost ?? null,
      };
      const { data, error } = item.id
        ? await admin.from("inventory_items").update(upsertData).eq("id", item.id).select().single()
        : await admin.from("inventory_items").insert(upsertData).select().single();
      if (error) { recordWriteError(toolName); return { text: `Failed: ${error.message}`, envelope: buildEnvelope(ctx, { status: "error", data: null, errors: [{ code: ErrorCode.UPSTREAM_ERROR, message: error.message }], meta: { execution: "preview" } }) }; }
      await finalizeWrite(admin, guardCtx, data);
      return { text: `Item "${data.name}" ${item.id ? "updated" : "created"}.`, envelope: buildEnvelope(ctx, { status: "ok", data: { item: data }, meta: { execution: "executed", rowsTouched: 1 } }) };
    }

    case "josephine_inventory_adjust_onhand": {
      if (input.newOnHand == null && input.delta == null) return { text: "Need newOnHand or delta.", envelope: buildEnvelope(ctx, { status: "error", data: null, errors: [{ code: ErrorCode.INVALID_INPUT, message: "Provide newOnHand or delta." }] }) };
      const { data: item } = await admin.from("inventory_items").select("id, name, current_stock, unit").eq("id", input.itemId).single();
      if (!item) return { text: "Item not found.", envelope: buildEnvelope(ctx, { status: "error", data: null, errors: [{ code: ErrorCode.NOT_FOUND, message: "Item not found." }] }) };
      const prev = Number(item.current_stock) || 0;
      const newStock = input.newOnHand != null ? Number(input.newOnHand) : prev + (Number(input.delta) ?? 0);
      const delta = newStock - prev;
      await admin.from("stock_movements").insert({ location_id: input.locationId, item_id: input.itemId, movement_type: "adjustment", quantity: delta, unit: input.unit ?? item.unit ?? "units", notes: input.reason ?? "AI tools adjustment", cost: 0 });
      const { error } = await admin.from("inventory_items").update({ current_stock: newStock }).eq("id", input.itemId);
      if (error) { recordWriteError(toolName); return { text: `Update failed: ${error.message}`, envelope: buildEnvelope(ctx, { status: "error", data: null, errors: [{ code: ErrorCode.UPSTREAM_ERROR, message: error.message }], meta: { execution: "preview" } }) }; }
      const result = { itemId: input.itemId, itemName: item.name, previousStock: prev, newStock, delta };
      await finalizeWrite(admin, guardCtx, result);
      return { text: `Stock adjusted: ${prev} → ${newStock}.`, envelope: buildEnvelope(ctx, { status: "ok", data: result, meta: { execution: "executed", rowsTouched: 2 } }) };
    }

    case "josephine_purchases_create_po": {
      const lines = input.lines as Array<Record<string, unknown>>;
      const { data: loc } = await admin.from("locations").select("group_id, name").eq("id", input.locationId).single();
      if (!loc) return { text: "Location not found.", envelope: buildEnvelope(ctx, { status: "error", data: null, errors: [{ code: ErrorCode.NOT_FOUND, message: "Location not found." }], meta: { execution: "preview" } }) };
      const { data: supplier } = await admin.from("suppliers").select("id, name").eq("id", input.supplierId).single();
      if (!supplier) return { text: "Supplier not found.", envelope: buildEnvelope(ctx, { status: "error", data: null, errors: [{ code: ErrorCode.NOT_FOUND, message: "Supplier not found." }], meta: { execution: "preview" } }) };
      const { data: po, error: poErr } = await admin.from("purchase_orders").insert({ group_id: loc.group_id, location_id: input.locationId, supplier_id: input.supplierId, status: "draft" }).select().single();
      if (poErr || !po) { recordWriteError(toolName); return { text: `PO failed: ${poErr?.message}`, envelope: buildEnvelope(ctx, { status: "error", data: null, errors: [{ code: ErrorCode.UPSTREAM_ERROR, message: poErr?.message ?? "error" }], meta: { execution: "preview" } }) }; }
      const lineRecords = lines.map((l) => ({ purchase_order_id: po.id, inventory_item_id: l.itemId, quantity: l.qty, unit_cost: l.priceEstimate ?? null }));
      const { data: insertedLines, error: lineErr } = await admin.from("purchase_order_lines").insert(lineRecords).select();
      if (lineErr) { recordWriteError(toolName); return { text: `Lines failed: ${lineErr.message}`, envelope: buildEnvelope(ctx, { status: "error", data: { purchaseOrderId: po.id }, errors: [{ code: ErrorCode.UPSTREAM_ERROR, message: lineErr.message }], meta: { execution: "preview" } }) }; }
      const result = { purchaseOrder: { id: po.id, status: "draft", supplierName: supplier.name }, lines: (insertedLines ?? []).length, totals: { lineCount: lines.length } };
      await finalizeWrite(admin, guardCtx, result);
      return { text: `PO ${po.id} created.`, envelope: buildEnvelope(ctx, { status: "ok", data: result, meta: { execution: "executed", rowsTouched: 1 + lines.length } }) };
    }

    case "josephine_settings_update": {
      const patch = input.patch as Record<string, unknown>;
      const ALLOWED = new Set(["target_gp_percent", "target_col_percent", "default_cogs_percent", "default_hourly_cost"]);
      const bad = Object.keys(patch).filter((k) => !ALLOWED.has(k));
      if (bad.length > 0) return { text: `Invalid keys: ${bad.join(", ")}`, envelope: buildEnvelope(ctx, { status: "error", data: null, errors: [{ code: ErrorCode.INVALID_INPUT, message: `Keys not allowed: ${bad.join(", ")}` }] }) };
      const { data: existing } = await admin.from("location_settings").select("id").eq("location_id", input.locationId).maybeSingle();
      const { data, error } = existing
        ? await admin.from("location_settings").update(patch).eq("location_id", input.locationId).select().single()
        : await admin.from("location_settings").insert({ location_id: input.locationId, ...patch }).select().single();
      if (error) { recordWriteError(toolName); return { text: `Failed: ${error.message}`, envelope: buildEnvelope(ctx, { status: "error", data: null, errors: [{ code: ErrorCode.UPSTREAM_ERROR, message: error.message }], meta: { execution: "preview" } }) }; }
      await finalizeWrite(admin, guardCtx, data);
      return { text: `Settings updated.`, envelope: buildEnvelope(ctx, { status: "ok", data: { settings: data }, meta: { execution: "executed", rowsTouched: 1 } }) };
    }

    case "josephine_etl_trigger_sync": {
      const SUPPORTED = new Set(["square-sync", "process-raw-events", "run_etl", "pos_import"]);
      if (!SUPPORTED.has(input.source as string)) return { text: `Unsupported source.`, envelope: buildEnvelope(ctx, { status: "not_supported", data: null, errors: [{ code: ErrorCode.NOT_SUPPORTED, message: `Source '${input.source}' not supported.` }] }) };
      const body: Record<string, unknown> = {};
      if (input.locationId) body.location_id = input.locationId;
      const { data, error } = await admin.functions.invoke(input.source as string, { body });
      if (error) { recordWriteError(toolName); return { text: `ETL failed: ${error.message}`, envelope: buildEnvelope(ctx, { status: "error", data: null, errors: [{ code: ErrorCode.UPSTREAM_ERROR, message: error.message }], meta: { execution: "preview" } }) }; }
      await finalizeWrite(admin, guardCtx, { source: input.source, response: data });
      return { text: `ETL '${input.source}' triggered.`, envelope: buildEnvelope(ctx, { status: "ok", data: { source: input.source, response: data }, meta: { execution: "executed", rowsTouched: 0 } }) };
    }

    case "josephine_sales_backfill_ingest":
      return { text: "Not supported.", envelope: buildEnvelope(ctx, { status: "not_supported", data: null, errors: [{ code: ErrorCode.NOT_SUPPORTED, message: "Sales backfill is not supported via this dispatcher." }] }) };

    default:
      return { text: `Write tool ${toolName} not implemented.`, envelope: buildEnvelope(ctx, { status: "not_supported", data: null, errors: [{ code: ErrorCode.NOT_SUPPORTED, message: `Tool ${toolName} not available.` }] }) };
  }
}

// ── Main handler ─────────────────────────────────────────────────

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), { status: 405, headers: CORS_HEADERS });
  }

  const requestId = generateUUID();
  const startMs = performance.now();

  try {
    // Parse body
    const body = await req.json() as { toolName?: string; input?: Record<string, unknown> };
    const { toolName, input } = body;

    if (!toolName || typeof toolName !== "string") {
      const available = Object.keys(TOOL_VERSIONS);
      return new Response(JSON.stringify({
        status: "error",
        requestId,
        errors: [{ code: ErrorCode.INVALID_INPUT, message: "Missing 'toolName' in request body.", hint: `Available tools: ${available.join(", ")}` }],
      }), { status: 400, headers: CORS_HEADERS });
    }

    if (!(toolName in TOOL_VERSIONS)) {
      return new Response(JSON.stringify({
        status: "not_supported",
        requestId,
        errors: [{ code: ErrorCode.NOT_SUPPORTED, message: `Tool '${toolName}' does not exist.`, hint: `Available: ${Object.keys(TOOL_VERSIONS).join(", ")}` }],
      }), { status: 400, headers: CORS_HEADERS });
    }

    // Auth: read JWT from Authorization header
    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({
        status: "error",
        requestId,
        errors: [{ code: ErrorCode.UNAUTHORIZED, message: "Missing or invalid Authorization header.", hint: "Add header: Authorization: Bearer <supabase-jwt>" }],
      }), { status: 401, headers: CORS_HEADERS });
    }

    const jwt = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? serviceRoleKey;

    // User client (JWT-scoped, RLS applies)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Admin client (service_role, bypasses RLS)
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Resolve tenant from JWT
    let tenant: ResolvedTenant;
    try {
      tenant = await resolveTenant(userClient, adminClient);
    } catch (e) {
      if (e instanceof AuthError) {
        return new Response(JSON.stringify({
          status: "error",
          requestId,
          errors: [{ code: ErrorCode.UNAUTHORIZED, message: e.message }],
        }), { status: 401, headers: CORS_HEADERS });
      }
      throw e;
    }

    const tn = toolName as ToolName;
    const meta = TOOL_METADATA[tn];

    // RBAC: check permission if required
    if (meta.permissionKey) {
      const locationId = (input?.locationId as string) ?? undefined;
      const hasPermission = await checkPermission(adminClient, tenant.userId, meta.permissionKey, locationId);
      if (!hasPermission) {
        return new Response(JSON.stringify({
          status: "error",
          requestId,
          errors: [{ code: ErrorCode.FORBIDDEN, message: `Permission '${meta.permissionKey}' denied for this user.`, hint: "Contact your administrator for access." }],
        }), { status: 403, headers: CORS_HEADERS });
      }
    }

    // Location validation: if tool requires location and input has one, verify it's in tenant's allowlist
    if (meta.requiresLocation && input?.locationId) {
      if (!tenant.locationIds.includes(input.locationId as string)) {
        return new Response(JSON.stringify({
          status: "error",
          requestId,
          errors: [{ code: ErrorCode.FORBIDDEN, message: `Location ${input.locationId} is not in your allowed locations.` }],
        }), { status: 403, headers: CORS_HEADERS });
      }
    }

    // Execute tool
    const toolInput = input ?? {};
    let result: { text: string; envelope: ToolEnvelope };

    if (meta.isWrite) {
      result = await executeWriteTool(tn, toolInput, adminClient, tenant);
    } else {
      result = await executeReadTool(tn, toolInput, adminClient, tenant);
    }

    // Return envelope
    const durationMs = Math.round(performance.now() - startMs);
    const envelope = { ...result.envelope, durationMs };

    return new Response(JSON.stringify(envelope), {
      status: result.envelope.status === "error" ? 400 : 200,
      headers: CORS_HEADERS,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ai-tools] Unhandled error:", message);
    return new Response(JSON.stringify({
      status: "error",
      requestId,
      durationMs: Math.round(performance.now() - startMs),
      errors: [{ code: ErrorCode.UPSTREAM_ERROR, message }],
    }), { status: 500, headers: CORS_HEADERS });
  }
});
