import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DailySalesData {
  date: string;
  locations: Array<{
    location_id: string;
    location_name: string;
    net_sales: number;
    orders_count: number;
    payments_cash: number;
    payments_card: number;
    labour_cost: number;
    labour_hours: number;
    cogs: number;
    labour_percent: number;
    cogs_percent: number;
  }>;
  totals: {
    total_sales: number;
    total_orders: number;
    total_labour: number;
    total_cogs: number;
    avg_check: number;
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function generateDailyReportHtml(data: DailySalesData, groupName: string): string {
  const primePercent = data.totals.total_sales > 0 
    ? ((data.totals.total_labour + data.totals.total_cogs) / data.totals.total_sales * 100).toFixed(1)
    : '0.0';

  const locationRows = data.locations.map(loc => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px; font-weight: 500;">${loc.location_name}</td>
      <td style="padding: 12px; text-align: right;">${formatCurrency(loc.net_sales)}</td>
      <td style="padding: 12px; text-align: right;">${loc.orders_count}</td>
      <td style="padding: 12px; text-align: right; color: ${loc.labour_percent > 30 ? '#dc2626' : '#16a34a'};">${formatPercent(loc.labour_percent)}</td>
      <td style="padding: 12px; text-align: right; color: ${loc.cogs_percent > 35 ? '#dc2626' : '#16a34a'};">${formatPercent(loc.cogs_percent)}</td>
    </tr>
  `).join('');

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
        <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 32px; text-align: center;">
          <h1 style="color: white; margin: 0 0 8px; font-size: 24px; font-weight: 600;">Josephine</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 14px;">Resumen Diario de Ventas</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 32px;">
          <p style="color: #374151; font-size: 16px; margin: 0 0 8px;">
            Hola,
          </p>
          <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px;">
            Aquí tienes el resumen de ventas de <strong>${groupName}</strong> para el día <strong>${new Date(data.date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>.
          </p>
          
          <!-- KPI Cards -->
          <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px;">
            <div style="flex: 1; min-width: 120px; background: #f9fafb; border-radius: 8px; padding: 16px; text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase;">Ventas</p>
              <p style="margin: 4px 0 0; color: #111827; font-size: 20px; font-weight: 600;">${formatCurrency(data.totals.total_sales)}</p>
            </div>
            <div style="flex: 1; min-width: 120px; background: #f9fafb; border-radius: 8px; padding: 16px; text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase;">Tickets</p>
              <p style="margin: 4px 0 0; color: #111827; font-size: 20px; font-weight: 600;">${data.totals.total_orders}</p>
            </div>
            <div style="flex: 1; min-width: 120px; background: #f9fafb; border-radius: 8px; padding: 16px; text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase;">Ticket Medio</p>
              <p style="margin: 4px 0 0; color: #111827; font-size: 20px; font-weight: 600;">${formatCurrency(data.totals.avg_check)}</p>
            </div>
            <div style="flex: 1; min-width: 120px; background: ${Number(primePercent) > 65 ? '#fef2f2' : '#f0fdf4'}; border-radius: 8px; padding: 16px; text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase;">Prime Cost</p>
              <p style="margin: 4px 0 0; color: ${Number(primePercent) > 65 ? '#dc2626' : '#16a34a'}; font-size: 20px; font-weight: 600;">${primePercent}%</p>
            </div>
          </div>
          
          <!-- Locations Table -->
          ${data.locations.length > 0 ? `
          <h3 style="color: #374151; font-size: 14px; font-weight: 600; margin: 0 0 12px;">Desglose por Ubicación</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Ubicación</th>
                <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">Ventas</th>
                <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">Tickets</th>
                <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">CoL%</th>
                <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">COGS%</th>
              </tr>
            </thead>
            <tbody>
              ${locationRows}
            </tbody>
          </table>
          ` : ''}
        </div>
        
        <!-- Footer -->
        <div style="background: #f9fafb; padding: 16px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            © ${new Date().getFullYear()} Josephine. Este email se envía automáticamente.
          </p>
          <p style="color: #9ca3af; font-size: 11px; margin: 8px 0 0;">
            Para modificar tus preferencias de reportes, accede a Configuración → Reportes.
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

    // Get optional params from request
    const body = await req.json().catch(() => ({}));
    const targetDate = body.date || new Date(Date.now() - 86400000).toISOString().split('T')[0]; // Yesterday
    const targetGroupId = body.group_id;

    console.log(`Generating daily reports for date: ${targetDate}`);

    // Get all groups (or specific group if provided)
    let groupsQuery = supabase.from('groups').select('id, name');
    if (targetGroupId) {
      groupsQuery = groupsQuery.eq('id', targetGroupId);
    }
    const { data: groups, error: groupsError } = await groupsQuery;

    if (groupsError) throw new Error(`Failed to fetch groups: ${groupsError.message}`);

    const results = [];

    for (const group of groups || []) {
      // Get users subscribed to daily_sales reports
      const { data: subscriptions, error: subError } = await supabase
        .from('report_subscriptions')
        .select(`
          id,
          user_id,
          location_id,
          email_override
        `)
        .eq('group_id', group.id)
        .eq('report_type', 'daily_sales')
        .eq('is_enabled', true);

      if (subError) {
        console.error(`Error fetching subscriptions for group ${group.id}:`, subError);
        continue;
      }

      if (!subscriptions || subscriptions.length === 0) {
        console.log(`No active daily_sales subscriptions for group ${group.name}`);
        continue;
      }

      // Get sales summary data
      const { data: summaryData, error: summaryError } = await supabase
        .rpc('get_daily_sales_summary', { 
          p_group_id: group.id,
          p_date: targetDate 
        });

      if (summaryError) {
        console.error(`Error getting summary for group ${group.id}:`, summaryError);
        continue;
      }

      // Send to each subscriber
      for (const sub of subscriptions) {
        try {
          // Get user email
          let email = sub.email_override;
          if (!email) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', sub.user_id)
              .single();

            // Get email from auth.users using admin API
            const { data: authUser } = await supabase.auth.admin.getUserById(sub.user_id);
            email = authUser?.user?.email;
          }

          if (!email) {
            console.warn(`No email found for user ${sub.user_id}`);
            continue;
          }

          // Filter data by location if subscriber has location scope
          let reportData = summaryData as DailySalesData;
          if (sub.location_id) {
            reportData = {
              ...reportData,
              locations: reportData.locations.filter(l => l.location_id === sub.location_id)
            };
          }

          // Generate and send email
          const html = generateDailyReportHtml(reportData, group.name);
          const subject = `📊 Resumen Diario - ${new Date(targetDate).toLocaleDateString('es-ES')} | ${group.name}`;

          await sendEmail(email, subject, html);

          // Log successful send
          await supabase.from('report_logs').insert({
            report_type: 'daily_sales',
            group_id: group.id,
            location_id: sub.location_id,
            recipient_email: email,
            status: 'sent',
            report_data: reportData
          });

          results.push({ email, status: 'sent', group: group.name });
          console.log(`Daily report sent to ${email}`);

        } catch (err: any) {
          console.error(`Error sending to subscriber ${sub.user_id}:`, err);
          
          await supabase.from('report_logs').insert({
            report_type: 'daily_sales',
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
        emails_processed: results.length,
        results
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in send_daily_report:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
