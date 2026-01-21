import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LabourData {
  // KPIs
  actualSales: number;
  forecastSales: number;
  salesDelta: number;
  actualCOL: number;
  plannedCOL: number;
  colDelta: number;
  actualSPLH: number;
  plannedSPLH: number;
  splhDelta: number;
  actualOPLH: number;
  plannedOPLH: number;
  oplhDelta: number;
  actualHours: number;
  plannedHours: number;
  hoursDelta: number;
  actualLaborCost: number;
  plannedLaborCost: number;
  // Locations breakdown
  locations: {
    name: string;
    salesActual: number;
    salesProjected: number;
    colActual: number;
    colProjected: number;
    splhActual: number;
    splhProjected: number;
  }[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { labourData, question } = await req.json() as { labourData: LabourData; question?: string };
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const colIsGood = labourData.colDelta <= 0; // Lower COL is better
    const splhIsGood = labourData.splhDelta >= 0; // Higher SPLH is better
    const salesIsGood = labourData.salesDelta >= 0;

    // Build locations summary
    const locationsSummary = labourData.locations
      .filter(l => l.name !== 'Total / Average')
      .slice(0, 6)
      .map(l => {
        const colDiff = ((l.colActual - l.colProjected) / l.colProjected * 100).toFixed(1);
        const splhDiff = ((l.splhActual - l.splhProjected) / l.splhProjected * 100).toFixed(1);
        return `${l.name}: COL ${l.colActual.toFixed(1)}% (${Number(colDiff) >= 0 ? '+' : ''}${colDiff}% vs plan), SPLH €${l.splhActual.toFixed(0)} (${Number(splhDiff) >= 0 ? '+' : ''}${splhDiff}% vs plan)`;
      })
      .join("\n");

    // Identify best and worst performers
    const sortedByCOL = [...labourData.locations]
      .filter(l => l.name !== 'Total / Average')
      .sort((a, b) => a.colActual - b.colActual);
    
    const bestCOL = sortedByCOL[0];
    const worstCOL = sortedByCOL[sortedByCOL.length - 1];

    const sortedBySPLH = [...labourData.locations]
      .filter(l => l.name !== 'Total / Average')
      .sort((a, b) => b.splhActual - a.splhActual);
    
    const bestSPLH = sortedBySPLH[0];
    const worstSPLH = sortedBySPLH[sortedBySPLH.length - 1];

    const systemPrompt = `You are Josephine, an AI workforce analytics assistant for restaurant operations.
You specialize in labor cost optimization, staffing efficiency, and schedule optimization.
Always be specific with numbers and percentages. Keep responses concise but actionable.
Format your responses with clear sections using markdown.

Key metrics you understand:
- COL% (Cost of Labor as % of Sales): Lower is better. Industry target: 25-32%
- SPLH (Sales Per Labor Hour): Higher is better. Measures productivity.
- OPLH (Orders Per Labor Hour): Higher is better. Measures throughput.

Focus on:
1. Why labor metrics are over/under target
2. Which locations are performing well vs poorly
3. Specific staffing recommendations (shift adjustments, peak hour coverage)
4. Cost savings opportunities

Respond in the same language as the user's question (Spanish if the question is in Spanish).`;

    const defaultAnalysis = `Analyze the following labour data and provide insights:

**Overall Performance (Current Period):**
- Sales: €${labourData.actualSales.toLocaleString()} (${salesIsGood ? '+' : ''}${labourData.salesDelta.toFixed(1)}% vs forecast)
- Labor Cost: €${labourData.actualLaborCost.toLocaleString()} vs €${labourData.plannedLaborCost.toLocaleString()} planned
- Labor Hours: ${labourData.actualHours.toFixed(0)}h vs ${labourData.plannedHours.toFixed(0)}h planned (${labourData.hoursDelta >= 0 ? '+' : ''}${labourData.hoursDelta.toFixed(1)}%)

**Efficiency Metrics:**
- COL%: ${labourData.actualCOL.toFixed(2)}% actual vs ${labourData.plannedCOL.toFixed(2)}% planned (${colIsGood ? '✓ Under target' : '⚠ Over target'}, ${labourData.colDelta >= 0 ? '+' : ''}${labourData.colDelta.toFixed(1)}%)
- SPLH: €${labourData.actualSPLH.toFixed(2)} actual vs €${labourData.plannedSPLH.toFixed(2)} planned (${splhIsGood ? '✓ Above target' : '⚠ Below target'}, ${labourData.splhDelta >= 0 ? '+' : ''}${labourData.splhDelta.toFixed(1)}%)
- OPLH: ${labourData.actualOPLH.toFixed(2)} orders/h actual vs ${labourData.plannedOPLH.toFixed(2)} planned

**Location Breakdown:**
${locationsSummary}

**Best/Worst Performers:**
- Best COL%: ${bestCOL?.name || 'N/A'} at ${bestCOL?.colActual.toFixed(1) || 0}%
- Worst COL%: ${worstCOL?.name || 'N/A'} at ${worstCOL?.colActual.toFixed(1) || 0}%
- Best SPLH: ${bestSPLH?.name || 'N/A'} at €${bestSPLH?.splhActual.toFixed(0) || 0}
- Worst SPLH: ${worstSPLH?.name || 'N/A'} at €${worstSPLH?.splhActual.toFixed(0) || 0}

Please provide:
1. Executive summary of labor performance
2. Top 3 issues or opportunities identified
3. Specific staffing recommendations for underperforming locations
4. Estimated savings if worst performers matched average`;

    const userPrompt = question 
      ? `${question}\n\nContext:\n${defaultAnalysis}` 
      : defaultAnalysis;

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
    console.error("labour_insights error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
