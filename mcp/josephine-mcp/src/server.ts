#!/usr/bin/env node
/**
 * josephine-mcp — MCP server for Josephine restaurant operations platform.
 *
 * Transport: stdio (local)
 * Auth: SUPABASE_SERVICE_ROLE_KEY via env (auto-login, no interactive flow)
 */

import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Load .env.local from the MCP server directory
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });
// Also try the root .env.local as fallback
config({ path: resolve(__dirname, "../../../.env.local") });

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SERVER_VERSION } from "./lib/version.js";

// Import all tools
import * as locationsList from "./tools/locationsList.js";
import * as salesSummary from "./tools/salesSummary.js";
import * as salesTimeseries from "./tools/salesTimeseries.js";
import * as inventoryLowStock from "./tools/inventoryLowStock.js";
import * as inventoryItemHistory from "./tools/inventoryItemHistory.js";
import * as settingsGet from "./tools/settingsGet.js";
import * as etlLastRuns from "./tools/etlLastRuns.js";
import * as dataQualityReport from "./tools/dataQualityReport.js";
import * as locationsUpsert from "./tools/locationsUpsert.js";
import * as inventoryUpsertItem from "./tools/inventoryUpsertItem.js";
import * as inventoryAdjustOnhand from "./tools/inventoryAdjustOnhand.js";
import * as purchasesBuildPoSuggestion from "./tools/purchasesBuildPoSuggestion.js";
import * as purchasesCreatePo from "./tools/purchasesCreatePo.js";
import * as settingsUpdate from "./tools/settingsUpdate.js";
import * as etlTriggerSync from "./tools/etlTriggerSync.js";
import * as salesBackfillIngest from "./tools/salesBackfillIngest.js";

// ── Server setup ──────────────────────────────────────────────

const server = new McpServer({
  name: "josephine-mcp",
  version: SERVER_VERSION,
});

// ── Tool type helper ──────────────────────────────────────────

interface ToolModule {
  name: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputSchema: any;
  execute: (input: unknown) => Promise<unknown>;
}

function registerTool(mod: ToolModule) {
  const shape = mod.inputSchema.shape;
  server.tool(
    mod.name,
    mod.description,
    shape,
    async (args: Record<string, unknown>) => {
      try {
        const parsed = mod.inputSchema.parse(args);
        return (await mod.execute(parsed)) as { content: Array<{ type: "text"; text: string }> };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [
            { type: "text" as const, text: `Error in ${mod.name}: ${message}` },
          ],
        };
      }
    },
  );
}

// ── Register all tools ────────────────────────────────────────

// READ tools
registerTool(locationsList as unknown as ToolModule);
registerTool(salesSummary as unknown as ToolModule);
registerTool(salesTimeseries as unknown as ToolModule);
registerTool(inventoryLowStock as unknown as ToolModule);
registerTool(inventoryItemHistory as unknown as ToolModule);
registerTool(settingsGet as unknown as ToolModule);
registerTool(etlLastRuns as unknown as ToolModule);
registerTool(dataQualityReport as unknown as ToolModule);

// WRITE tools
registerTool(locationsUpsert as unknown as ToolModule);
registerTool(inventoryUpsertItem as unknown as ToolModule);
registerTool(inventoryAdjustOnhand as unknown as ToolModule);
registerTool(purchasesBuildPoSuggestion as unknown as ToolModule);
registerTool(purchasesCreatePo as unknown as ToolModule);
registerTool(settingsUpdate as unknown as ToolModule);
registerTool(etlTriggerSync as unknown as ToolModule);
registerTool(salesBackfillIngest as unknown as ToolModule);

// ── Start ─────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[josephine-mcp] Server v${SERVER_VERSION} started (stdio)`);
  console.error(`[josephine-mcp] SUPABASE_URL: ${process.env.SUPABASE_URL ? "configured" : "MISSING"}`);
  console.error(`[josephine-mcp] SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? "configured" : "MISSING"}`);
  console.error(`[josephine-mcp] JOSEPHINE_MCP_WRITE_ENABLED: ${process.env.JOSEPHINE_MCP_WRITE_ENABLED ?? "false"}`);
}

main().catch((err) => {
  console.error("[josephine-mcp] Fatal error:", err);
  process.exit(1);
});
