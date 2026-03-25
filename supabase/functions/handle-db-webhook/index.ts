/**
 * handle-db-webhook — Database Webhook Router
 *
 * Receives Supabase database webhook payloads and translates them
 * into push notification requests for the `send-push` Edge Function.
 *
 * Supported tables:
 *   - shift_swap_requests (INSERT → notify target, UPDATE → notify requester)
 *   - announcements       (INSERT → notify all employees at location)
 *   - planned_shifts      (INSERT → notify assigned employee)
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── Types ────────────────────────────────────────────────

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: Record<string, unknown>;
  old_record: Record<string, unknown> | null;
}

interface PushRequest {
  type: string;
  employee_ids?: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

// ─── Handlers per table ───────────────────────────────────

async function handleSwapRequest(
  payload: WebhookPayload,
  supabase: ReturnType<typeof createClient>
): Promise<PushRequest | null> {
  const record = payload.record;
  const requesterId = record.requester_id as string;
  const targetId = record.target_id as string;

  // Helper: get employee name
  async function getEmployeeName(employeeId: string): Promise<string> {
    const { data } = await supabase
      .from("employees")
      .select("first_name")
      .eq("id", employeeId)
      .single();
    return data?.first_name || "Un compañero";
  }

  if (payload.type === "INSERT") {
    // New swap request → notify the target employee
    const requesterName = await getEmployeeName(requesterId);
    return {
      type: "swap_request_new",
      employee_ids: [targetId],
      title: "Solicitud de cambio de turno",
      body: `${requesterName} quiere intercambiar un turno contigo`,
      data: { swap_request_id: record.id, screen: "schedule" },
    };
  }

  if (payload.type === "UPDATE") {
    const status = record.status as string;
    const oldStatus = payload.old_record?.status as string | undefined;

    // Only notify on actual status change
    if (oldStatus === status) return null;

    if (status === "approved") {
      return {
        type: "swap_request_approved",
        employee_ids: [requesterId],
        title: "Cambio de turno aprobado ✅",
        body: "Tu solicitud de cambio de turno ha sido aprobada",
        data: { swap_request_id: record.id, screen: "schedule" },
      };
    }

    if (status === "rejected") {
      return {
        type: "swap_request_rejected",
        employee_ids: [requesterId],
        title: "Cambio de turno rechazado",
        body: "Tu solicitud de cambio de turno ha sido rechazada",
        data: { swap_request_id: record.id, screen: "schedule" },
      };
    }
  }

  return null;
}

async function handleAnnouncement(
  payload: WebhookPayload,
  supabase: ReturnType<typeof createClient>
): Promise<PushRequest | null> {
  if (payload.type !== "INSERT") return null;

  const record = payload.record;
  const locationId = record.location_id as string;
  const title = (record.title as string) || "Nuevo anuncio";
  const announcementType = record.type as string | undefined;

  // Get all employee IDs at this location
  const { data: employees } = await supabase
    .from("employees")
    .select("id")
    .eq("location_id", locationId)
    .eq("status", "active");

  if (!employees?.length) return null;

  const typeLabel =
    announcementType === "urgent"
      ? "🔴 Urgente"
      : announcementType === "important"
        ? "🟡 Importante"
        : "📢 Aviso";

  return {
    type: "announcement_new",
    employee_ids: employees.map((e: { id: string }) => e.id),
    title: `${typeLabel}: ${title}`,
    body:
      (record.content as string)?.substring(0, 100) || "Nuevo anuncio publicado",
    data: { announcement_id: record.id, screen: "profile" },
  };
}

async function handlePlannedShift(
  payload: WebhookPayload,
  _supabase: ReturnType<typeof createClient>
): Promise<PushRequest | null> {
  if (payload.type !== "INSERT") return null;

  const record = payload.record;
  const employeeId = record.employee_id as string;
  const shiftDate = record.shift_date as string;
  const startTime = record.start_time as string | undefined;

  if (!employeeId) return null;

  // Format date for display
  const dateStr = shiftDate
    ? new Date(shiftDate).toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "short",
      })
    : "próximamente";

  const timeStr = startTime ? ` a las ${startTime.substring(0, 5)}` : "";

  return {
    type: "new_shift",
    employee_ids: [employeeId],
    title: "Nuevo turno asignado",
    body: `Tienes un nuevo turno el ${dateStr}${timeStr}`,
    data: { shift_id: record.id, screen: "schedule" },
  };
}

// ─── Main Handler ─────────────────────────────────────────

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Parse webhook payload
    const payload: WebhookPayload = await req.json();

    console.log(
      `[handle-db-webhook] ${payload.type} on ${payload.table}`
    );

    // Route to handler based on table
    let pushRequest: PushRequest | null = null;

    switch (payload.table) {
      case "shift_swap_requests":
        pushRequest = await handleSwapRequest(payload, supabase);
        break;
      case "announcements":
        pushRequest = await handleAnnouncement(payload, supabase);
        break;
      case "planned_shifts":
        pushRequest = await handlePlannedShift(payload, supabase);
        break;
      default:
        console.log(
          `[handle-db-webhook] Unknown table: ${payload.table}, ignoring`
        );
    }

    if (!pushRequest) {
      console.log("[handle-db-webhook] No push needed for this event");
      return new Response(
        JSON.stringify({ success: true, pushed: false }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Forward to send-push Edge Function
    console.log(
      `[handle-db-webhook] Sending push: type=${pushRequest.type}, targets=${pushRequest.employee_ids?.length || "all"}`
    );

    const pushResponse = await fetch(
      `${supabaseUrl}/functions/v1/send-push`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pushRequest),
      }
    );

    const pushResult = await pushResponse.json();

    console.log(
      `[handle-db-webhook] send-push result: ${JSON.stringify(pushResult)}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        pushed: true,
        type: pushRequest.type,
        result: pushResult,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[handle-db-webhook] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
