import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/**
 * Singleton Supabase client for the MCP server.
 *
 * Reads from env vars (loaded by dotenv in server.ts entrypoint):
 *   - SUPABASE_URL (required)
 *   - SUPABASE_SERVICE_ROLE_KEY (preferred — bypasses RLS)
 *   - SUPABASE_ANON_KEY (fallback — RLS applies, writes may fail)
 */
export function getSupabase(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error(
      "SUPABASE_URL is not set. Add it to /mcp/josephine-mcp/.env.local",
    );
  }

  const key = serviceKey ?? anonKey;
  if (!key) {
    throw new Error(
      "Neither SUPABASE_SERVICE_ROLE_KEY nor SUPABASE_ANON_KEY is set. " +
        "Add one to /mcp/josephine-mcp/.env.local",
    );
  }

  if (!serviceKey) {
    console.warn(
      "[josephine-mcp] Using ANON key — RLS applies. " +
        "Write operations may fail. Use SERVICE_ROLE_KEY for full access.",
    );
  }

  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return _client;
}
