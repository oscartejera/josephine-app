import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * seed_pos_365 - Generate 365+ days of realistic POS data
 *
 * Creates data that mimics a real restaurant POS system export with:
 * - Realistic daily revenue patterns (weekday vs weekend)
 * - Seasonal trends (summer high, winter low, Christmas spike)
 * - Spanish holidays impact (-20%)
 * - Madrid events impact (+30-40%)
 * - Weather-correlated noise
 * - Gradual growth trend (+12% YoY)
 * - Random walk noise (±8%) so Prophet has real patterns to learn
 *
 * This data is designed to give Prophet v5 enough signal to produce
 * accurate forecasts (target: MAPE 8-15%, R² > 0.7)
 */

// ─── Spanish Holidays ───────────────────────────────────────────────────────
const HOLIDAYS = new Set([
  "2025-01-01", "2025-01-06", "2025-04-18", "2025-04-21", "2025-05-01",
  "2025-05-02", "2025-05-15", "2025-08-15", "2025-10-12", "2025-11-01",
  "2025-11-09", "2025-12-06", "2025-12-08", "2025-12-25", "2025-12-26",
  "2026-01-01", "2026-01-06", "2026-02-09",
]);

// Madrid events with revenue boost
const EVENTS: Record<string, number> = {
  "2025-03-15": 1.30, "2025-04-20": 1.30, // Champions League
  "2025-05-15": 1.25, // San Isidro
  "2025-07-10": 1.40, "2025-07-11": 1.40, "2025-07-12": 1.40, // Mad Cool
  "2025-09-20": 1.30, "2025-10-25": 1.30, // Champions League
  "2025-12-31": 1.35, // Nochevieja
};

// ─── Deterministic pseudo-random ────────────────────────────────────────────
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function gaussianNoise(seed: number, stddev: number): number {
  // Box-Muller transform with seeded random
  const u1 = seededRandom(seed);
  const u2 = seededRandom(seed + 1);
  const z = Math.sqrt(-2 * Math.log(Math.max(u1, 0.0001))) * Math.cos(2 * Math.PI * u2);
  return z * stddev;
}

// ─── Daily sales generator ──────────────────────────────────────────────────
function generateDailySales(
  startDate: string,
  days: number,
  baseDailySales: number,
  locationMultiplier: number,
): Array<{ date: string; dailySales: number; tickets: number; covers: number }> {
  const result = [];
  const start = new Date(startDate + "T00:00:00Z");

  for (let d = 0; d < days; d++) {
    const dt = new Date(start);
    dt.setUTCDate(dt.getUTCDate() + d);
    const dateStr = dt.toISOString().split("T")[0];
    const dow = dt.getUTCDay(); // 0=Sun
    const month = dt.getUTCMonth(); // 0=Jan
    const dayOfYear = Math.floor((dt.getTime() - new Date(dt.getUTCFullYear(), 0, 1).getTime()) / 86400000);

    // 1. Day-of-week pattern
    const dowMultiplier =
      dow === 5 ? 1.45 : // Friday
      dow === 6 ? 1.55 : // Saturday
      dow === 0 ? 1.15 : // Sunday
      dow === 4 ? 1.20 : // Thursday
      dow === 1 ? 0.80 : // Monday (slowest)
      dow === 2 ? 0.85 : // Tuesday
      0.95; // Wednesday

    // 2. Monthly seasonality (smooth sine wave)
    //    Peak in June-August, trough in January-February
    const seasonalMultiplier = 1.0 + 0.15 * Math.sin((month - 1) * Math.PI / 5.5);

    // 3. Christmas/NYE spike (Dec 20-31)
    const dayOfMonth = dt.getUTCDate();
    const christmasBoost = (month === 11 && dayOfMonth >= 20) ? 1.25 : 1.0;

    // 4. Summer terrace effect (Jun-Sep evenings boost)
    const summerBoost = (month >= 5 && month <= 8) ? 1.08 : 1.0;

    // 5. Holiday impact
    const isHoliday = HOLIDAYS.has(dateStr);
    const holidayMult = isHoliday ? 0.75 : 1.0;

    // 6. Event impact
    const eventMult = EVENTS[dateStr] || 1.0;

    // 7. Growth trend (+12% YoY = +0.031% per day)
    const growthMult = 1.0 + (d * 0.00031);

    // 8. Random noise (±8% gaussian, seeded by day for reproducibility)
    const noise = 1.0 + gaussianNoise(d * 137 + Math.round(locationMultiplier * 1000), 0.08);

    // 9. Payday boost (1st, 15th, 25th-31st)
    const paydayBoost = (dayOfMonth === 1 || dayOfMonth === 15 || dayOfMonth >= 25) ? 1.05 : 1.0;

    // Combine all factors
    const dailySales = baseDailySales
      * locationMultiplier
      * dowMultiplier
      * seasonalMultiplier
      * christmasBoost
      * summerBoost
      * holidayMult
      * eventMult
      * growthMult
      * noise
      * paydayBoost;

    const finalSales = Math.max(2000, Math.round(dailySales * 100) / 100);
    const avgCheck = 23 + (locationMultiplier - 0.9) * 30; // 23-26 EUR avg check
    const tickets = Math.max(10, Math.round(finalSales / avgCheck));
    const covers = Math.round(tickets * (1.1 + seededRandom(d + 999) * 0.3));

    result.push({ date: dateStr, dailySales: finalSales, tickets, covers });
  }

  return result;
}

// ─── 15-min time bucket distribution ────────────────────────────────────────
function distributeTo15MinBuckets(
  dateStr: string,
  dailySales: number,
  tickets: number,
  covers: number,
  locationId: string,
): Array<Record<string, unknown>> {
  const records = [];

  // Hour weights (restaurant pattern: lunch peak + dinner peak)
  const hourWeights: Record<number, number> = {
    10: 0.02, 11: 0.04, 12: 0.10, 13: 0.12, 14: 0.09,
    15: 0.03, 16: 0.02, 17: 0.03, 18: 0.05,
    19: 0.10, 20: 0.14, 21: 0.12, 22: 0.08, 23: 0.06,
  };

  for (let hour = 10; hour <= 23; hour++) {
    for (let min = 0; min < 60; min += 15) {
      const weight = (hourWeights[hour] || 0.03) / 4; // divide by 4 for 15-min slots
      const slotSales = dailySales * weight;
      const slotTickets = Math.max(1, Math.round(tickets * weight));
      const slotCovers = Math.max(1, Math.round(covers * weight));

      const ts = `${dateStr}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00+00:00`;

      records.push({
        location_id: locationId,
        ts_bucket: ts,
        sales_gross: Math.round(slotSales * 1.05 * 100) / 100, // +5% for gross (before discounts)
        sales_net: Math.round(slotSales * 100) / 100,
        tickets: slotTickets,
        covers: slotCovers,
        discounts: Math.round(slotSales * 0.03 * 100) / 100, // 3% discounts
        voids: 0,
        comps: Math.round(slotSales * 0.02 * 100) / 100, // 2% comps
        refunds: 0,
      });
    }
  }

  return records;
}

// ─── Main handler ───────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const days = body.days || 395; // 13 months: 2025-01-01 to 2026-02-08
    const startDate = body.start_date || "2025-01-01";

    console.log(`[SEED] Starting POS seed: ${days} days from ${startDate}`);

    // ── Step 1: Get or create group ─────────────────────────────────────
    const { data: groups } = await supabase.from("groups").select("id").limit(1);
    let groupId: string;
    if (groups && groups.length > 0) {
      groupId = groups[0].id;
    } else {
      const { data: g } = await supabase.from("groups")
        .insert({ name: "Josephine Restaurant Group" }).select("id").single();
      groupId = g!.id;
    }

    // ── Step 2: Clean existing demo data ────────────────────────────────
    const { data: existingLocs } = await supabase.from("locations").select("id")
      .in("name", ["La Taberna Centro", "Chamberí", "Malasaña"]);

    if (existingLocs && existingLocs.length > 0) {
      const locIds = existingLocs.map((l) => l.id);
      console.log("[SEED] Cleaning existing demo data...");
      await supabase.from("forecast_daily_metrics").delete().in("location_id", locIds);
      await supabase.from("forecast_model_runs").delete().in("location_id", locIds);
      await supabase.from("facts_item_mix_daily").delete().in("location_id", locIds);
      await supabase.from("facts_labor_daily").delete().in("location_id", locIds);
      await supabase.from("facts_sales_15m").delete().in("location_id", locIds);
      await supabase.from("employees").delete().in("location_id", locIds);
      await supabase.from("cdm_items").delete().in("location_id", locIds);
      await supabase.from("locations").delete().in("id", locIds);
      console.log("[SEED] Cleaned.");
    }

    // ── Step 3: Create locations ────────────────────────────────────────
    const { data: locations, error: locErr } = await supabase.from("locations").insert([
      { group_id: groupId, name: "La Taberna Centro", city: "Salamanca", timezone: "Europe/Madrid", currency: "EUR" },
      { group_id: groupId, name: "Chamberí", city: "Madrid", timezone: "Europe/Madrid", currency: "EUR" },
      { group_id: groupId, name: "Malasaña", city: "Madrid", timezone: "Europe/Madrid", currency: "EUR" },
    ]).select();
    if (locErr) throw locErr;

    const [centro, chamberi, malasana] = locations!;
    console.log(`[SEED] Locations created: ${locations!.length}`);

    // ── Step 4: Create employees (70 total) ─────────────────────────────
    const roles = [
      { role: "Chef", hourly: 18, counts: [8, 5, 5] },
      { role: "Server", hourly: 12, counts: [12, 10, 10] },
      { role: "Bartender", hourly: 14, counts: [5, 3, 3] },
      { role: "Host", hourly: 11, counts: [3, 0, 0] },
      { role: "Manager", hourly: 25, counts: [2, 2, 2] },
    ];
    const employees: Array<Record<string, unknown>> = [];
    const locs = [centro, chamberi, malasana];

    for (const r of roles) {
      for (let li = 0; li < 3; li++) {
        for (let i = 0; i < r.counts[li]; i++) {
          employees.push({
            location_id: locs[li].id,
            full_name: `${r.role} ${locs[li].name.slice(0, 2).toUpperCase()}${i + 1}`,
            role_name: r.role,
            hourly_cost: r.hourly,
            active: true,
          });
        }
      }
    }
    await supabase.from("employees").insert(employees);
    console.log(`[SEED] Employees: ${employees.length}`);

    // ── Step 5: Generate sales (365+ days × 3 locations) ────────────────
    // Base daily sales: EUR 12,000 (realistic for a mid-range Madrid restaurant)
    const locationConfigs = [
      { loc: centro, base: 13500, mult: 1.10 },   // Premium: higher
      { loc: chamberi, base: 12000, mult: 1.00 },  // Mid-range
      { loc: malasana, base: 10500, mult: 0.90 },  // Casual: lower
    ];

    let totalSalesRecords = 0;
    const labourRecords: Array<Record<string, unknown>> = [];

    for (const cfg of locationConfigs) {
      console.log(`[SEED] Generating sales for ${cfg.loc.name}...`);
      const dailyData = generateDailySales(startDate, days, cfg.base, cfg.mult);

      // Insert sales in batches (56 records per day × batch size)
      let salesBatch: Array<Record<string, unknown>> = [];

      for (const day of dailyData) {
        // Generate 15-min buckets for this day
        const buckets = distributeTo15MinBuckets(
          day.date, day.dailySales, day.tickets, day.covers, cfg.loc.id,
        );
        salesBatch.push(...buckets);

        // Labour record (calculated in memory, no DB query)
        const targetCOL = 0.28;
        const actualCOL = targetCOL + gaussianNoise(
          parseInt(day.date.replace(/-/g, "")) + Math.round(cfg.mult * 100), 0.03,
        );
        const labourCost = day.dailySales * Math.max(0.22, Math.min(0.34, actualCOL));
        const avgWage = 14.5;
        const scheduledHours = day.dailySales * targetCOL / avgWage;
        const actualHours = labourCost / avgWage;

        labourRecords.push({
          location_id: cfg.loc.id,
          day: day.date,
          scheduled_hours: Math.round(scheduledHours * 10) / 10,
          actual_hours: Math.round(actualHours * 10) / 10,
          labor_cost_est: Math.round(labourCost * 100) / 100,
          overtime_hours: Math.max(0, Math.round((actualHours - scheduledHours) * 10) / 10),
          headcount: Math.round(actualHours / 8),
        });

        // Flush batch every 2000 records
        if (salesBatch.length >= 2000) {
          const { error } = await supabase.from("facts_sales_15m").insert(salesBatch);
          if (error) { console.error(`[SEED] Sales insert error:`, error.message); throw error; }
          totalSalesRecords += salesBatch.length;
          salesBatch = [];
        }
      }

      // Flush remaining
      if (salesBatch.length > 0) {
        const { error } = await supabase.from("facts_sales_15m").insert(salesBatch);
        if (error) { console.error(`[SEED] Sales insert error:`, error.message); throw error; }
        totalSalesRecords += salesBatch.length;
      }

      console.log(`[SEED] ${cfg.loc.name}: ${totalSalesRecords} sales records total`);
    }

    // ── Step 6: Insert labour ───────────────────────────────────────────
    console.log(`[SEED] Inserting ${labourRecords.length} labour records...`);
    for (let i = 0; i < labourRecords.length; i += 500) {
      const batch = labourRecords.slice(i, i + 500);
      const { error } = await supabase.from("facts_labor_daily").insert(batch);
      if (error) { console.error(`[SEED] Labour insert error:`, error.message); throw error; }
    }

    // ── Step 7: Create menu items ───────────────────────────────────────
    const items = [
      { name: "Paella Valenciana", cat: "Food", price: 24.50, cost: 8.20 },
      { name: "Jamón Ibérico", cat: "Food", price: 18.90, cost: 11.40 },
      { name: "Chuletón de Buey", cat: "Food", price: 38.50, cost: 19.20 },
      { name: "Pulpo a la Gallega", cat: "Food", price: 22.80, cost: 9.10 },
      { name: "Bacalao Pil-Pil", cat: "Food", price: 26.50, cost: 10.60 },
      { name: "Tortilla Española", cat: "Food", price: 8.50, cost: 2.80 },
      { name: "Croquetas Premium", cat: "Food", price: 12.50, cost: 4.20 },
      { name: "Rioja Reserva", cat: "Beverage", price: 28.00, cost: 9.50 },
      { name: "Cerveza Alhambra", cat: "Beverage", price: 4.50, cost: 1.20 },
      { name: "Gin Tonic Premium", cat: "Beverage", price: 12.00, cost: 3.50 },
    ];

    const itemRecords = [];
    for (const loc of locs) {
      const priceMult = loc.id === centro.id ? 1.0 : loc.id === chamberi.id ? 0.95 : 0.90;
      for (const item of items) {
        itemRecords.push({
          org_id: groupId, location_id: loc.id, name: item.name,
          category_name: item.cat,
          unit_price: Math.round(item.price * priceMult * 100) / 100,
          cost_price: item.cost, active: true,
        });
      }
    }
    await supabase.from("cdm_items").insert(itemRecords);

    // ── Summary ─────────────────────────────────────────────────────────
    const summary = {
      success: true,
      period: `${startDate} to ${new Date(new Date(startDate).getTime() + days * 86400000).toISOString().split("T")[0]}`,
      days,
      locations: 3,
      employees: employees.length,
      items: itemRecords.length,
      sales_records: totalSalesRecords,
      labour_records: labourRecords.length,
      patterns: [
        "Weekly: Fri/Sat +45-55%, Mon/Tue -15-20%",
        "Seasonal: Summer +15%, Christmas +25%",
        "Holidays: -25% (Spanish national holidays)",
        "Events: +25-40% (Champions League, Mad Cool, San Isidro)",
        "Growth: +12% YoY trend",
        "Noise: ±8% gaussian (realistic variance)",
        "Payday: +5% on 1st/15th/25th+",
      ],
      expected_prophet_metrics: "MAPE 8-15%, R² > 0.7 with 365+ days",
    };

    console.log(`[SEED] Done:`, JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[SEED] Error:", msg);
    return new Response(JSON.stringify({ error: msg, success: false }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
