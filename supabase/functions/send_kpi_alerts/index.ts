/**
 * send_kpi_alerts — Professional KPI alerts email
 * 
 * Production-grade: no emojis, real data from sales_daily_unified,
 * env-driven config, threshold-based detection, graceful fallbacks.
 * 
 * Triggered by pg_cron every hour.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function fmt(n: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

interface Alert {
  kpi: string;
  label: string;
  actual: number;
  threshold: number;
  severity: 'high' | 'medium';
  direction: 'above' | 'below';
}

// Default thresholds (can be overridden per-org in the future)
const THRESHOLDS = {
  prime_cost_max: 65,
  labour_cost_max: 35,
  cogs_max: 38,
};

function detectAlerts(netSales: number, labourCost: number, cogs: number): Alert[] {
  const alerts: Alert[] = [];
  if (netSales <= 0) return alerts;

  const primeCost = (labourCost + cogs) / netSales * 100;
  const labourPct = labourCost / netSales * 100;
  const cogsPct = cogs / netSales * 100;

  if (primeCost > THRESHOLDS.prime_cost_max) {
    alerts.push({
      kpi: 'prime_cost', label: 'Prime Cost',
      actual: primeCost, threshold: THRESHOLDS.prime_cost_max,
      severity: primeCost > 70 ? 'high' : 'medium', direction: 'above',
    });
  }
  if (labourPct > THRESHOLDS.labour_cost_max) {
    alerts.push({
      kpi: 'labour_cost', label: 'Coste de Personal',
      actual: labourPct, threshold: THRESHOLDS.labour_cost_max,
      severity: labourPct > 40 ? 'high' : 'medium', direction: 'above',
    });
  }
  if (cogsPct > THRESHOLDS.cogs_max) {
    alerts.push({
      kpi: 'cogs', label: 'COGS',
      actual: cogsPct, threshold: THRESHOLDS.cogs_max,
      severity: cogsPct > 42 ? 'high' : 'medium', direction: 'above',
    });
  }

  return alerts;
}

function generateRecommendation(alert: Alert): string {
  switch (alert.kpi) {
    case 'prime_cost': return 'Revisa tanto costes de personal como de materias primas para identificar donde optimizar.';
    case 'labour_cost': return 'Considera ajustar turnos en horas de menor afluencia o redistribuir el personal.';
    case 'cogs': return 'Analiza las mermas, el desperdicio y los precios de proveedores para reducir COGS.';
    default: return 'Accede al dashboard para un analisis mas detallado.';
  }
}

function generateAlertsHtml(groupName: string, date: string, alerts: Alert[], appUrl: string): string {
  const highAlerts = alerts.filter(a => a.severity === 'high');
  const mediumAlerts = alerts.filter(a => a.severity === 'medium');
  const dateFormatted = new Date(date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  const alertRows = alerts.map(a => {
    const color = a.severity === 'high' ? '#dc2626' : '#f59e0b';
    return `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${color}; margin-right: 8px;"></span>
          ${a.label}
        </td>
        <td style="padding: 12px; text-align: right; color: ${color}; font-weight: 600;">${pct(a.actual)}</td>
        <td style="padding: 12px; text-align: right; color: #6b7280;">Max: ${pct(a.threshold)}</td>
      </tr>
    `;
  }).join('');

  const recommendations = alerts.map(a => `<li style="margin-bottom: 6px;">${generateRecommendation(a)}</li>`).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
  <div style="max-width: 640px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">

    <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 28px 32px;">
      <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">Alertas KPI</h1>
      <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 14px;">
        ${alerts.length} ${alerts.length === 1 ? 'alerta detectada' : 'alertas detectadas'} &mdash; ${groupName}
      </p>
    </div>

    <div style="padding: 28px 32px;">
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 20px;">
        Se han detectado KPIs fuera de objetivo para el dia <strong>${dateFormatted}</strong>.
      </p>

      <!-- Severity Summary -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
        <tr>
          ${highAlerts.length > 0 ? `
          <td style="padding: 4px;">
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 14px; text-align: center;">
              <p style="margin: 0; color: #dc2626; font-size: 24px; font-weight: 700;">${highAlerts.length}</p>
              <p style="margin: 4px 0 0; color: #991b1b; font-size: 11px; text-transform: uppercase;">Criticas</p>
            </div>
          </td>
          ` : ''}
          ${mediumAlerts.length > 0 ? `
          <td style="padding: 4px;">
            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 14px; text-align: center;">
              <p style="margin: 0; color: #f59e0b; font-size: 24px; font-weight: 700;">${mediumAlerts.length}</p>
              <p style="margin: 4px 0 0; color: #92400e; font-size: 11px; text-transform: uppercase;">Advertencias</p>
            </div>
          </td>
          ` : ''}
        </tr>
      </table>

      <!-- Alerts Table -->
      <table width="100%" style="font-size: 13px; border-collapse: collapse; margin-bottom: 24px;">
        <thead>
          <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
            <th style="padding: 10px 12px; text-align: left; font-weight: 600; color: #374151;">KPI</th>
            <th style="padding: 10px 12px; text-align: right; font-weight: 600; color: #374151;">Actual</th>
            <th style="padding: 10px 12px; text-align: right; font-weight: 600; color: #374151;">Objetivo</th>
          </tr>
        </thead>
        <tbody>${alertRows}</tbody>
      </table>

      <!-- Recommendations -->
      <div style="padding: 16px; background: #f0f9ff; border-radius: 10px; border-left: 4px solid #0ea5e9; margin-bottom: 24px;">
        <h4 style="margin: 0 0 8px; color: #0369a1; font-size: 13px; font-weight: 600;">Recomendaciones</h4>
        <ul style="margin: 0; padding-left: 16px; color: #0c4a6e; font-size: 13px; line-height: 1.6;">
          ${recommendations}
        </ul>
      </div>

      <div style="text-align: center; margin: 24px 0 8px;">
        <a href="${appUrl}/insights/instant-pl" style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #6d28d9); color: white; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">
          Ver P&amp;L Completo
        </a>
      </div>
    </div>

    <div style="background: #f8fafc; padding: 16px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; font-size: 11px; color: #94a3b8;">Josephine AI &mdash; Alertas configuradas en Ajustes</p>
    </div>
  </div>
</body>
</html>
  `;
}

async function sendEmail(to: string, subject: string, html: string, from: string): Promise<void> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY not configured");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Resend: ${res.status} - ${await res.text()}`);
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const senderEmail = Deno.env.get("EMAIL_FROM") || "Josephine <onboarding@resend.dev>";
    const appUrl = Deno.env.get("APP_URL") || Deno.env.get("SUPABASE_URL")!.replace('.supabase.co', '.vercel.app');

    const body = await req.json().catch(() => ({}));
    const targetDate = body.date || new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const targetGroupId = body.group_id;

    console.log(`[kpi_alerts] Checking for: ${targetDate}`);

    let groupsQuery = supabase.from('groups').select('id, name');
    if (targetGroupId) groupsQuery = groupsQuery.eq('id', targetGroupId);
    const { data: groups } = await groupsQuery;

    const results: any[] = [];

    for (const group of groups || []) {
      // Get yesterday's aggregated sales data
      const { data: salesRows } = await supabase
        .from('sales_daily_unified')
        .select('net_sales, labour_cost, cogs')
        .eq('group_id', group.id)
        .eq('date', targetDate)
        .catch(() => ({ data: null })) as any;

      if (!salesRows?.length) continue;

      const netSales = salesRows.reduce((s: number, r: any) => s + (r.net_sales || 0), 0);
      const labourCost = salesRows.reduce((s: number, r: any) => s + (r.labour_cost || 0), 0);
      const cogs = salesRows.reduce((s: number, r: any) => s + (r.cogs || 0), 0);

      // Detect alerts
      const alerts = detectAlerts(netSales, labourCost, cogs);

      if (alerts.length === 0) {
        console.log(`[kpi_alerts] No alerts for ${group.name}`);
        results.push({ group: group.name, alerts_count: 0 });
        continue;
      }

      console.log(`[kpi_alerts] ${alerts.length} alerts for ${group.name}`);

      // Get subscribers
      const { data: subs } = await supabase
        .from('report_subscriptions')
        .select('id, user_id, email_override')
        .eq('group_id', group.id)
        .eq('report_type', 'kpi_alerts')
        .eq('is_enabled', true);

      if (!subs?.length) continue;

      const html = generateAlertsHtml(group.name, targetDate, alerts, appUrl);

      for (const sub of subs) {
        try {
          let email = sub.email_override;
          if (!email) {
            const { data: u } = await supabase.auth.admin.getUserById(sub.user_id);
            email = u?.user?.email;
          }
          if (!email) continue;

          const subject = `${alerts.length} Alerta${alerts.length > 1 ? 's' : ''} KPI — ${new Date(targetDate).toLocaleDateString('es-ES')} | ${group.name}`;
          await sendEmail(email, subject, html, senderEmail);

          await supabase.from('report_logs').insert({
            report_type: 'kpi_alerts', group_id: group.id,
            recipient_email: email, status: 'sent',
            report_data: { alerts_count: alerts.length, alerts },
          }).catch(() => { });

          results.push({ email, status: 'sent', alerts_count: alerts.length });
        } catch (err: any) {
          console.error(`[kpi_alerts] Error: ${err.message}`);
          results.push({ user_id: sub.user_id, status: 'failed', error: err.message });
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, date: targetDate, results }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[kpi_alerts] Fatal:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders } });
  }
});
