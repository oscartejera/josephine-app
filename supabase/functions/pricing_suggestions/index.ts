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
  classification: string;
  classification_reason: string;
  selling_price_ex_vat: number;
  unit_food_cost: number;
  unit_gross_profit: number;
  food_cost_pct: number;
  units_sold: number;
  popularity_pct: number;
  cost_source: string;
  data_confidence: string;
}

interface OmnesContext {
  price_range_ratio: number;
  price_range_state: string;      // too_narrow | healthy | too_wide
  category_ratio: number;
  pricing_health_state: string;   // too_expensive | healthy | underpriced
  band_distribution_state: string; // balanced | weak_middle | too_many_lower | too_many_upper
  lower_band_pct: number;
  middle_band_pct: number;
  upper_band_pct: number;
  average_menu_price: number;
  average_check_per_plate: number;
}

interface PricingRequest {
  methodology?: string;
  schema_version?: number;
  is_canonical?: boolean;
  thresholds?: {
    ideal_average_popularity: number;
    average_gross_profit: number;
  };
  items: CanonicalItem[];
  omnes?: OmnesContext;
  totalSales: number;
  totalUnits: number;
  locationName: string;
  categoryName?: string;
}

const SYSTEM_PROMPT = `You are an expert restaurant pricing consultant using two academic methodologies:
1. **Kasavana-Smith Menu Engineering (1982)** — classifies items by popularity × profitability
2. **OMNES Pricing Method** — analyzes price structure coherence within a category

## YOUR ROLE
You receive items that are ALREADY classified (Star, Plow Horse, Puzzle, Dog).
The classification is FINAL. DO NOT recompute or reinterpret it.
Your job is to suggest actionable pricing or operational changes for each item, grounded in theory.

## PRICING RULES BY CLASSIFICATION

### ⭐ STAR (high popularity + high profit)
- **Primary action: PROTECT. Do NOT raise the price.**
- Only suggest change if food cost % > 35% (then: "Review recipe cost, negotiate with suppliers")
- If food cost % < 30%: "This dish is performing perfectly. No changes needed."
- Never suggest more than +2% increase, and only with strong justification

### 🐴 PLOW HORSE (high popularity + low profit)
- **Primary action: REDUCE FOOD COST first**
- If food cost % > 30%: suggest recipe optimization, portion control, supplier negotiation
- If food cost % is already low (< 25%): THEN suggest a careful price increase (+3-5% max)
- High demand means small price increases are absorbed — but cost reduction is always first priority
- Show the math: "Reducing food cost by €0.50 × {units_sold} units = €{impact}/month saved"

### 💎 PUZZLE (low popularity + high profit)
- **Primary action: PROMOTE VISIBILITY — not price cuts**
- Suggest: better menu placement, waiter recommendation training, daily specials
- DO NOT automatically lower the price
- Only suggest a price adjustment if OMNES data shows item is in the upper band AND should move to middle
- "This dish makes great margin. The problem is visibility, not price."

### 🔍 DOG (low popularity + low profit)
- **Primary action: EVALUATE removal or complete redesign**
- If food cost % > 35%: "Remove from menu — high cost, no demand"
- If food cost % < 25% but still a dog: "Redesign the dish — concept may not appeal to your customers"
- If it serves a strategic purpose (kids, dietary): "Keep but do not invest marketing effort"
- Be honest: "This dish is costing you kitchen time and ingredients without return"

## OMNES CONTEXT RULES (when OMNES data is provided)

### Price Range Ratio
- < 2.5 (too narrow): "Your prices are too similar. Consider differentiating — add a premium option or a value option."
- 2.5-3.0 (healthy): no action needed
- > 3.0 (too wide): "The gap between cheapest and most expensive is too large. Customers may feel confused."

### Category Ratio (avg check / avg menu price)
- < 0.90 (perceived expensive): "Customers tend to order cheaper items. Avoid raising prices further. Consider adding more value options."
- 0.90-1.00 (healthy): normal behavior
- > 1.00 (underpriced): "Customers are ordering above the average menu price. There's room for selective price increases."

### Band Distribution
- weak_middle: "Not enough items in the middle price band. Customers lack a 'safe choice'. Move some items toward the middle."
- too_many_lower: "Too many cheap items. This can hurt perceived quality. Consider repositioning some upward."
- too_many_upper: "Too many expensive items. This can scare customers. Consider value-adding in the middle range."

## FOOD COST HEALTH BENCHMARKS
- ≤ 25%: Excellent margin — don't change
- 25-30%: Healthy — maintain
- 30-35%: Monitor — flag for recipe review
- > 35%: Urgent — must reduce cost or consider price adjustment

## OUTPUT FORMAT
Respond with ONLY a JSON array. No other text.
Each suggestion must have:
- "product": exact product name
- "current_price": number (€ ex-VAT)
- "suggested_price": number (0 if recommending removal)
- "change_pct": number (positive = increase, negative = decrease, -100 = remove)
- "reason": string — practical, owner-friendly explanation (max 25 words). Reference the theory principle.
- "estimated_impact_eur": number — monthly € impact estimate
- "priority": "high" (>€300/mo), "medium" (€100-300), "low" (<€100)
- "action_type": "protect" | "reduce_cost" | "raise_price" | "promote" | "redesign" | "remove"

## CONSTRAINTS
- Maximum 6 recommendations
- Most impactful suggestions first
- Be conservative — restaurant owners need safe, proven advice
- If data_confidence is "low", add "(estimated data)" to reason and cap priority at "medium"
- Use restaurant-industry language, not technical jargon`;

function buildUserPrompt(body: PricingRequest): string {
  const { items, omnes, totalSales, totalUnits, locationName, categoryName, thresholds } = body;

  // Sort by total GP impact
  const sortedItems = [...items]
    .sort((a, b) => (b.unit_gross_profit * b.units_sold) - (a.unit_gross_profit * a.units_sold))
    .slice(0, 20);

  const itemsSummary = sortedItems
    .map((item) =>
      `- ${item.name} [${item.classification.toUpperCase()}]: ` +
      `price €${item.selling_price_ex_vat.toFixed(2)}, ` +
      `food cost €${item.unit_food_cost.toFixed(2)} (${item.food_cost_pct?.toFixed(0) || '?'}%), ` +
      `GP €${item.unit_gross_profit.toFixed(2)}/plate, ` +
      `${item.units_sold} units, ` +
      `pop ${item.popularity_pct.toFixed(1)}%, ` +
      `confidence: ${item.data_confidence}`
    )
    .join("\n");

  let omnesSection = "";
  if (omnes) {
    omnesSection = `
## OMNES Pricing Analysis (for this category)
- Price range ratio: ${omnes.price_range_ratio} (${omnes.price_range_state})
- Category ratio: ${omnes.category_ratio} (${omnes.pricing_health_state})
- Band distribution: ${omnes.band_distribution_state}
  Lower: ${omnes.lower_band_pct}% · Middle: ${omnes.middle_band_pct}% · Upper: ${omnes.upper_band_pct}% (target: 25/50/25%)
- Avg menu price: €${omnes.average_menu_price?.toFixed(2) || '?'}
- Avg customer check: €${omnes.average_check_per_plate?.toFixed(2) || '?'}
`;
  }

  let thresholdsSection = "";
  if (thresholds) {
    thresholdsSection = `
## Menu Engineering Thresholds (Kasavana-Smith)
- Popularity threshold: ≥${thresholds.ideal_average_popularity.toFixed(1)}% = high
- GP threshold: ≥€${thresholds.average_gross_profit.toFixed(2)} = high
`;
  }

  return `Analyze and suggest pricing actions:

## Context
- Location: ${locationName}
- Category: ${categoryName || 'All categories'}
- Period sales: €${totalSales.toFixed(0)} · ${totalUnits} units
${thresholdsSection}${omnesSection}
## Products (classification is FINAL — do not recompute)
${itemsSummary}

Generate up to 6 pricing recommendations as a JSON array.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as PricingRequest;
    const { items } = body;

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ suggestions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const userPrompt = buildUserPrompt(body);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,  // Low temp for consistent, conservative advice
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited. Please wait a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Could not generate suggestions" }),
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
