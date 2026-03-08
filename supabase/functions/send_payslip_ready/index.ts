import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Send Payslip Ready Notification
 * Notifies an employee that their payslip for a given period is ready.
 * 
 * POST body: { employee_id: "uuid", period: "2026-03", gross_pay: 2400, net_pay: 1920, hours_worked: 176 }
 */

interface PayslipRequest {
    employee_id: string;
    period: string;      // YYYY-MM
    gross_pay: number;
    net_pay: number;
    hours_worked: number;
    deductions?: number;
    bonuses?: number;
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

        const body: PayslipRequest = await req.json();
        const { employee_id, period, gross_pay, net_pay, hours_worked, deductions = 0, bonuses = 0 } = body;

        if (!employee_id || !period) {
            return new Response(
                JSON.stringify({ error: "employee_id and period are required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
        }

        // Get employee info
        const { data: employee, error: empError } = await supabase
            .from("employees")
            .select("first_name, last_name, email, location_id")
            .eq("id", employee_id)
            .single();

        if (empError || !employee) {
            throw new Error(`Employee not found: ${empError?.message}`);
        }

        if (!employee.email) {
            return new Response(
                JSON.stringify({ success: false, message: "Employee has no email" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
        }

        // Get location name
        let locationName = "Tu restaurante";
        if (employee.location_id) {
            const { data: loc } = await supabase
                .from("locations")
                .select("name")
                .eq("id", employee.location_id)
                .single();
            if (loc) locationName = loc.name;
        }

        // Parse period
        const [year, month] = period.split("-");
        const monthName = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });

        const fmt = (n: number) => `€${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        const subject = `💰 Tu nómina de ${monthName} está lista`;
        const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f4f4f5;">
        <div style="max-width: 520px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,.1);">
          <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 28px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 22px;">💰 Nómina Disponible</h1>
            <p style="color: rgba(255,255,255,.85); margin: 8px 0 0; font-size: 14px;">${monthName}</p>
          </div>
          <div style="padding: 28px;">
            <p style="color: #374151; font-size: 16px;">Hola <strong>${employee.first_name}</strong>,</p>
            <p style="color: #374151; font-size: 15px;">Tu nómina de <strong>${monthName}</strong> ya está disponible.</p>
            
            <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #bbf7d0;">
              <div style="text-align: center; margin-bottom: 16px;">
                <p style="color: #6b7280; font-size: 12px; margin: 0; text-transform: uppercase; letter-spacing: 1px;">Salario Neto</p>
                <p style="color: #059669; font-size: 32px; font-weight: 700; margin: 4px 0;">${fmt(net_pay)}</p>
              </div>
              <hr style="border: none; border-top: 1px solid #d1fae5; margin: 16px 0;">
              <table style="width: 100%; font-size: 14px; color: #374151;">
                <tr><td style="padding: 6px 0;">Horas trabajadas</td><td style="text-align: right; font-weight: 600;">${hours_worked}h</td></tr>
                <tr><td style="padding: 6px 0;">Salario bruto</td><td style="text-align: right; font-weight: 600;">${fmt(gross_pay)}</td></tr>
                ${deductions > 0 ? `<tr><td style="padding: 6px 0;">Deducciones</td><td style="text-align: right; color: #dc2626; font-weight: 600;">-${fmt(deductions)}</td></tr>` : ""}
                ${bonuses > 0 ? `<tr><td style="padding: 6px 0;">Bonificaciones</td><td style="text-align: right; color: #059669; font-weight: 600;">+${fmt(bonuses)}</td></tr>` : ""}
              </table>
            </div>
            
            <p style="color: #6b7280; font-size: 13px;">Si tienes alguna consulta sobre tu nómina, contacta con tu manager o el departamento de RRHH.</p>
          </div>
          <div style="background: #f9fafb; padding: 14px 28px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Josephine · ${locationName}</p>
          </div>
        </div>
      </body>
      </html>
    `;

        const result = await sendEmail(employee.email, subject, html);
        console.log(`[payslip] Sent to ${employee.email} for ${period}:`, result);

        return new Response(
            JSON.stringify({ success: true, emailId: result.id }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        console.error("[payslip-ready] Error:", msg);
        return new Response(
            JSON.stringify({ error: msg }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }
});
