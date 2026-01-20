import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InventoryData {
  totalSales: number;
  assignedSales: number;
  unassignedSales: number;
  theoreticalCOGS: number;
  theoreticalCOGSPercent: number;
  actualCOGS: number;
  actualCOGSPercent: number;
  theoreticalGP: number;
  theoreticalGPPercent: number;
  actualGP: number;
  actualGPPercent: number;
  gapCOGS: number;
  gapCOGSPercent: number;
  accountedWaste: number;
  unaccountedWaste: number;
  surplus: number;
  categoryBreakdown: {
    category: string;
    actualPercent: number;
    actualAmount: number;
    theoreticalPercent: number;
    theoreticalAmount: number;
  }[];
  wasteByCategory: {
    category: string;
    accounted: number;
    unaccounted: number;
  }[];
  locationPerformance: {
    locationName: string;
    sales: number;
    actualPercent: number;
    theoreticalPercent: number;
    variancePercent: number;
  }[];
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { inventoryData, messages } = await req.json() as { 
      inventoryData: InventoryData; 
      messages: Message[];
    };
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build inventory context
    const isPositiveGap = inventoryData.gapCOGSPercent > 0;
    const gapStatus = isPositiveGap ? "over theoretical" : "under theoretical";

    const categoryBreakdownSummary = inventoryData.categoryBreakdown
      .map(c => `${c.category}: Actual ${c.actualPercent.toFixed(1)}% (€${c.actualAmount.toFixed(0)}), Theoretical ${c.theoreticalPercent.toFixed(1)}% (€${c.theoreticalAmount.toFixed(0)})`)
      .join("\n");

    const wasteBreakdownSummary = inventoryData.wasteByCategory
      .map(c => `${c.category}: Accounted €${c.accounted.toFixed(0)}, Unaccounted €${c.unaccounted.toFixed(0)}`)
      .join("\n");

    const locationSummary = inventoryData.locationPerformance
      .map(l => `${l.locationName}: Sales €${l.sales.toFixed(0)}, Actual COGS ${l.actualPercent.toFixed(1)}%, Variance ${l.variancePercent >= 0 ? '+' : ''}${l.variancePercent.toFixed(1)}%`)
      .join("\n");

    const systemPrompt = `You are Josephine, an AI assistant specialized in restaurant inventory management and food cost control.
You analyze COGS (Cost of Goods Sold), Gross Profit, waste, and reconciliation data to provide actionable insights.
Always be specific with numbers and percentages. Keep responses concise but insightful.
Format your responses with clear sections using markdown.

**Current Inventory Context:**
- Total Sales: €${inventoryData.totalSales.toFixed(0)}
- Assigned Sales: €${inventoryData.assignedSales.toFixed(0)} (${((inventoryData.assignedSales / inventoryData.totalSales) * 100).toFixed(1)}%)
- Unassigned Sales: €${inventoryData.unassignedSales.toFixed(0)} (${((inventoryData.unassignedSales / inventoryData.totalSales) * 100).toFixed(1)}%)

**COGS Analysis:**
- Theoretical COGS: ${inventoryData.theoreticalCOGSPercent.toFixed(1)}% (€${inventoryData.theoreticalCOGS.toFixed(0)})
- Actual COGS: ${inventoryData.actualCOGSPercent.toFixed(1)}% (€${inventoryData.actualCOGS.toFixed(0)})
- Gap: ${inventoryData.gapCOGSPercent >= 0 ? '+' : ''}${inventoryData.gapCOGSPercent.toFixed(1)}% (€${inventoryData.gapCOGS.toFixed(0)}) - ${gapStatus}

**Gross Profit:**
- Theoretical GP: ${inventoryData.theoreticalGPPercent.toFixed(1)}% (€${inventoryData.theoreticalGP.toFixed(0)})
- Actual GP: ${inventoryData.actualGPPercent.toFixed(1)}% (€${inventoryData.actualGP.toFixed(0)})

**Waste Breakdown:**
- Accounted Waste: €${inventoryData.accountedWaste.toFixed(0)}
- Unaccounted Waste: €${inventoryData.unaccountedWaste.toFixed(0)}
- Surplus: €${inventoryData.surplus.toFixed(0)}

**Category Breakdown:**
${categoryBreakdownSummary}

**Waste by Category:**
${wasteBreakdownSummary}

**Location Performance:**
${locationSummary}

Focus on:
1. Identifying the root causes of variance/gap
2. Which categories or locations are underperforming
3. Waste reduction opportunities
4. Actionable recommendations to improve food cost
Respond in the same language as the user's question (Spanish if the question is in Spanish).`;

    // Build messages array for the API
    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content }))
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: apiMessages,
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
    console.error("inventory_insights error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
