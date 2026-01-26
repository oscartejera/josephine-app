import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Seed Tickets History Edge Function
 * 
 * Generates realistic historical ticket data for all active locations
 * to improve forecasting model confidence.
 * 
 * Pattern: ~55-60 tickets/day, ~€4,700/day average
 * Includes weekly patterns (slower weekends) and seasonal variation
 */

// Seeded random for reproducibility
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// Channels with realistic distribution
const CHANNELS = [
  { name: 'dinein', weight: 0.70 },
  { name: 'takeaway', weight: 0.15 },
  { name: 'delivery', weight: 0.15 },
];

// Ticket value ranges by meal period
const MEAL_PERIODS = {
  lunch: { minValue: 25, maxValue: 85, peakHour: 14 },
  dinner: { minValue: 35, maxValue: 140, peakHour: 21 },
};

// Day of week multipliers (0=Sunday)
const DOW_MULTIPLIERS = [0.75, 0.60, 0.85, 0.95, 1.00, 1.15, 1.10];

// Monthly seasonality (1=January)
const MONTH_SEASONALITY: Record<number, number> = {
  1: 0.85,  // January - post-holiday slow
  2: 0.90,
  3: 0.95,
  4: 1.00,
  5: 1.05,
  6: 1.10,  // Summer tourism
  7: 1.15,
  8: 1.05,  // August vacation
  9: 1.00,
  10: 1.05,
  11: 1.00,
  12: 1.20, // December holidays
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const startDateStr = body.start_date || "2023-01-01"; // Default 2 years back
    const endDateStr = body.end_date || "2025-11-21"; // Day before existing data
    const batchSize = body.batch_size || 100; // Smaller batches to avoid timeout
    const locationId = body.location_id || null; // Optional: seed only one location

    console.log(`[SEED TICKETS] Generating history from ${startDateStr} to ${endDateStr}`);

    // Get active locations (optionally filter by location_id)
    let locQuery = supabase
      .from("locations")
      .select("id, name")
      .eq("active", true);
    
    if (locationId) {
      locQuery = locQuery.eq("id", locationId);
    }
    
    const { data: locations, error: locError } = await locQuery;

    if (locError || !locations || locations.length === 0) {
      return new Response(
        JSON.stringify({ error: "No active locations found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    console.log(`[SEED TICKETS] Processing ${locations.length} locations, ${totalDays} days each`);

    const results: any[] = [];
    let totalTicketsCreated = 0;

    for (const location of locations) {
      console.log(`[SEED TICKETS] Processing ${location.name}...`);
      
      // Create a location-specific seed for reproducibility
      const locationSeed = location.id.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
      const random = seededRandom(locationSeed);

      const tickets: any[] = [];
      let daysSeed = 0;

      // Generate tickets for each day
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split("T")[0];
        const dayOfWeek = currentDate.getDay();
        const month = currentDate.getMonth() + 1;
        
        // Calculate daily multiplier
        const dowMult = DOW_MULTIPLIERS[dayOfWeek];
        const monthMult = MONTH_SEASONALITY[month] || 1.0;
        const dailyMult = dowMult * monthMult;

        // Base tickets per day with variation
        const baseTicketsPerDay = 55;
        const ticketVariation = Math.floor((random() - 0.5) * 10);
        const ticketsToday = Math.max(30, Math.floor(baseTicketsPerDay * dailyMult + ticketVariation));

        // Split between lunch and dinner
        const lunchRatio = 0.35 + (random() * 0.1); // 35-45% lunch
        const lunchTickets = Math.floor(ticketsToday * lunchRatio);
        const dinnerTickets = ticketsToday - lunchTickets;

        // Generate lunch tickets (12:00 - 16:00)
        for (let i = 0; i < lunchTickets; i++) {
          const hourOffset = 12 + random() * 4;
          const minuteOffset = random() * 60;
          const openedAt = new Date(currentDate);
          openedAt.setHours(Math.floor(hourOffset), Math.floor(minuteOffset), 0, 0);
          
          // Dwell time 45-90 minutes for lunch
          const dwellMinutes = 45 + random() * 45;
          const closedAt = new Date(openedAt.getTime() + dwellMinutes * 60 * 1000);

          // Value with variation
          const baseValue = MEAL_PERIODS.lunch.minValue + random() * (MEAL_PERIODS.lunch.maxValue - MEAL_PERIODS.lunch.minValue);
          const netTotal = Math.round(baseValue * dailyMult * 100) / 100;
          const covers = Math.floor(1 + random() * 4);

          // Pick channel
          const channelRoll = random();
          let channelCumulative = 0;
          let channel = 'dinein';
          for (const ch of CHANNELS) {
            channelCumulative += ch.weight;
            if (channelRoll <= channelCumulative) {
              channel = ch.name;
              break;
            }
          }

          tickets.push({
            location_id: location.id,
            opened_at: openedAt.toISOString(),
            closed_at: closedAt.toISOString(),
            net_total: netTotal,
            gross_total: Math.round(netTotal * 1.1 * 100) / 100,
            covers,
            channel,
          });
        }

        // Generate dinner tickets (19:00 - 23:30)
        for (let i = 0; i < dinnerTickets; i++) {
          const hourOffset = 19 + random() * 4.5;
          const minuteOffset = random() * 60;
          const openedAt = new Date(currentDate);
          openedAt.setHours(Math.floor(hourOffset), Math.floor(minuteOffset), 0, 0);
          
          // Dwell time 60-120 minutes for dinner
          const dwellMinutes = 60 + random() * 60;
          const closedAt = new Date(openedAt.getTime() + dwellMinutes * 60 * 1000);

          // Value with variation (dinner is higher)
          const baseValue = MEAL_PERIODS.dinner.minValue + random() * (MEAL_PERIODS.dinner.maxValue - MEAL_PERIODS.dinner.minValue);
          const netTotal = Math.round(baseValue * dailyMult * 100) / 100;
          const covers = Math.floor(1 + random() * 5);

          // Pick channel (dinner has more dine-in)
          const channelRoll = random();
          let channel = 'dinein';
          if (channelRoll > 0.80) channel = 'takeaway';
          else if (channelRoll > 0.65) channel = 'delivery';

          tickets.push({
            location_id: location.id,
            opened_at: openedAt.toISOString(),
            closed_at: closedAt.toISOString(),
            net_total: netTotal,
            gross_total: Math.round(netTotal * 1.1 * 100) / 100,
            covers,
            channel,
          });
        }

        // Insert in batches to avoid memory issues
        if (tickets.length >= batchSize) {
          const { error: insertError } = await supabase
            .from("tickets")
            .insert(tickets);
          
          if (insertError) {
            console.error(`[SEED TICKETS] Insert error: ${insertError.message}`);
          } else {
            totalTicketsCreated += tickets.length;
            console.log(`[SEED TICKETS] ${location.name}: Inserted batch of ${tickets.length} tickets (total: ${totalTicketsCreated})`);
          }
          tickets.length = 0; // Clear array
        }

        currentDate.setDate(currentDate.getDate() + 1);
        daysSeed++;
      }

      // Insert remaining tickets
      if (tickets.length > 0) {
        const { error: insertError } = await supabase
          .from("tickets")
          .insert(tickets);
        
        if (insertError) {
          console.error(`[SEED TICKETS] Final insert error: ${insertError.message}`);
        } else {
          totalTicketsCreated += tickets.length;
        }
      }

      results.push({
        location_id: location.id,
        location_name: location.name,
        days_processed: totalDays,
        status: "completed",
      });

      console.log(`[SEED TICKETS] ${location.name}: Completed`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        start_date: startDateStr,
        end_date: endDateStr,
        total_days: totalDays,
        total_tickets_created: totalTicketsCreated,
        locations_processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[SEED TICKETS] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
