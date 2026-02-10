import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReviewReplyRequest {
  reviewText: string;
  reviewRating: number;
  authorName: string;
  platform: string;
  locationName: string;
  tone: "friendly" | "professional" | "concise";
  currentReply?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reviewText, reviewRating, authorName, platform, locationName, tone, currentReply } =
      (await req.json()) as ReviewReplyRequest;

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const toneInstructions: Record<string, string> = {
      friendly:
        "Tono cercano, cálido y personal. Usa el nombre del cliente. Transmite que nos importa de verdad. Puedes ser informal pero educado.",
      professional:
        "Tono formal y pulido. Transmite seriedad y compromiso con la calidad. Sin emoticonos.",
      concise:
        "Máximo 2 frases. Directo y agradecido. Sin florituras.",
    };

    const isNegative = reviewRating <= 2;
    const isNeutral = reviewRating === 3;

    const systemPrompt = `Eres el community manager de Josephine, un grupo de restaurantes premium en Madrid.

Tu trabajo es responder a reseñas de clientes en ${platform} manteniendo la voz de marca.

Reglas estrictas:
- Responde SIEMPRE en español
- ${toneInstructions[tone]}
- Si la reseña es negativa (1-2 estrellas): reconoce el problema, discúlpate sinceramente, ofrece solución concreta
- Si la reseña es neutra (3 estrellas): agradece y menciona que trabajamos para mejorar
- Si la reseña es positiva (4-5 estrellas): agradece genuinamente, destaca algo específico de su comentario
- NUNCA inventes hechos que no estén en la reseña
- NUNCA uses hashtags
- Máximo 100 palabras
- NO uses saludo tipo "Estimado/a" — empieza directamente agradeciendo o reconociendo
- Incluye el nombre del local (${locationName}) naturalmente
- Firma como "Equipo Josephine"`;

    const userPrompt = `Genera una respuesta para esta reseña:

**Cliente**: ${authorName}
**Puntuación**: ${reviewRating}/5 estrellas
**Plataforma**: ${platform}
**Local**: ${locationName}
**Reseña**: "${reviewText}"

${currentReply ? `**Borrador actual** (reescribe con el nuevo tono): "${currentReply}"` : ""}

Genera SOLO la respuesta, sin explicaciones ni comillas.`;

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
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos AI agotados." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "No se pudo generar la respuesta" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || "";

    return new Response(
      JSON.stringify({ reply }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("review_reply error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
