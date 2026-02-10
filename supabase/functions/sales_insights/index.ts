import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SalesData {
  salesToDate: number;
  salesToDateDelta: number;
  avgCheckSize: number;
  avgCheckSizeDelta: number;
  dwellTime: number | null;
  channels: {
    channel: string;
    sales: number;
    salesDelta: number;
  }[];
  categories: {
    category: string;
    amount: number;
    ratio: number;
  }[];
  topProducts: {
    name: string;
    value: number;
    percentage: number;
  }[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { salesData, question } = await req.json() as { salesData: SalesData; question?: string };
    
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const isPositive = salesData.salesToDateDelta >= 0;
    const deltaDirection = isPositive ? "above" : "below";
    const deltaAbs = Math.abs(salesData.salesToDateDelta).toFixed(1);

    // Build context about the sales data
    const channelsSummary = salesData.channels
      .map(c => `${c.channel}: €${c.sales.toFixed(0)} (${c.salesDelta >= 0 ? '+' : ''}${c.salesDelta.toFixed(1)}%)`)
      .join(", ");

    const categoriesSummary = salesData.categories
      .map(c => `${c.category}: ${c.ratio}%`)
      .join(", ");

    const topProductsSummary = salesData.topProducts.slice(0, 5)
      .map(p => `${p.name}: €${p.value.toFixed(0)} (${p.percentage.toFixed(1)}%)`)
      .join(", ");

    const systemPrompt = `You are Josephine, an AI business intelligence assistant for restaurant operations. 
You analyze sales data and provide actionable insights in a friendly, professional manner.
Always be specific with numbers and percentages. Keep responses concise but insightful.
Format your responses with clear sections using markdown.
Focus on:
1. Why sales are performing as they are
2. Which channels/products are driving performance
3. Actionable recommendations
Respond in the same language as the user's question (Spanish if the question is in Spanish).`;

    const userPrompt = question || `Analyze the following sales data and explain why sales are ${deltaDirection} forecast by ${deltaAbs}%:

**Current Performance:**
- Total Sales: €${salesData.salesToDate.toFixed(0)}
- Sales vs Forecast: ${isPositive ? '+' : ''}${deltaAbs}%
- Average Check Size: €${salesData.avgCheckSize.toFixed(2)} (${salesData.avgCheckSizeDelta >= 0 ? '+' : ''}${salesData.avgCheckSizeDelta.toFixed(1)}% vs forecast)
${salesData.dwellTime !== null ? `- Dwell Time: ${salesData.dwellTime} minutes` : ''}

**Channel Performance:**
${channelsSummary}

**Category Breakdown:**
${categoriesSummary}

**Top Products:**
${topProductsSummary}

Please provide:
1. A brief summary of why performance is ${isPositive ? 'positive' : 'negative'}
2. Top 3 drivers of the performance
3. 2-3 actionable recommendations`;

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
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to generate insights" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("sales_insights error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
