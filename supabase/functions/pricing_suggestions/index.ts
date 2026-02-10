import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MenuItem {
  name: string;
  category: string;
  units: number;
  sales: number;
  cogs: number;
  margin_pct: number;
  classification: string;
  popularity_share: number;
}

interface PricingRequest {
  items: MenuItem[];
  totalSales: number;
  totalUnits: number;
  locationName: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { items, totalSales, totalUnits, locationName } = (await req.json()) as PricingRequest;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build items summary for the AI - top 20 items
    const sortedItems = [...items].sort((a, b) => b.sales - a.sales).slice(0, 20);
    const itemsSummary = sortedItems
      .map((item) => {
        const avgPrice = item.units > 0 ? (item.sales / item.units).toFixed(2) : "0";
        return `- ${item.name} (${item.category}): ${item.units} uds, €${avgPrice}/ud, margen ${item.margin_pct.toFixed(1)}%, clasificación: ${item.classification}`;
      })
      .join("\n");

    // Category summary
    const categoryMap = new Map<string, { sales: number; units: number; items: number }>();
    for (const item of items) {
      const existing = categoryMap.get(item.category) || { sales: 0, units: 0, items: 0 };
      existing.sales += item.sales;
      existing.units += item.units;
      existing.items++;
      categoryMap.set(item.category, existing);
    }
    const categorySummary = Array.from(categoryMap.entries())
      .sort((a, b) => b[1].sales - a[1].sales)
      .map(([cat, data]) => `- ${cat}: €${data.sales.toFixed(0)} ventas, ${data.units} uds, ${data.items} productos`)
      .join("\n");

    const systemPrompt = `Eres un consultor de pricing de restaurantes especializado en revenue management.

Tu trabajo es analizar el menú de un restaurante y dar recomendaciones ESPECÍFICAS de pricing.

Formato ESTRICTO de respuesta (JSON array):
[
  {
    "product": "Nombre del producto",
    "current_price": 12.50,
    "suggested_price": 13.50,
    "change_pct": 8.0,
    "reason": "Alta demanda con margen bajo. Elasticidad favorable.",
    "estimated_impact_eur": 450,
    "priority": "high"
  }
]

Reglas:
- Máximo 6 recomendaciones
- Solo sugiere cambios que tengan sentido económico
- Para "plow_horse" (alta demanda, bajo margen): sube precio 3-8%
- Para "puzzle" (baja demanda, alto margen): baja precio 5-10% para ganar volumen
- Para "star" (alta demanda, alto margen): pequeño ajuste 1-3% o mantener
- Para "dog" (baja demanda, bajo margen): sugiere eliminar o reformular
- priority: "high" (impacto >€300/mes), "medium" (€100-300), "low" (<€100)
- estimated_impact_eur es el impacto MENSUAL estimado en euros
- reason en español, máximo 15 palabras
- Responde SOLO con el JSON array, sin explicaciones`;

    const userPrompt = `Analiza este menú y genera recomendaciones de pricing:

**Local**: ${locationName}
**Ventas totales periodo**: €${totalSales.toFixed(0)}
**Unidades totales**: ${totalUnits}

**Categorías**:
${categorySummary}

**Top 20 productos**:
${itemsSummary}

Genera las recomendaciones de pricing en formato JSON.`;

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
          { role: "user", content: userPrompt },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit. Espera un momento." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "No se pudo generar las sugerencias" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "[]";

    // Parse the JSON from the AI response
    let suggestions;
    try {
      // Handle cases where AI wraps in markdown code block
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      suggestions = JSON.parse(cleanContent);
    } catch {
      console.error("Failed to parse AI pricing response:", content);
      suggestions = [];
    }

    return new Response(
      JSON.stringify({ suggestions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("pricing_suggestions error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
