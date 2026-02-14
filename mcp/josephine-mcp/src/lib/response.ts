/**
 * Re-exports from shared ai-tools-core + MCP-specific toMcpResult.
 */
export { startContext, buildEnvelope } from "../../../../src/ai-tools-core/lib/response.ts";
export type { ToolEnvelope, ResponseContext } from "../../../../src/ai-tools-core/lib/response.ts";
import type { ToolEnvelope } from "../../../../src/ai-tools-core/lib/response.ts";

/**
 * Format a tool envelope into the two-channel MCP SDK response:
 *   - text: brief human-readable summary
 *   - structuredContent: full JSON envelope
 *
 * This is MCP-specific and not in the shared core.
 */
export function toMcpResult(
  textSummary: string,
  envelope: ToolEnvelope,
): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [
      { type: "text" as const, text: textSummary },
      {
        type: "text" as const,
        text: "```json\n" + JSON.stringify(envelope, null, 2) + "\n```",
      },
    ],
  };
}
