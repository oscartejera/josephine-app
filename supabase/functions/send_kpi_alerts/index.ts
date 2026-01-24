import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface KPIAlert {
  location_id: string;
  location_name: string;
  kpi_name: string;
  actual_value: number;
  threshold_type: 'below_minimum' | 'above_maximum';
  threshold_value: number;
  severity: 'high' | 'medium' | 'low';
}

interface AlertsData {
  date: string;
  group_id: string;
  alerts_count: number;
  alerts: KPIAlert[];
}

const KPI_LABELS: Record<string, string> = {
  'labour_cost_percent': 'Coste de Personal (%)',
  'cogs_percent': 'COGS (%)',
  'prime_cost_percent': 'Prime Cost (%)',
  'daily_sales': 'Ventas Diarias',
  'average_check': 'Ticket Medio',
};

function formatValue(kpiName: string, value: number): string {
  if (kpiName.includes('percent')) {
    return `${value.toFixed(1)}%`;
  }
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
}

function generateAlertsHtml(data: AlertsData, groupName: string): string {
  const highSeverityAlerts = data.alerts.filter(a => a.severity === 'high');
  const mediumSeverityAlerts = data.alerts.filter(a => a.severity === 'medium');

  const alertRows = data.alerts.map(alert => {
    const isAbove = alert.threshold_type === 'above_maximum';
    const arrowIcon = isAbove ? '↑' : '↓';
    const colorClass = alert.severity === 'high' ? '#dc2626' : '#f59e0b';
    
    return `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${colorClass}; margin-right: 8px;"></span>
          ${alert.location_name}
        </td>
        <td style="padding: 12px;">${KPI_LABELS[alert.kpi_name] || alert.kpi_name}</td>
        <td style="padding: 12px; text-align: right; color: ${colorClass}; font-weight: 600;">
          ${arrowIcon} ${formatValue(alert.kpi_name, alert.actual_value)}
        </td>
        <td style="padding: 12px; text-align: right; color: #6b7280;">
          ${isAbove ? 'Máx:' : 'Mín:'} ${formatValue(alert.kpi_name, alert.threshold_value)}
        </td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
      <div style="max-width: 640px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 32px; text-align: center;">
          <h1 style="color: white; margin: 0 0 8px; font-size: 24px; font-weight: 600;">⚠️ Alertas KPI</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 14px;">
            ${data.alerts_count} ${data.alerts_count === 1 ? 'alerta detectada' : 'alertas detectadas'}
          </p>
        </div>
        
        <!-- Content -->
        <div style="padding: 32px;">
          <p style="color: #374151; font-size: 16px; margin: 0 0 8px;">
            Hola,
          </p>
          <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px;">
            Se han detectado KPIs fuera de objetivo en <strong>${groupName}</strong> para el día 
            <strong>${new Date(data.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>.
          </p>
          
          <!-- Alert Summary -->
          <div style="display: flex; gap: 12px; margin-bottom: 24px;">
            ${highSeverityAlerts.length > 0 ? `
            <div style="flex: 1; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; text-align: center;">
              <p style="margin: 0; color: #dc2626; font-size: 24px; font-weight: 700;">${highSeverityAlerts.length}</p>
              <p style="margin: 4px 0 0; color: #991b1b; font-size: 12px; text-transform: uppercase;">Críticas</p>
            </div>
            ` : ''}
            ${mediumSeverityAlerts.length > 0 ? `
            <div style="flex: 1; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; text-align: center;">
              <p style="margin: 0; color: #f59e0b; font-size: 24px; font-weight: 700;">${mediumSeverityAlerts.length}</p>
              <p style="margin: 4px 0 0; color: #92400e; font-size: 12px; text-transform: uppercase;">Advertencias</p>
            </div>
            ` : ''}
          </div>
          
          <!-- Alerts Table -->
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Ubicación</th>
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">KPI</th>
                <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">Actual</th>
                <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">Objetivo</th>
              </tr>
            </thead>
            <tbody>
              ${alertRows}
            </tbody>
          </table>

          <!-- Action Button -->
          <div style="margin-top: 24px; text-align: center;">
            <a href="https://josephine-app.lovable.app/insights/instant-pl" 
               style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500; font-size: 14px;">
              Ver Dashboard Completo →
            </a>
          </div>

          <!-- Recommendations -->
          <div style="margin-top: 24px; padding: 16px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #0ea5e9;">
            <h4 style="margin: 0 0 8px; color: #0369a1; font-size: 13px; font-weight: 600;">💡 Recomendaciones</h4>
            <ul style="margin: 0; padding-left: 16px; color: #0c4a6e; font-size: 13px;">
              ${highSeverityAlerts.some(a => a.kpi_name === 'labour_cost_percent') ? 
                '<li>Revisa el scheduling de personal - considera ajustar turnos en horas de menor afluencia.</li>' : ''}
              ${highSeverityAlerts.some(a => a.kpi_name === 'prime_cost_percent') ? 
                '<li>Prime Cost alto: analiza tanto costes de personal como de materias primas.</li>' : ''}
              ${data.alerts.some(a => a.kpi_name === 'daily_sales' && a.threshold_type === 'below_minimum') ? 
                '<li>Ventas por debajo del objetivo - considera promociones o analiza patrones de tráfico.</li>' : ''}
              <li>Accede al dashboard para un análisis más detallado.</li>
            </ul>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background: #f9fafb; padding: 16px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            © ${new Date().getFullYear()} Josephine. Alertas configuradas en Configuración → KPIs.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Josephine <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Resend API error: ${res.status} - ${errorBody}`);
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const targetDate = body.date || new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const targetGroupId = body.group_id;

    console.log(`Checking KPI alerts for date: ${targetDate}`);

    // Get all groups
    let groupsQuery = supabase.from('groups').select('id, name');
    if (targetGroupId) {
      groupsQuery = groupsQuery.eq('id', targetGroupId);
    }
    const { data: groups, error: groupsError } = await groupsQuery;

    if (groupsError) throw new Error(`Failed to fetch groups: ${groupsError.message}`);

    const results = [];

    for (const group of groups || []) {
      // Check for alerts
      const { data: alertsData, error: alertsError } = await supabase
        .rpc('check_kpi_alerts', { 
          p_group_id: group.id,
          p_date: targetDate 
        });

      if (alertsError) {
        console.error(`Error checking alerts for group ${group.id}:`, alertsError);
        continue;
      }

      const typedAlertsData = alertsData as AlertsData;

      if (!typedAlertsData.alerts || typedAlertsData.alerts.length === 0) {
        console.log(`No KPI alerts for group ${group.name}`);
        results.push({ group: group.name, alerts_count: 0, status: 'no_alerts' });
        continue;
      }

      console.log(`Found ${typedAlertsData.alerts_count} alerts for group ${group.name}`);

      // Get subscribers to kpi_alerts
      const { data: subscriptions, error: subError } = await supabase
        .from('report_subscriptions')
        .select('id, user_id, location_id, email_override')
        .eq('group_id', group.id)
        .eq('report_type', 'kpi_alerts')
        .eq('is_enabled', true);

      if (subError) {
        console.error(`Error fetching subscriptions for group ${group.id}:`, subError);
        continue;
      }

      if (!subscriptions || subscriptions.length === 0) {
        console.log(`No active kpi_alerts subscriptions for group ${group.name}`);
        continue;
      }

      // Send to each subscriber
      for (const sub of subscriptions) {
        try {
          let email = sub.email_override;
          if (!email) {
            const { data: authUser } = await supabase.auth.admin.getUserById(sub.user_id);
            email = authUser?.user?.email;
          }

          if (!email) {
            console.warn(`No email found for user ${sub.user_id}`);
            continue;
          }

          // Filter alerts by location if subscriber has location scope
          let filteredAlerts = typedAlertsData;
          if (sub.location_id) {
            filteredAlerts = {
              ...typedAlertsData,
              alerts: typedAlertsData.alerts.filter(a => a.location_id === sub.location_id),
              alerts_count: typedAlertsData.alerts.filter(a => a.location_id === sub.location_id).length
            };
          }

          if (filteredAlerts.alerts.length === 0) {
            console.log(`No relevant alerts for user ${sub.user_id} at location ${sub.location_id}`);
            continue;
          }

          const html = generateAlertsHtml(filteredAlerts, group.name);
          const subject = `⚠️ ${filteredAlerts.alerts_count} Alerta${filteredAlerts.alerts_count > 1 ? 's' : ''} KPI - ${new Date(targetDate).toLocaleDateString('es-ES')} | ${group.name}`;

          await sendEmail(email, subject, html);

          await supabase.from('report_logs').insert({
            report_type: 'kpi_alerts',
            group_id: group.id,
            location_id: sub.location_id,
            recipient_email: email,
            status: 'sent',
            report_data: filteredAlerts
          });

          results.push({ email, status: 'sent', alerts_count: filteredAlerts.alerts_count });
          console.log(`KPI alerts sent to ${email}`);

        } catch (err: any) {
          console.error(`Error sending to subscriber ${sub.user_id}:`, err);
          
          await supabase.from('report_logs').insert({
            report_type: 'kpi_alerts',
            group_id: group.id,
            location_id: sub.location_id,
            recipient_email: sub.email_override || 'unknown',
            status: 'failed',
            error_message: err.message
          });

          results.push({ user_id: sub.user_id, status: 'failed', error: err.message });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: targetDate,
        results
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in send_kpi_alerts:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
