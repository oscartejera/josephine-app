import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DashboardMetrics {
  sales: number;
  salesDelta: number;
  covers: number;
  coversDelta: number;
  avgTicket: number;
  avgTicketDelta: number;
  laborCost: number;
  laborDelta: number;
  colPercent: number;
  colDelta: number;
  cogsPercent: number;
  cogsDelta: number;
  gpPercent: number;
  gpDelta: number;
  locationName: string;
  periodLabel: string;
  topProducts: { name: string; sales: number; margin: number }[];
  // Optional enrichment
  forecastSales?: number;
  forecastVariance?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { metrics } = await req.json() as { metrics: DashboardMetrics };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const salesTrend = metrics.salesDelta >= 0 ? "subieron" : "bajaron";
    const colStatus = metrics.colPercent > 30 ? "por encima del objetivo (30%)" : "dentro del objetivo";

    const topProductsStr = metrics.topProducts
      .slice(0, 5)
      .map((p, i) => `${i + 1}. ${p.name}: €${p.sales.toFixed(0)} (margen ${p.margin}%)`)
      .join("\n");

    const systemPrompt = `Eres Josephine, la directora de operaciones AI de un grupo de restaurantes en Madrid.

Tu rol NO es mostrar gráficos ni tablas. Tu rol es ser la VOZ del negocio: explicar QUÉ está pasando, POR QUÉ y QUÉ HACER.

Estilo de comunicación:
- Habla como una COO experimentada, directa y accionable
- Empieza SIEMPRE con el insight más importante del día (1-2 frases)
- Usa viñetas cortas para las acciones concretas
- Máximo 150 palabras en total
- En español
- NO uses encabezados markdown ni formato excesivo
- SÍ usa negrita (**texto**) para datos clave
- Termina con UNA acción prioritaria clara

Ejemplo de tono:
"Las ventas cayeron un 8% ayer en Centro. El problema principal fue la franja de 14:00-16:00 donde perdimos 12 covers respecto al martes anterior. Recomiendo:
• Revisar si hubo un problema de servicio o si fue efecto clima
• Considerar una promo de mediodía para recuperar tráfico
Acción prioritaria: habla con el manager de Centro sobre el turno de comidas."`;

    const userPrompt = `Genera el briefing diario con estos datos:

**Ventas**: €${metrics.sales.toLocaleString()} (${metrics.salesDelta >= 0 ? '+' : ''}${metrics.salesDelta.toFixed(1)}% vs periodo anterior)
**GP%**: ${metrics.gpPercent.toFixed(1)}% (${metrics.gpDelta >= 0 ? '+' : ''}${metrics.gpDelta.toFixed(1)}pp)
**COGS**: ${metrics.cogsPercent.toFixed(1)}%
**Labor**: €${metrics.laborCost.toLocaleString()} — COL% ${metrics.colPercent.toFixed(1)}% (${colStatus})
**Covers**: ${metrics.covers} (${metrics.coversDelta >= 0 ? '+' : ''}${metrics.coversDelta.toFixed(1)}% vs anterior)
**Ticket medio**: €${metrics.avgTicket.toFixed(2)} (${metrics.avgTicketDelta >= 0 ? '+' : ''}${metrics.avgTicketDelta.toFixed(1)}%)
**Local**: ${metrics.locationName}
**Periodo**: ${metrics.periodLabel}

**Top productos**:
${topProductsStr}

Genera el briefing. Sé directo, identifica el problema o la oportunidad más importante, y da acciones concretas.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to generate narrative" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("dashboard_narratives error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
