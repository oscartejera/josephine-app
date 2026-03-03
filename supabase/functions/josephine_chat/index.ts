/**
 * josephine_chat — Conversational AI assistant for restaurant operations
 * Uses OpenAI GPT-4o with Supabase DB context
 * Returns JSON (not SSE stream) for simple integration
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { question, org_id, location_id } = await req.json();

        const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
        if (!OPENAI_API_KEY) {
            return new Response(
                JSON.stringify({ reply: "⚠️ OPENAI_API_KEY no está configurado en Supabase. Ve a Dashboard → Edge Functions → Secrets." }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Fetch real-time business data from Supabase for context
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const admin = createClient(supabaseUrl, serviceKey);

        let businessContext = "";

        try {
            // Get today's sales
            const today = new Date().toISOString().split("T")[0];
            const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

            const { data: salesData } = await admin
                .from("sales_daily_unified")
                .select("ds, net_sales, order_count, avg_check")
                .eq("org_id", org_id)
                .gte("ds", weekAgo)
                .lte("ds", today)
                .order("ds", { ascending: false })
                .limit(7);

            if (salesData && salesData.length > 0) {
                const todaySales = salesData[0];
                const avgSales = salesData.reduce((s: number, r: any) => s + Number(r.net_sales || 0), 0) / salesData.length;
                businessContext += `\n**Ventas recientes (últimos ${salesData.length} días):**`;
                for (const row of salesData) {
                    businessContext += `\n- ${row.ds}: €${Number(row.net_sales || 0).toFixed(0)} (${row.order_count || 0} pedidos, ticket medio €${Number(row.avg_check || 0).toFixed(2)})`;
                }
                businessContext += `\n- Media semanal: €${avgSales.toFixed(0)}/día`;
            }

            // Get employee count
            const { count: empCount } = await admin
                .from("employees")
                .select("id", { count: "exact", head: true })
                .eq("org_id", org_id)
                .eq("is_active", true);
            businessContext += `\n\n**Equipo activo:** ${empCount || 0} empleados`;

            // Get low stock items
            const { data: lowStock } = await admin
                .from("inventory_items")
                .select("name, current_stock, min_stock, unit")
                .eq("org_id", org_id)
                .eq("is_active", true)
                .not("min_stock", "is", null)
                .limit(100);

            const actualLow = (lowStock || []).filter((i: any) =>
                i.current_stock !== null && i.min_stock !== null && Number(i.current_stock) < Number(i.min_stock)
            );
            if (actualLow.length > 0) {
                businessContext += `\n\n**Stock bajo (${actualLow.length} artículos):**`;
                for (const item of actualLow.slice(0, 5)) {
                    businessContext += `\n- ${item.name}: ${item.current_stock}/${item.min_stock} ${item.unit || "ud"}`;
                }
            }

            // Recent events
            const { data: events } = await admin
                .from("event_calendar")
                .select("name, event_date, impact_multiplier, event_type")
                .eq("is_active", true)
                .gte("event_date", today)
                .order("event_date")
                .limit(5);

            if (events && events.length > 0) {
                businessContext += `\n\n**Próximos eventos:**`;
                for (const ev of events) {
                    const impactStr = Number(ev.impact_multiplier) > 1
                        ? `+${Math.round((Number(ev.impact_multiplier) - 1) * 100)}%`
                        : `${Math.round((Number(ev.impact_multiplier) - 1) * 100)}%`;
                    businessContext += `\n- ${ev.event_date}: ${ev.name} (${ev.event_type}, impacto ventas: ${impactStr})`;
                }
            }
        } catch (dbErr) {
            console.error("DB context error:", dbErr);
            businessContext = "\n(No se pudieron cargar datos del negocio)";
        }

        const systemPrompt = `Eres Josephine, la directora de operaciones AI de un grupo de restaurantes.

Tu rol es responder preguntas sobre el negocio usando los datos reales que tienes disponibles.

Reglas:
- Responde SIEMPRE en español
- Sé directa, concisa y accionable (máximo 200 palabras)
- Usa datos concretos cuando los tengas
- Si no tienes datos suficientes, dilo honestamente
- Formato: usa viñetas y negritas para facilitar lectura
- NO inventes datos que no tengas

**Datos actuales del negocio:**
${businessContext || "(Sin datos disponibles)"}`;

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: question || "Dame un resumen del negocio hoy" },
                ],
                max_tokens: 500,
                temperature: 0.7,
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("OpenAI error:", response.status, errText);
            return new Response(
                JSON.stringify({ reply: `⚠️ Error del servicio AI (${response.status}). Intenta de nuevo.` }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || "No pude generar una respuesta.";

        return new Response(
            JSON.stringify({ reply }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("josephine_chat error:", error);
        return new Response(
            JSON.stringify({ reply: "⚠️ Error interno del asistente. Intenta de nuevo." }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
