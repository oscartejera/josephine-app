import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Send Schedule Published Notification
 * Sends an email to all employees affected when a manager publishes a schedule.
 * 
 * POST body: { schedule_week: "2026-03-10", location_id: "uuid" }
 */

interface SchedulePublishedRequest {
    schedule_week: string;  // Monday of the week (YYYY-MM-DD)
    location_id: string;
}

async function sendEmail(to: string, subject: string, html: string) {
    const key = Deno.env.get("RESEND_API_KEY");
    if (!key) throw new Error("RESEND_API_KEY not configured");
    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
            from: Deno.env.get("EMAIL_FROM") || "Josephine <josephine@josephine-ai.com>",
            to: [to],
            subject,
            html,
        }),
    });
    if (!res.ok) throw new Error(`Resend: ${res.status} - ${await res.text()}`);
    return res.json();
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );

        const { schedule_week, location_id }: SchedulePublishedRequest = await req.json();
        if (!schedule_week || !location_id) {
            return new Response(
                JSON.stringify({ error: "schedule_week and location_id are required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
        }

        // Get location name
        const { data: location } = await supabase
            .from("locations")
            .select("name")
            .eq("id", location_id)
            .single();
        const locationName = location?.name || "Tu restaurante";

        // Parse week range
        const weekStart = new Date(schedule_week);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const weekStartStr = weekStart.toLocaleDateString("es-ES", { day: "numeric", month: "long" });
        const weekEndStr = weekEnd.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

        // Get all shifts for this week + location (to find affected employees)
        const { data: shifts } = await supabase
            .from("shifts")
            .select("employee_id, shift_date, start_time, end_time")
            .eq("location_id", location_id)
            .gte("shift_date", schedule_week)
            .lte("shift_date", weekEnd.toISOString().split("T")[0]);

        if (!shifts || shifts.length === 0) {
            return new Response(
                JSON.stringify({ success: true, sent: 0, message: "No shifts found for this week" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
        }

        // Group shifts by employee
        const employeeShifts = new Map<string, Array<{ date: string; start: string; end: string }>>();
        for (const s of shifts) {
            const list = employeeShifts.get(s.employee_id) || [];
            list.push({ date: s.shift_date, start: s.start_time, end: s.end_time });
            employeeShifts.set(s.employee_id, list);
        }

        // Get employee emails + names
        const employeeIds = Array.from(employeeShifts.keys());
        const { data: employees } = await supabase
            .from("employees")
            .select("id, first_name, last_name, email")
            .in("id", employeeIds);

        let sent = 0;
        let failed = 0;

        for (const emp of employees || []) {
            if (!emp.email) continue;
            const myShifts = employeeShifts.get(emp.id) || [];
            myShifts.sort((a, b) => a.date.localeCompare(b.date));

            // Build shift list HTML
            const shiftRows = myShifts
                .map((s) => {
                    const dayName = new Date(s.date).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" });
                    return `<tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${dayName}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${s.start.substring(0, 5)} - ${s.end.substring(0, 5)}</td>
          </tr>`;
                })
                .join("");

            const subject = `📅 Tu horario está listo — ${weekStartStr} al ${weekEndStr}`;
            const html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f4f4f5;">
          <div style="max-width: 520px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,.1);">
            <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 28px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 22px;">📅 Horario Publicado</h1>
              <p style="color: rgba(255,255,255,.85); margin: 8px 0 0; font-size: 14px;">${locationName}</p>
            </div>
            <div style="padding: 28px;">
              <p style="color: #374151; font-size: 16px;">Hola <strong>${emp.first_name}</strong>,</p>
              <p style="color: #374151; font-size: 15px;">Tu horario para la semana del <strong>${weekStartStr}</strong> al <strong>${weekEndStr}</strong> ya está disponible:</p>
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f9fafb; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background: #7c3aed; color: white;">
                    <th style="padding: 10px 12px; text-align: left; font-size: 13px;">Día</th>
                    <th style="padding: 10px 12px; text-align: center; font-size: 13px;">Turno</th>
                  </tr>
                </thead>
                <tbody>${shiftRows}</tbody>
              </table>
              <p style="color: #6b7280; font-size: 13px;">Si tienes alguna duda sobre tu horario, contacta con tu manager.</p>
            </div>
            <div style="background: #f9fafb; padding: 14px 28px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Josephine · ${locationName}</p>
            </div>
          </div>
        </body>
        </html>
      `;

            try {
                await sendEmail(emp.email, subject, html);
                sent++;
            } catch (e) {
                console.error(`[schedule] Failed to send to ${emp.email}:`, e);
                failed++;
            }
        }

        console.log(`[schedule-published] Sent ${sent}, failed ${failed} for week ${schedule_week}`);
        return new Response(
            JSON.stringify({ success: true, sent, failed }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        console.error("[schedule-published] Error:", msg);
        return new Response(
            JSON.stringify({ error: msg }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }
});
