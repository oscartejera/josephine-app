/**
 * MCP adapter for version — reads package.json and injects into core.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { setServerVersion } from "../../../../src/ai-tools-core/lib/version.ts";

export { TOOL_VERSIONS, getServerVersion } from "../../../../src/ai-tools-core/lib/version.ts";
export type { ToolName } from "../../../../src/ai-tools-core/lib/version.ts";

// Read server version from package.json and inject into core
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, "../../package.json"), "utf-8"),
);
export const SERVER_VERSION: string = pkg.version ?? "0.0.0";
setServerVersion(SERVER_VERSION);
