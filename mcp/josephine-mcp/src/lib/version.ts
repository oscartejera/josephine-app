import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, "../../package.json"), "utf-8"),
);

export const SERVER_VERSION: string = pkg.version ?? "0.0.0";

/** Per-tool version constants. Bump when a tool's contract changes. */
export const TOOL_VERSIONS = {
  josephine_locations_list: "v1",
  josephine_sales_summary: "v1",
  josephine_sales_timeseries: "v1",
  josephine_inventory_low_stock: "v1",
  josephine_inventory_item_history: "v1",
  josephine_settings_get: "v1",
  josephine_etl_last_runs: "v1",
  josephine_data_quality_report: "v1",
  josephine_locations_upsert: "v1",
  josephine_inventory_upsert_item: "v1",
  josephine_inventory_adjust_onhand: "v1",
  josephine_purchases_build_po_suggestion: "v1",
  josephine_purchases_create_po: "v1",
  josephine_settings_update: "v1",
  josephine_etl_trigger_sync: "v1",
  josephine_sales_backfill_ingest: "v1",
} as const;

export type ToolName = keyof typeof TOOL_VERSIONS;
