/**
 * Shared types for ai-tools-core.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ToolName } from "./lib/version.ts";

/** Tenant context derived from JWT + RPCs. */
export interface TenantContext {
  userId: string;
  orgId: string;
  role: string;
  locationIds: string[];
  permissions: Array<{ key: string; module: string }>;
}

/** Clients injected into tool handlers. */
export interface ToolClients {
  /** service_role client — for writes after authorization */
  admin: SupabaseClient;
  /** user JWT client — for permission checks / user-scoped reads */
  user: SupabaseClient;
}

/** Tool handler execution context. */
export interface ToolExecutionContext {
  tenant: TenantContext;
  clients: ToolClients;
}

/** Opaque context produced by writeGuard when action="execute". */
export interface GuardContext {
  readonly __brand: "GuardContext";
  readonly toolName: ToolName;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly reason: string;
  readonly actor: Record<string, unknown> | null;
}

export type Execution = "executed" | "replay" | "preview";

/** Tool registry metadata. */
export interface ToolMeta {
  name: ToolName;
  description: string;
  isWrite: boolean;
  /** Permission key for RBAC check. null = no permission needed (read-only public). */
  permissionKey: string | null;
  /** Whether the tool requires a locationId in input for RBAC scoping. */
  requiresLocation: boolean;
  toolVersion: string;
}
