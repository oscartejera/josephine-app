/**
 * send_daily_report — Premium morning email for restaurant owners
 * 
 * SUPERIOR TO NORY: includes forecast vs actual, AI insight, weather,
 * week-over-week deltas, top 3 products, and reply CTA.
 * 
 * Triggered by pg_cron at 7:00 AM daily.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Helpers ──

function fmt(n: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function delta(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+100%' : '—';
  const d = ((current - previous) / previous) * 100;
  const sign = d >= 0 ? '+' : '';
  return `${sign}${d.toFixed(1)}%`;
}

function deltaColor(current: number, previous: number, invertColors = false): string {
  if (previous === 0) return '#6b7280';
  const d = ((current - previous) / previous) * 100;
  const positive = invertColors ? d <= 0 : d >= 0;
  return positive ? '#16a34a' : '#dc2626';
}

function weatherEmoji(code: number): string {
  if (code >= 200 && code < 300) return '⛈️';
  if (code >= 300 && code < 400) return '🌧️';
  if (code >= 500 && code < 600) return '🌧️';
  if (code >= 600 && code < 700) return '❄️';
  if (code >= 700 && code < 800) return '🌫️';
  if (code === 800) return '☀️';
  if (code > 800) return '⛅';
  return '🌤️';
}

// ── Email template ──

interface ReportData {
  date: string;
  groupName: string;
  // Yesterday KPIs
  netSales: number;
  orders: number;
  avgCheck: number;
  labourCost: number;
  cogs: number;
  gpPercent: number;
  colPercent: number;
  primeCost: number;
  // Previous week comparison
  prevNetSales: number;
  prevOrders: number;
  prevLabourCost: number;
  prevCogs: number;
  // Forecast
  forecastSales: number;
  forecastAccuracy: number;
  // Weather
  weatherDesc: string;
  weatherIcon: string;
  weatherTemp: number;
  // Top products
  topProducts: Array<{ name: string; quantity: number; sales: number }>;
  // AI Insight
  aiInsight: string;
  // Location breakdown
  locations: Array<{
    name: string;
    net_sales: number;
    orders: number;
    labour_percent: number;
    cogs_percent: number;
  }>;
}

function generatePremiumEmailHtml(d: ReportData): string {
  const dateFormatted = new Date(d.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const forecastDelta = d.forecastSales > 0 ? ((d.netSales - d.forecastSales) / d.forecastSales * 100) : 0;
  const forecastDeltaStr = forecastDelta >= 0 ? `+${forecastDelta.toFixed(1)}%` : `${forecastDelta.toFixed(1)}%`;
  const forecastColor = forecastDelta >= 0 ? '#16a34a' : '#dc2626';

  const locationRows = d.locations.map((loc, i) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 10px 12px; font-weight: 500;">${i === 0 ? '🏆 ' : ''}${loc.name}</td>
      <td style="padding: 10px 12px; text-align: right;">${fmt(loc.net_sales)}</td>
      <td style="padding: 10px 12px; text-align: right;">${loc.orders}</td>
      <td style="padding: 10px 12px; text-align: right; color: ${loc.labour_percent > 30 ? '#dc2626' : '#16a34a'};">${pct(loc.labour_percent)}</td>
      <td style="padding: 10px 12px; text-align: right; color: ${loc.cogs_percent > 35 ? '#dc2626' : '#16a34a'};">${pct(loc.cogs_percent)}</td>
    </tr>
  `).join('');

  const topProductRows = d.topProducts.slice(0, 3).map((p, i) => `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 8px 12px;">${['🥇', '🥈', '🥉'][i]} ${p.name}</td>
      <td style="padding: 8px 12px; text-align: right; color: #6b7280;">${p.quantity} uds</td>
      <td style="padding: 8px 12px; text-align: right; font-weight: 600;">${fmt(p.sales)}</td>
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
  <div style="max-width: 640px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
    
    <!-- Header Gradient -->
    <div style="background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #4c1d95 100%); padding: 28px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">☀️ Buenos días</h1>
            <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 14px;">
              ${d.groupName} — ${dateFormatted}
            </p>
          </td>
          <td style="text-align: right; vertical-align: top;">
            ${d.weatherDesc ? `
            <div style="background: rgba(255,255,255,0.15); border-radius: 8px; padding: 8px 12px; display: inline-block;">
              <span style="font-size: 20px;">${d.weatherIcon}</span>
              <span style="color: white; font-size: 14px; margin-left: 4px;">${d.weatherTemp}°C</span>
            </div>
            ` : ''}
          </td>
        </tr>
      </table>
    </div>

    <div style="padding: 28px 32px;">

      <!-- AI Morning Insight -->
      ${d.aiInsight ? `
      <div style="background: linear-gradient(135deg, #f5f3ff, #ede9fe); border-left: 4px solid #7c3aed; border-radius: 0 8px 8px 0; padding: 14px 16px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 13px; color: #6d28d9; font-weight: 600;">🤖 Josephine AI dice:</p>
        <p style="margin: 6px 0 0; font-size: 14px; color: #374151; line-height: 1.5;">${d.aiInsight}</p>
      </div>
      ` : ''}

      <!-- Hero: Ventas vs Forecast -->
      <div style="text-align: center; margin-bottom: 24px;">
        <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Ventas de Ayer</p>
        <p style="margin: 4px 0; font-size: 36px; font-weight: 800; color: #111827;">${fmt(d.netSales)}</p>
        ${d.forecastSales > 0 ? `
        <div style="display: inline-block; margin-top: 4px;">
          <span style="font-size: 13px; color: #6b7280;">Forecast: ${fmt(d.forecastSales)}</span>
          <span style="font-size: 13px; color: ${forecastColor}; font-weight: 700; margin-left: 8px;">${forecastDeltaStr}</span>
          ${d.forecastAccuracy > 0 ? `<span style="font-size: 11px; color: #9ca3af; margin-left: 4px;">(${pct(d.forecastAccuracy)} precisión)</span>` : ''}
        </div>
        ` : ''}
        <div style="margin-top: 6px;">
          <span style="font-size: 12px; color: ${deltaColor(d.netSales, d.prevNetSales)}; font-weight: 600;">
            ${delta(d.netSales, d.prevNetSales)} vs semana anterior
          </span>
        </div>
      </div>

      <!-- KPI Cards Grid -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
        <tr>
          <td style="padding: 4px;">
            <div style="background: #f9fafb; border-radius: 10px; padding: 14px; text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 11px; text-transform: uppercase;">Pedidos</p>
              <p style="margin: 4px 0 0; font-size: 22px; font-weight: 700; color: #111827;">${d.orders}</p>
              <p style="margin: 2px 0 0; font-size: 11px; color: ${deltaColor(d.orders, d.prevOrders)};">${delta(d.orders, d.prevOrders)}</p>
            </div>
          </td>
          <td style="padding: 4px;">
            <div style="background: #f9fafb; border-radius: 10px; padding: 14px; text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 11px; text-transform: uppercase;">Ticket Medio</p>
              <p style="margin: 4px 0 0; font-size: 22px; font-weight: 700; color: #111827;">${fmt(d.avgCheck)}</p>
            </div>
          </td>
          <td style="padding: 4px;">
            <div style="background: ${d.primeCost > 65 ? '#fef2f2' : '#f0fdf4'}; border-radius: 10px; padding: 14px; text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 11px; text-transform: uppercase;">Prime Cost</p>
              <p style="margin: 4px 0 0; font-size: 22px; font-weight: 700; color: ${d.primeCost > 65 ? '#dc2626' : '#16a34a'};">${pct(d.primeCost)}</p>
            </div>
          </td>
        </tr>
      </table>

      <!-- Cost Breakdown -->
      <div style="background: #f8fafc; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
        <h3 style="margin: 0 0 12px; font-size: 13px; color: #475569; font-weight: 600;">💰 Desglose de Costes</h3>
        <table width="100%" style="font-size: 13px;">
          <tr>
            <td style="padding: 5px 0; color: #64748b;">COGS</td>
            <td style="padding: 5px 0; text-align: right; font-weight: 600;">${fmt(d.cogs)}</td>
            <td style="padding: 5px 0; text-align: right; width: 60px; color: ${deltaColor(d.cogs, d.prevCogs, true)}; font-size: 11px;">${delta(d.cogs, d.prevCogs)}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #64748b;">Labor</td>
            <td style="padding: 5px 0; text-align: right; font-weight: 600;">${fmt(d.labourCost)}</td>
            <td style="padding: 5px 0; text-align: right; width: 60px; color: ${deltaColor(d.labourCost, d.prevLabourCost, true)}; font-size: 11px;">${delta(d.labourCost, d.prevLabourCost)}</td>
          </tr>
          <tr style="border-top: 1px solid #e2e8f0;">
            <td style="padding: 8px 0 5px; color: #111827; font-weight: 600;">GP%</td>
            <td style="padding: 8px 0 5px; text-align: right; font-weight: 700; color: ${d.gpPercent >= 65 ? '#16a34a' : d.gpPercent >= 50 ? '#d97706' : '#dc2626'};">${pct(d.gpPercent)}</td>
            <td></td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #111827; font-weight: 600;">COL%</td>
            <td style="padding: 5px 0; text-align: right; font-weight: 700; color: ${d.colPercent <= 30 ? '#16a34a' : d.colPercent <= 35 ? '#d97706' : '#dc2626'};">${pct(d.colPercent)}</td>
            <td></td>
          </tr>
        </table>
      </div>

      <!-- Top 3 Products -->
      ${d.topProducts.length > 0 ? `
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 10px; font-size: 13px; color: #475569; font-weight: 600;">🏆 Top Productos</h3>
        <table width="100%" style="font-size: 13px; border-collapse: collapse;">
          ${topProductRows}
        </table>
      </div>
      ` : ''}

      <!-- Location Breakdown -->
      ${d.locations.length > 1 ? `
      <h3 style="margin: 0 0 10px; font-size: 13px; color: #475569; font-weight: 600;">🏪 Por Ubicación</h3>
      <table width="100%" style="font-size: 12px; border-collapse: collapse; margin-bottom: 24px;">
        <thead>
          <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
            <th style="padding: 10px 12px; text-align: left; font-weight: 600; color: #374151;">Ubicación</th>
            <th style="padding: 10px 12px; text-align: right; font-weight: 600; color: #374151;">Ventas</th>
            <th style="padding: 10px 12px; text-align: right; font-weight: 600; color: #374151;">Tickets</th>
            <th style="padding: 10px 12px; text-align: right; font-weight: 600; color: #374151;">CoL%</th>
            <th style="padding: 10px 12px; text-align: right; font-weight: 600; color: #374151;">COGS%</th>
          </tr>
        </thead>
        <tbody>${locationRows}</tbody>
      </table>
      ` : ''}

      <!-- CTA -->
      <div style="text-align: center; margin: 28px 0 8px;">
        <a href="https://josephine.app/dashboard" style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #6d28d9); color: white; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; box-shadow: 0 2px 8px rgba(124,58,237,0.3);">
          Ver Dashboard Completo →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; padding: 16px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; font-size: 11px; color: #94a3b8;">
        © ${new Date().getFullYear()} Josephine AI · Gestión inteligente para restaurantes
      </p>
      <p style="margin: 6px 0 0; font-size: 11px; color: #94a3b8;">
        Responde a este email para hacer una pregunta a Josephine 🤖
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

// ── AI Insight Generator ──

function generateAIInsight(d: { netSales: number; prevNetSales: number; forecastSales: number; orders: number; prevOrders: number; primeCost: number; colPercent: number; weatherDesc: string }): string {
  const insights: string[] = [];

  // Sales performance
  const salesDelta = d.prevNetSales > 0 ? ((d.netSales - d.prevNetSales) / d.prevNetSales * 100) : 0;
  if (salesDelta > 10) insights.push(`Excelente jornada — ventas un ${salesDelta.toFixed(0)}% por encima de la semana pasada.`);
  else if (salesDelta < -10) insights.push(`Ventas un ${Math.abs(salesDelta).toFixed(0)}% por debajo de la semana pasada. Revisa si hay factores externos.`);

  // Forecast accuracy
  if (d.forecastSales > 0) {
    const forecastDelta = ((d.netSales - d.forecastSales) / d.forecastSales * 100);
    if (Math.abs(forecastDelta) <= 5) insights.push(`El forecast fue muy preciso (${forecastDelta > 0 ? '+' : ''}${forecastDelta.toFixed(1)}% vs predicción).`);
    else if (forecastDelta > 15) insights.push(`Superaste el forecast significativamente (+${forecastDelta.toFixed(0)}%). Considera si hay un evento recurrente.`);
  }

  // Prime cost
  if (d.primeCost > 65) insights.push(`⚠️ Prime Cost en ${d.primeCost.toFixed(1)}% — por encima del objetivo. Revisa COGS y scheduling.`);
  else if (d.primeCost < 55) insights.push(`Prime Cost controlado en ${d.primeCost.toFixed(1)}%. Buen margen operativo.`);

  // Labor
  if (d.colPercent > 35) insights.push(`Coste laboral alto (${d.colPercent.toFixed(1)}%). Considera optimizar turnos mañana.`);

  // Orders
  const orderDelta = d.prevOrders > 0 ? ((d.orders - d.prevOrders) / d.prevOrders * 100) : 0;
  if (orderDelta > 15 && salesDelta < 5) insights.push(`Los pedidos subieron pero el ticket medio bajó — posible impacto de promociones.`);

  // Weather
  if (d.weatherDesc && (d.weatherDesc.toLowerCase().includes('rain') || d.weatherDesc.toLowerCase().includes('lluvia'))) {
    insights.push(`La lluvia puede haber afectado la afluencia. Planifica promociones delivery si se repite.`);
  }

  if (insights.length === 0) insights.push('Jornada normal dentro de parámetros. Mantén la estrategia actual.');

  return insights.slice(0, 2).join(' ');
}

// ── Main handler ──

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

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
    const yesterday = new Date(Date.now() - 86400000);
    const targetDate = body.date || yesterday.toISOString().split('T')[0];
    const prevWeekDate = new Date(yesterday.getTime() - 7 * 86400000).toISOString().split('T')[0];
    const targetGroupId = body.group_id;

    console.log(`Generating premium daily reports for: ${targetDate}`);

    // Get groups
    let groupsQuery = supabase.from('groups').select('id, name');
    if (targetGroupId) groupsQuery = groupsQuery.eq('id', targetGroupId);
    const { data: groups, error: groupsError } = await groupsQuery;
    if (groupsError) throw new Error(`Failed to fetch groups: ${groupsError.message}`);

    const results = [];

    for (const group of groups || []) {
      // Get subscribers
      const { data: subscriptions } = await supabase
        .from('report_subscriptions')
        .select('id, user_id, location_id, email_override')
        .eq('group_id', group.id)
        .eq('report_type', 'daily_sales')
        .eq('is_enabled', true);

      if (!subscriptions?.length) {
        console.log(`No subscribers for group ${group.name}`);
        continue;
      }

      // ── Fetch all data in parallel ──

      // 1. Yesterday's KPIs
      const kpiPromise = supabase.rpc('get_kpi_summary', {
        p_org_id: group.id,
        p_location_ids: [],
        p_from: targetDate,
        p_to: targetDate,
        p_compare_from: prevWeekDate,
        p_compare_to: prevWeekDate,
      });

      // 2. Forecast for yesterday
      const forecastPromise = supabase
        .from('forecast_daily_metrics')
        .select('predicted_sales, date')
        .eq('date', targetDate)
        .limit(1);

      // 3. Forecast accuracy (last 30 days)
      const accuracyPromise = supabase
        .from('forecast_accuracy_tracking')
        .select('mape')
        .order('created_at', { ascending: false })
        .limit(1);

      // 4. Top products
      const productsPromise = supabase
        .from('product_sales_daily')
        .select('product_name, units_sold, net_sales')
        .eq('date', targetDate)
        .order('net_sales', { ascending: false })
        .limit(3);

      // 5. Weather
      const weatherPromise = supabase
        .from('weather_cache')
        .select('temperature, description, weather_code')
        .eq('date', targetDate)
        .limit(1);

      // 6. Location breakdown (via daily sales summary RPC if exists, else skip)
      const locationsPromise = supabase
        .rpc('get_daily_sales_summary', {
          p_group_id: group.id,
          p_date: targetDate,
        }).catch(() => ({ data: null }));

      const [kpiRes, forecastRes, accuracyRes, productsRes, weatherRes, locationsRes] = await Promise.all([
        kpiPromise, forecastPromise, accuracyPromise, productsPromise, weatherPromise, locationsPromise
      ]);

      const kpi = (kpiRes.data as any)?.[0] || {};
      const current = kpi.current || kpi || {};
      const previous = kpi.previous || {};

      const forecastRow = (forecastRes.data as any)?.[0];
      const accuracyRow = (accuracyRes.data as any)?.[0];
      const products = (productsRes.data as any[]) || [];
      const weather = (weatherRes.data as any)?.[0];
      const locData = (locationsRes as any)?.data;

      const netSales = current.net_sales || 0;
      const orders = current.orders_count || 0;
      const labourCost = current.labour_cost || 0;
      const cogs = current.cogs || 0;
      const gpPercent = current.gp_percent || 0;
      const colPercent = current.col_percent || 0;
      const primeCost = netSales > 0 ? ((labourCost + cogs) / netSales * 100) : 0;

      const prevNetSales = previous.net_sales || 0;
      const prevOrders = previous.orders_count || 0;
      const prevLabourCost = previous.labour_cost || 0;
      const prevCogs = previous.cogs || 0;

      const forecastSales = forecastRow?.predicted_sales || 0;
      const forecastAccuracy = accuracyRow?.mape ? (100 - accuracyRow.mape) : 0;

      const weatherDesc = weather?.description || '';
      const weatherIcon = weather ? weatherEmoji(weather.weather_code || 800) : '🌤️';
      const weatherTemp = weather?.temperature || 0;

      const topProducts = products.map((p: any) => ({
        name: p.product_name || 'Sin nombre',
        quantity: p.units_sold || 0,
        sales: p.net_sales || 0,
      }));

      const locations = locData?.locations || [];

      // Generate AI insight
      const aiInsight = generateAIInsight({
        netSales, prevNetSales, forecastSales, orders, prevOrders, primeCost, colPercent, weatherDesc
      });

      const reportData: ReportData = {
        date: targetDate,
        groupName: group.name,
        netSales, orders, avgCheck: orders > 0 ? netSales / orders : 0,
        labourCost, cogs, gpPercent, colPercent, primeCost,
        prevNetSales, prevOrders, prevLabourCost, prevCogs,
        forecastSales, forecastAccuracy,
        weatherDesc, weatherIcon, weatherTemp,
        topProducts, aiInsight, locations,
      };

      // Send to each subscriber
      for (const sub of subscriptions) {
        try {
          let email = sub.email_override;
          if (!email) {
            const { data: authUser } = await supabase.auth.admin.getUserById(sub.user_id);
            email = authUser?.user?.email;
          }
          if (!email) continue;

          const subject = `☀️ ${group.name} — ${fmt(netSales)} ayer ${forecastSales > 0 ? `(${forecastSales > netSales ? '↓' : '↑'} vs forecast)` : ''}`;
          const html = generatePremiumEmailHtml(reportData);

          await sendEmail(email, subject, html);

          await supabase.from('report_logs').insert({
            report_type: 'daily_sales',
            group_id: group.id,
            location_id: sub.location_id,
            recipient_email: email,
            status: 'sent',
            report_data: reportData
          });

          results.push({ email, status: 'sent', group: group.name });
          console.log(`Premium daily report → ${email}`);

        } catch (err: any) {
          console.error(`Error sending to ${sub.user_id}:`, err);
          await supabase.from('report_logs').insert({
            report_type: 'daily_sales',
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
      JSON.stringify({ success: true, date: targetDate, emails_processed: results.length, results }),
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
