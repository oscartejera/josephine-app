/**
 * Tool registry: maps toolName → handler + RBAC metadata.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { TOOL_VERSIONS, type ToolName } from "./lib/version.ts";
import type { ToolMeta } from "./types.ts";
import type { ToolEnvelope } from "./lib/response.ts";

/** Common tool handler signature. */
export type ToolHandler = (
  input: Record<string, unknown>,
  supabase: SupabaseClient,
) => Promise<{ text: string; envelope: ToolEnvelope }>;

interface RegistryEntry {
  meta: ToolMeta;
  handler: ToolHandler;
}

const registry = new Map<string, RegistryEntry>();

export function registerToolHandler(meta: ToolMeta, handler: ToolHandler): void {
  registry.set(meta.name, { meta, handler });
}

export function getToolEntry(name: string): RegistryEntry | undefined {
  return registry.get(name);
}

export function listTools(): ToolMeta[] {
  return Array.from(registry.values()).map((e) => e.meta);
}

export function listToolNames(): string[] {
  return Array.from(registry.keys());
}

// ── Tool metadata (RBAC) ────────────────────────────────────────

export const TOOL_METADATA: Record<ToolName, Omit<ToolMeta, "name" | "toolVersion">> = {
  josephine_locations_list: {
    description: "List all restaurant locations",
    isWrite: false,
    permissionKey: null,
    requiresLocation: false,
  },
  josephine_sales_summary: {
    description: "Get aggregated sales KPIs for a date range",
    isWrite: false,
    permissionKey: "sales:read",
    requiresLocation: false,
  },
  josephine_sales_timeseries: {
    description: "Get sales timeseries data at hourly/daily/weekly granularity",
    isWrite: false,
    permissionKey: "sales:read",
    requiresLocation: false,
  },
  josephine_inventory_low_stock: {
    description: "List inventory items below par level",
    isWrite: false,
    permissionKey: "inventory:read",
    requiresLocation: true,
  },
  josephine_inventory_item_history: {
    description: "Get stock movement history for an item",
    isWrite: false,
    permissionKey: "inventory:read",
    requiresLocation: true,
  },
  josephine_settings_get: {
    description: "Get location settings",
    isWrite: false,
    permissionKey: null,
    requiresLocation: false,
  },
  josephine_etl_last_runs: {
    description: "List recent ETL sync runs",
    isWrite: false,
    permissionKey: null,
    requiresLocation: false,
  },
  josephine_data_quality_report: {
    description: "Run data quality audit",
    isWrite: false,
    permissionKey: null,
    requiresLocation: false,
  },
  josephine_locations_upsert: {
    description: "Create or update a restaurant location",
    isWrite: true,
    permissionKey: "locations:write",
    requiresLocation: false,
  },
  josephine_inventory_upsert_item: {
    description: "Create or update an inventory item",
    isWrite: true,
    permissionKey: "inventory:write",
    requiresLocation: false,
  },
  josephine_inventory_adjust_onhand: {
    description: "Adjust on-hand stock for an inventory item",
    isWrite: true,
    permissionKey: "inventory:write",
    requiresLocation: true,
  },
  josephine_purchases_build_po_suggestion: {
    description: "Generate purchase order suggestion (read-only)",
    isWrite: false,
    permissionKey: "purchases:read",
    requiresLocation: true,
  },
  josephine_purchases_create_po: {
    description: "Create a purchase order with line items",
    isWrite: true,
    permissionKey: "purchases:create",
    requiresLocation: true,
  },
  josephine_settings_update: {
    description: "Update location settings",
    isWrite: true,
    permissionKey: "settings:write",
    requiresLocation: true,
  },
  josephine_etl_trigger_sync: {
    description: "Trigger an ETL sync via edge functions",
    isWrite: true,
    permissionKey: "integrations:write",
    requiresLocation: false,
  },
  josephine_sales_backfill_ingest: {
    description: "Backfill historical sales data (NOT_SUPPORTED)",
    isWrite: true,
    permissionKey: "sales:write",
    requiresLocation: false,
  },
};

/** Build full ToolMeta from name. */
export function buildToolMeta(name: ToolName): ToolMeta {
  const m = TOOL_METADATA[name];
  return {
    name,
    toolVersion: TOOL_VERSIONS[name],
    ...m,
  };
}
