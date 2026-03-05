/**
 * send_weekly_report — Professional weekly summary email
 * 
 * Production-grade: no emojis, real data from verified tables,
 * env-driven sender/URL, graceful fallbacks.
 * 
 * Triggered by pg_cron every Monday at 8:00 AM.
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

function delta(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+100%' : '—';
  const d = ((current - previous) / previous) * 100;
  return `${d >= 0 ? '+' : ''}${d.toFixed(1)}%`;
}

function deltaColor(current: number, previous: number, invert = false): string {
  if (previous === 0) return '#6b7280';
  const d = ((current - previous) / previous) * 100;
  return (invert ? d <= 0 : d >= 0) ? '#16a34a' : '#dc2626';
}

interface WeekRow { date: string; net_sales: number; orders_count: number; labour_cost: number; cogs: number; }

function generateWeeklyHtml(
  groupName: string, appUrl: string,
  weekStart: string, weekEnd: string,
  days: WeekRow[], prevDays: WeekRow[],
): string {
  const totalSales = days.reduce((s, r) => s + r.net_sales, 0);
  const totalOrders = days.reduce((s, r) => s + r.orders_count, 0);
  const totalLabour = days.reduce((s, r) => s + r.labour_cost, 0);
  const totalCogs = days.reduce((s, r) => s + r.cogs, 0);
  const avgCheck = totalOrders > 0 ? totalSales / totalOrders : 0;
  const primeCost = totalSales > 0 ? ((totalLabour + totalCogs) / totalSales * 100) : 0;

  const prevTotalSales = prevDays.reduce((s, r) => s + r.net_sales, 0);
  const prevTotalOrders = prevDays.reduce((s, r) => s + r.orders_count, 0);

  const maxSales = Math.max(...days.map(d => d.net_sales), 1);
  const dailyBars = days.map(d => {
    const heightPct = (d.net_sales / maxSales) * 100;
    const dayName = new Date(d.date).toLocaleDateString('es-ES', { weekday: 'short' });
    return `
      <td style="padding: 4px; text-align: center; vertical-align: bottom;">
        <div style="height: 80px; display: flex; align-items: flex-end; justify-content: center;">
          <div style="width: 28px; background: linear-gradient(180deg, #7c3aed 0%, #6d28d9 100%); border-radius: 4px 4px 0 0; height: ${heightPct}%;"></div>
        </div>
        <p style="margin: 4px 0 0; font-size: 10px; color: #6b7280; text-transform: uppercase;">${dayName}</p>
        <p style="margin: 2px 0 0; font-size: 11px; color: #374151; font-weight: 500;">${fmt(d.net_sales)}</p>
      </td>
    `;
  }).join('');

  const wsDate = new Date(weekStart).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
  const weDate = new Date(weekEnd).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
  <div style="max-width: 640px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
    
    <div style="background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #4c1d95 100%); padding: 28px 32px;">
      <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">Resumen Semanal</h1>
      <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 14px;">
        ${groupName} &mdash; ${wsDate} al ${weDate}
      </p>
    </div>

    <div style="padding: 28px 32px;">
      <!-- Hero -->
      <div style="text-align: center; margin-bottom: 24px;">
        <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Ventas Totales</p>
        <p style="margin: 4px 0; font-size: 36px; font-weight: 800; color: #111827;">${fmt(totalSales)}</p>
        <span style="font-size: 12px; color: ${deltaColor(totalSales, prevTotalSales)}; font-weight: 600;">
          ${delta(totalSales, prevTotalSales)} vs semana anterior
        </span>
      </div>

      <!-- KPI Cards -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
        <tr>
          <td style="padding: 4px;">
            <div style="background: #f9fafb; border-radius: 10px; padding: 14px; text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 11px; text-transform: uppercase;">Pedidos</p>
              <p style="margin: 4px 0 0; font-size: 22px; font-weight: 700; color: #111827;">${totalOrders}</p>
              <p style="margin: 2px 0 0; font-size: 11px; color: ${deltaColor(totalOrders, prevTotalOrders)};">${delta(totalOrders, prevTotalOrders)}</p>
            </div>
          </td>
          <td style="padding: 4px;">
            <div style="background: #f9fafb; border-radius: 10px; padding: 14px; text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 11px; text-transform: uppercase;">Ticket Medio</p>
              <p style="margin: 4px 0 0; font-size: 22px; font-weight: 700; color: #111827;">${fmt(avgCheck)}</p>
            </div>
          </td>
          <td style="padding: 4px;">
            <div style="background: ${primeCost > 65 ? '#fef2f2' : '#f0fdf4'}; border-radius: 10px; padding: 14px; text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 11px; text-transform: uppercase;">Prime Cost</p>
              <p style="margin: 4px 0 0; font-size: 22px; font-weight: 700; color: ${primeCost > 65 ? '#dc2626' : '#16a34a'};">${pct(primeCost)}</p>
            </div>
          </td>
        </tr>
      </table>

      <!-- Daily Chart -->
      <h3 style="margin: 0 0 10px; font-size: 13px; color: #475569; font-weight: 600;">Evolucion Diaria</h3>
      <div style="background: #f9fafb; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>${dailyBars}</tr></table>
      </div>

      <!-- Cost Breakdown -->
      <div style="background: #f8fafc; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
        <h3 style="margin: 0 0 12px; font-size: 13px; color: #475569; font-weight: 600;">Desglose de Costes</h3>
        <table width="100%" style="font-size: 13px;">
          <tr>
            <td style="padding: 5px 0; color: #64748b;">COGS</td>
            <td style="padding: 5px 0; text-align: right; font-weight: 600;">${fmt(totalCogs)}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #64748b;">Labor</td>
            <td style="padding: 5px 0; text-align: right; font-weight: 600;">${fmt(totalLabour)}</td>
          </tr>
          <tr style="border-top: 1px solid #e2e8f0;">
            <td style="padding: 8px 0 5px; color: #111827; font-weight: 600;">Margen Bruto</td>
            <td style="padding: 8px 0 5px; text-align: right; font-weight: 700; color: #16a34a;">${fmt(totalSales - totalLabour - totalCogs)}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 28px 0 8px;">
        <a href="${appUrl}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #6d28d9); color: white; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; box-shadow: 0 2px 8px rgba(124,58,237,0.3);">
          Ver Dashboard Completo
        </a>
      </div>
    </div>

    <div style="background: #f8fafc; padding: 16px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; font-size: 11px; color: #94a3b8;">Josephine AI &mdash; Gestion inteligente para restaurantes</p>
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

    // Calculate last week Mon-Sun
    const today = new Date();
    const lastMonday = new Date(today);
    lastMonday.setDate(today.getDate() - today.getDay() - 6);
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);

    const weekStart = body.week_start || lastMonday.toISOString().split('T')[0];
    const weekEnd = lastSunday.toISOString().split('T')[0];

    // Previous week for comparison
    const prevMonday = new Date(lastMonday);
    prevMonday.setDate(prevMonday.getDate() - 7);
    const prevSunday = new Date(prevMonday);
    prevSunday.setDate(prevMonday.getDate() + 6);
    const prevStart = prevMonday.toISOString().split('T')[0];
    const prevEnd = prevSunday.toISOString().split('T')[0];

    const targetGroupId = body.group_id;

    console.log(`[weekly_report] Week: ${weekStart} to ${weekEnd}`);

    let groupsQuery = supabase.from('groups').select('id, name');
    if (targetGroupId) groupsQuery = groupsQuery.eq('id', targetGroupId);
    const { data: groups } = await groupsQuery;

    const results: any[] = [];

    for (const group of groups || []) {
      const { data: subs } = await supabase
        .from('report_subscriptions')
        .select('id, user_id, email_override')
        .eq('group_id', group.id)
        .eq('report_type', 'weekly_summary')
        .eq('is_enabled', true);

      if (!subs?.length) continue;

      // Fetch this week + prev week sales in parallel
      const [thisWeekRes, prevWeekRes] = await Promise.all([
        supabase
          .from('sales_daily_unified')
          .select('date, net_sales, orders_count, labour_cost, cogs')
          .eq('group_id', group.id)
          .gte('date', weekStart)
          .lte('date', weekEnd)
          .order('date')
          .catch(() => ({ data: [] })),
        supabase
          .from('sales_daily_unified')
          .select('date, net_sales, orders_count, labour_cost, cogs')
          .eq('group_id', group.id)
          .gte('date', prevStart)
          .lte('date', prevEnd)
          .order('date')
          .catch(() => ({ data: [] })),
      ]);

      const days = ((thisWeekRes as any)?.data || []) as WeekRow[];
      const prevDays = ((prevWeekRes as any)?.data || []) as WeekRow[];

      if (days.length === 0) {
        console.log(`[weekly_report] No data for ${group.name}`);
        continue;
      }

      const totalSales = days.reduce((s, r) => s + (r.net_sales || 0), 0);
      const html = generateWeeklyHtml(group.name, appUrl, weekStart, weekEnd, days, prevDays);

      for (const sub of subs) {
        try {
          let email = sub.email_override;
          if (!email) {
            const { data: u } = await supabase.auth.admin.getUserById(sub.user_id);
            email = u?.user?.email;
          }
          if (!email) continue;

          const subject = `${group.name} — Semana ${new Date(weekStart).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} al ${new Date(weekEnd).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} — ${fmt(totalSales)}`;
          await sendEmail(email, subject, html, senderEmail);

          await supabase.from('report_logs').insert({
            report_type: 'weekly_summary', group_id: group.id,
            recipient_email: email, status: 'sent',
            report_data: { totalSales, days: days.length },
          }).catch(() => { });

          results.push({ email, status: 'sent' });
        } catch (err: any) {
          console.error(`[weekly_report] Error: ${err.message}`);
          results.push({ user_id: sub.user_id, status: 'failed', error: err.message });
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, weekStart, results }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[weekly_report] Fatal:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders } });
  }
});
