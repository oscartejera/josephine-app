import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WeeklySummaryData {
  week_start: string;
  week_end: string;
  locations: Array<{
    location_id: string;
    location_name: string;
    total_sales: number;
    total_orders: number;
    total_labour: number;
    total_cogs: number;
    avg_daily_sales: number;
    labour_percent: number;
    cogs_percent: number;
    prime_cost_percent: number;
  }>;
  totals: {
    total_sales: number;
    total_orders: number;
    total_labour: number;
    total_cogs: number;
    avg_check: number;
    prime_cost_percent: number;
  };
  daily_breakdown: Array<{
    date: string;
    sales: number;
    orders: number;
  }>;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function generateWeeklyReportHtml(data: WeeklySummaryData, groupName: string): string {
  const weekStartDate = new Date(data.week_start);
  const weekEndDate = new Date(data.week_end);
  
  const locationRows = data.locations.map((loc, idx) => `
    <tr style="border-bottom: 1px solid #e5e7eb; ${idx === 0 ? 'background: #fffbeb;' : ''}">
      <td style="padding: 12px; font-weight: ${idx === 0 ? '600' : '500'};">
        ${idx === 0 ? '🏆 ' : ''}${loc.location_name}
      </td>
      <td style="padding: 12px; text-align: right;">${formatCurrency(loc.total_sales)}</td>
      <td style="padding: 12px; text-align: right;">${loc.total_orders}</td>
      <td style="padding: 12px; text-align: right;">${formatCurrency(loc.avg_daily_sales)}</td>
      <td style="padding: 12px; text-align: right; color: ${loc.prime_cost_percent > 65 ? '#dc2626' : '#16a34a'};">
        ${formatPercent(loc.prime_cost_percent)}
      </td>
    </tr>
  `).join('');

  const dailyBars = data.daily_breakdown.map(day => {
    const maxSales = Math.max(...data.daily_breakdown.map(d => d.sales), 1);
    const heightPct = (day.sales / maxSales) * 100;
    const dayName = new Date(day.date).toLocaleDateString('es-ES', { weekday: 'short' });
    return `
      <div style="flex: 1; text-align: center;">
        <div style="height: 80px; display: flex; align-items: flex-end; justify-content: center;">
          <div style="width: 24px; background: linear-gradient(180deg, #f97316 0%, #ea580c 100%); border-radius: 4px 4px 0 0; height: ${heightPct}%;"></div>
        </div>
        <p style="margin: 4px 0 0; font-size: 10px; color: #6b7280; text-transform: uppercase;">${dayName}</p>
        <p style="margin: 2px 0 0; font-size: 11px; color: #374151; font-weight: 500;">${formatCurrency(day.sales)}</p>
      </div>
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
      <div style="max-width: 680px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%); padding: 32px; text-align: center;">
          <h1 style="color: white; margin: 0 0 8px; font-size: 24px; font-weight: 600;">Josephine</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 14px;">Resumen Semanal</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 32px;">
          <p style="color: #374151; font-size: 16px; margin: 0 0 8px;">
            Hola,
          </p>
          <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px;">
            Aquí tienes el resumen semanal de <strong>${groupName}</strong> del 
            <strong>${weekStartDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}</strong> al 
            <strong>${weekEndDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
          </p>
          
          <!-- KPI Cards -->
          <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px;">
            <div style="flex: 1; min-width: 140px; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 8px; padding: 16px;">
              <p style="margin: 0; color: #065f46; font-size: 12px; text-transform: uppercase; font-weight: 500;">Ventas Totales</p>
              <p style="margin: 4px 0 0; color: #047857; font-size: 24px; font-weight: 700;">${formatCurrency(data.totals.total_sales)}</p>
            </div>
            <div style="flex: 1; min-width: 140px; background: #f9fafb; border-radius: 8px; padding: 16px;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase;">Tickets</p>
              <p style="margin: 4px 0 0; color: #111827; font-size: 24px; font-weight: 600;">${data.totals.total_orders}</p>
            </div>
            <div style="flex: 1; min-width: 140px; background: #f9fafb; border-radius: 8px; padding: 16px;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase;">Ticket Medio</p>
              <p style="margin: 4px 0 0; color: #111827; font-size: 24px; font-weight: 600;">${formatCurrency(data.totals.avg_check)}</p>
            </div>
            <div style="flex: 1; min-width: 140px; background: ${data.totals.prime_cost_percent > 65 ? '#fef2f2' : '#f0fdf4'}; border-radius: 8px; padding: 16px;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase;">Prime Cost</p>
              <p style="margin: 4px 0 0; color: ${data.totals.prime_cost_percent > 65 ? '#dc2626' : '#16a34a'}; font-size: 24px; font-weight: 600;">${formatPercent(data.totals.prime_cost_percent)}</p>
            </div>
          </div>

          <!-- Daily Chart -->
          <h3 style="color: #374151; font-size: 14px; font-weight: 600; margin: 0 0 12px;">📈 Evolución Diaria</h3>
          <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <div style="display: flex; gap: 8px;">
              ${dailyBars}
            </div>
          </div>
          
          <!-- Locations Table -->
          ${data.locations.length > 0 ? `
          <h3 style="color: #374151; font-size: 14px; font-weight: 600; margin: 0 0 12px;">🏪 Ranking por Ubicación</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Ubicación</th>
                <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">Ventas</th>
                <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">Tickets</th>
                <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">Media/Día</th>
                <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">Prime Cost</th>
              </tr>
            </thead>
            <tbody>
              ${locationRows}
            </tbody>
          </table>
          ` : ''}

          <!-- Cost Breakdown -->
          <div style="margin-top: 24px; padding: 16px; background: #f9fafb; border-radius: 8px;">
            <h4 style="margin: 0 0 12px; color: #374151; font-size: 13px; font-weight: 600;">💰 Desglose de Costes</h4>
            <div style="display: flex; gap: 24px;">
              <div>
                <p style="margin: 0; color: #6b7280; font-size: 12px;">Coste de Personal</p>
                <p style="margin: 4px 0 0; color: #374151; font-size: 16px; font-weight: 600;">${formatCurrency(data.totals.total_labour)}</p>
              </div>
              <div>
                <p style="margin: 0; color: #6b7280; font-size: 12px;">COGS</p>
                <p style="margin: 4px 0 0; color: #374151; font-size: 16px; font-weight: 600;">${formatCurrency(data.totals.total_cogs)}</p>
              </div>
              <div>
                <p style="margin: 0; color: #6b7280; font-size: 12px;">Margen Bruto</p>
                <p style="margin: 4px 0 0; color: #16a34a; font-size: 16px; font-weight: 600;">
                  ${formatCurrency(data.totals.total_sales - data.totals.total_labour - data.totals.total_cogs)}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background: #f9fafb; padding: 16px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            © ${new Date().getFullYear()} Josephine. Este email se envía automáticamente cada lunes.
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

    // Get optional params
    const body = await req.json().catch(() => ({}));
    
    // Calculate last week's Monday
    const today = new Date();
    const lastMonday = new Date(today);
    lastMonday.setDate(today.getDate() - today.getDay() - 6); // Last Monday
    const weekStart = body.week_start || lastMonday.toISOString().split('T')[0];
    const targetGroupId = body.group_id;

    console.log(`Generating weekly reports for week starting: ${weekStart}`);

    // Get all groups
    let groupsQuery = supabase.from('groups').select('id, name');
    if (targetGroupId) {
      groupsQuery = groupsQuery.eq('id', targetGroupId);
    }
    const { data: groups, error: groupsError } = await groupsQuery;

    if (groupsError) throw new Error(`Failed to fetch groups: ${groupsError.message}`);

    const results = [];

    for (const group of groups || []) {
      // Get users subscribed to weekly_summary reports (typically owners)
      const { data: subscriptions, error: subError } = await supabase
        .from('report_subscriptions')
        .select('id, user_id, email_override')
        .eq('group_id', group.id)
        .eq('report_type', 'weekly_summary')
        .eq('is_enabled', true);

      if (subError) {
        console.error(`Error fetching subscriptions for group ${group.id}:`, subError);
        continue;
      }

      if (!subscriptions || subscriptions.length === 0) {
        console.log(`No active weekly_summary subscriptions for group ${group.name}`);
        continue;
      }

      // Get weekly summary data
      const { data: summaryData, error: summaryError } = await supabase
        .rpc('get_weekly_sales_summary', { 
          p_group_id: group.id,
          p_week_start: weekStart 
        });

      if (summaryError) {
        console.error(`Error getting weekly summary for group ${group.id}:`, summaryError);
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

          const html = generateWeeklyReportHtml(summaryData as WeeklySummaryData, group.name);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          
          const subject = `📊 Resumen Semanal - ${new Date(weekStart).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} al ${weekEnd.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} | ${group.name}`;

          await sendEmail(email, subject, html);

          await supabase.from('report_logs').insert({
            report_type: 'weekly_summary',
            group_id: group.id,
            recipient_email: email,
            status: 'sent',
            report_data: summaryData
          });

          results.push({ email, status: 'sent', group: group.name });
          console.log(`Weekly report sent to ${email}`);

        } catch (err: any) {
          console.error(`Error sending to subscriber ${sub.user_id}:`, err);
          
          await supabase.from('report_logs').insert({
            report_type: 'weekly_summary',
            group_id: group.id,
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
        week_start: weekStart,
        emails_processed: results.length,
        results
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in send_weekly_report:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
