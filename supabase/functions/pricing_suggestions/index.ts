import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Canonical Menu Engineering item — pre-classified by the backend.
 * AI MUST NOT reinterpret or recompute classification.
 */
interface CanonicalItem {
  name: string;
  category: string;
  classification: string;         // FINAL — do not reinterpret
  classification_reason: string;  // Human-readable explanation
  selling_price_ex_vat: number;   // € ex VAT
  unit_food_cost: number;         // € from recipe or fallback
  unit_gross_profit: number;      // € = selling_price_ex_vat - unit_food_cost
  units_sold: number;
  popularity_pct: number;
  cost_source: string;            // recipe_actual | fallback_average | unknown
  data_confidence: string;        // high | medium | low
}

interface PricingRequest {
  methodology?: string;           // Should be 'kasavana_smith_1982'
  schema_version?: number;
  is_canonical?: boolean;
  thresholds?: {
    ideal_average_popularity: number;
    average_gross_profit: number;
  };
  items: CanonicalItem[];
  totalSales: number;
  totalUnits: number;
  locationName: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as PricingRequest;
    const { items, totalSales, totalUnits, locationName, thresholds } = body;

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    // Build items summary using CANONICAL fields — no reinterpretation
    const sortedItems = [...items]
      .sort((a, b) => (b.unit_gross_profit * b.units_sold) - (a.unit_gross_profit * a.units_sold))
      .slice(0, 20);

    const itemsSummary = sortedItems
      .map((item) =>
        `- ${item.name} [${item.classification.toUpperCase()}]: ` +
        `€${item.selling_price_ex_vat.toFixed(2)} precio, ` +
        `€${item.unit_food_cost.toFixed(2)} coste, ` +
        `GP €${item.unit_gross_profit.toFixed(2)}/ud, ` +
        `${item.units_sold} uds, ` +
        `pop ${item.popularity_pct.toFixed(1)}%, ` +
        `confianza: ${item.data_confidence}`
      )
      .join("\n");

    // Thresholds context
    const thresholdsCtx = thresholds
      ? `\nUmbrales canónicos (Kasavana-Smith):\n- Popularidad: ≥${thresholds.ideal_average_popularity.toFixed(1)}% = alta\n- GP unitario: ≥€${thresholds.average_gross_profit.toFixed(2)} = alto\n`
      : '';

    const systemPrompt = `Eres un consultor de pricing de restaurantes.

IMPORTANTE: Los productos ya están clasificados usando la metodología Kasavana-Smith (1982).
La clasificación es FINAL y ya fue calculada por el sistema. NO la recomputes.
Tu trabajo es SOLO sugerir ajustes de precio basados en la clasificación dada.

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

Reglas de pricing POR CLASIFICACIÓN:
- STAR (popular + rentable): micro-ajuste +1-3% o mantener. No arriesgar.
- PLOW_HORSE (popular + bajo GP): subir 3-8%. La demanda absorbe la subida.
- PUZZLE (baja pop + alto GP): bajar 5-10% para ganar volumen, o mejorar visibilidad.
- DOG (baja pop + bajo GP): sugerir eliminar o reformular. No invertir más.

Reglas de confianza:
- Si data_confidence = "low", añadir "(dato estimado)" a la razón
- Si data_confidence = "low", prioridad máxima = "medium"

Reglas generales:
- Máximo 6 recomendaciones
- priority: "high" (>€300/mes), "medium" (€100-300), "low" (<€100)
- estimated_impact_eur = impacto MENSUAL estimado en euros
- reason en español, máximo 20 palabras
- Responde SOLO con el JSON array`;

    const userPrompt = `Analiza y sugiere precios:

**Local**: ${locationName}
**Ventas periodo**: €${totalSales.toFixed(0)} · ${totalUnits} uds
${thresholdsCtx}
**Productos (clasificación ya calculada)**:
${itemsSummary}

Genera recomendaciones de pricing en formato JSON.`;

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

    let suggestions;
    try {
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
