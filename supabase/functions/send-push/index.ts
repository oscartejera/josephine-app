/**
 * send-push — APNs Push Notification Sender
 *
 * Sends push notifications to iOS devices via APNs HTTP/2.
 * Called by database webhooks or direct invocation.
 *
 * Request body:
 *   { type, employee_ids, title, body, data? }
 *
 * Required env vars:
 *   APNS_KEY_ID       — Key ID from Apple Developer
 *   APNS_TEAM_ID      — Team ID from Apple Developer
 *   APNS_PRIVATE_KEY   — .p8 private key contents (base64-encoded)
 *   APNS_BUNDLE_ID     — App bundle ID (e.g. com.josephine.team)
 *   APNS_ENVIRONMENT   — 'production' or 'development' (default: development)
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── APNs JWT Token Generation ────────────────────────────

/**
 * Generate a JWT for APNs authentication using ES256 (.p8 key).
 * Token is valid for 1 hour per Apple spec.
 */
async function generateApnsJwt(): Promise<string> {
  const keyId = Deno.env.get("APNS_KEY_ID")!;
  const teamId = Deno.env.get("APNS_TEAM_ID")!;
  const privateKeyBase64 = Deno.env.get("APNS_PRIVATE_KEY")!;

  // Decode the .p8 private key from base64
  const privateKeyPem = atob(privateKeyBase64);

  // Extract the raw key data from PEM format
  const pemLines = privateKeyPem
    .split("\n")
    .filter(
      (line) =>
        !line.startsWith("-----BEGIN") && !line.startsWith("-----END") && line.trim()
    );
  const keyData = Uint8Array.from(atob(pemLines.join("")), (c) =>
    c.charCodeAt(0)
  );

  // Import the ES256 private key
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  // Build JWT header + payload
  const header = { alg: "ES256", kid: keyId };
  const payload = {
    iss: teamId,
    iat: Math.floor(Date.now() / 1000),
  };

  const encode = (obj: Record<string, unknown>) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const encodedHeader = encode(header);
  const encodedPayload = encode(payload);
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  // Sign with ES256
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsignedToken)
  );

  const encodedSignature = btoa(
    String.fromCharCode(...new Uint8Array(signature))
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${unsignedToken}.${encodedSignature}`;
}

// ─── APNs Send ────────────────────────────────────────────

interface ApnsPayload {
  aps: {
    alert: { title: string; body: string };
    badge?: number;
    sound?: string;
    "content-available"?: number;
  };
  type?: string;
  data?: Record<string, unknown>;
}

async function sendToApns(
  token: string,
  payload: ApnsPayload,
  jwt: string,
  bundleId: string,
  environment: string
): Promise<{ token: string; success: boolean; error?: string }> {
  const host =
    environment === "production"
      ? "api.push.apple.com"
      : "api.sandbox.push.apple.com";

  try {
    const res = await fetch(`https://${host}/3/device/${token}`, {
      method: "POST",
      headers: {
        authorization: `bearer ${jwt}`,
        "apns-topic": bundleId,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      return { token, success: true };
    }

    const body = await res.json().catch(() => ({}));

    // If device token is invalid, mark as inactive
    if (res.status === 410 || body.reason === "Unregistered") {
      return { token, success: false, error: "unregistered" };
    }

    return {
      token,
      success: false,
      error: `${res.status}: ${body.reason || "unknown"}`,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { token, success: false, error: message };
  }
}

// ─── Main Handler ─────────────────────────────────────────

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate env vars
    const requiredVars = [
      "APNS_KEY_ID",
      "APNS_TEAM_ID",
      "APNS_PRIVATE_KEY",
      "APNS_BUNDLE_ID",
    ];
    for (const v of requiredVars) {
      if (!Deno.env.get(v)) {
        throw new Error(`Missing env var: ${v}`);
      }
    }

    const bundleId = Deno.env.get("APNS_BUNDLE_ID")!;
    const environment = Deno.env.get("APNS_ENVIRONMENT") || "development";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse request
    const body = await req.json();
    const {
      type,
      employee_ids,
      title,
      body: messageBody,
      data: customData,
    } = body;

    if (!title || !messageBody) {
      return new Response(
        JSON.stringify({ error: "title and body are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(
      `[send-push] type=${type}, employees=${employee_ids?.length || "all"}`
    );

    // Fetch active device tokens
    let query = supabase
      .from("device_tokens")
      .select("token, employee_id")
      .eq("active", true)
      .eq("platform", "ios");

    if (employee_ids?.length) {
      query = query.in("employee_id", employee_ids);
    }

    const { data: tokens, error: dbError } = await query;

    if (dbError) {
      throw new Error(`DB error: ${dbError.message}`);
    }

    if (!tokens?.length) {
      console.log("[send-push] No active device tokens found");
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No tokens" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Generate APNs JWT
    const jwt = await generateApnsJwt();

    // Build APNs payload
    const apnsPayload: ApnsPayload = {
      aps: {
        alert: { title, body: messageBody },
        badge: 1,
        sound: "default",
      },
      ...(type && { type }),
      ...(customData && { data: customData }),
    };

    // Send to all tokens in parallel
    const results = await Promise.allSettled(
      tokens.map((t: { token: string }) =>
        sendToApns(t.token, apnsPayload, jwt, bundleId, environment)
      )
    );

    // Process results — deactivate unregistered tokens
    const unregisteredTokens: string[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const result of results) {
      if (result.status === "fulfilled") {
        if (result.value.success) {
          successCount++;
        } else {
          failCount++;
          if (result.value.error === "unregistered") {
            unregisteredTokens.push(result.value.token);
          }
        }
      } else {
        failCount++;
      }
    }

    // Deactivate unregistered tokens
    if (unregisteredTokens.length > 0) {
      await supabase
        .from("device_tokens")
        .update({ active: false })
        .in("token", unregisteredTokens);

      console.log(
        `[send-push] Deactivated ${unregisteredTokens.length} unregistered tokens`
      );
    }

    console.log(
      `[send-push] Done: ${successCount} sent, ${failCount} failed`
    );

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failCount,
        deactivated: unregisteredTokens.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[send-push] Fatal:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
