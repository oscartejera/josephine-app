import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const steps: string[] = [];
  const t0 = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const locationId = body.location_id || "";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Test paginated fetch
    let salesData: Array<{ ts_bucket: string; sales_net: number }> = [];
    let from = 0;
    const PAGE_SIZE = 1000;
    let pageNum = 0;
    while (true) {
      const { data: page, error: err } = await supabase
        .from("facts_sales_15m")
        .select("ts_bucket, sales_net")
        .eq("location_id", locationId)
        .order("ts_bucket")
        .range(from, from + PAGE_SIZE - 1);
      pageNum++;
      if (err) {
        steps.push(`[${Date.now() - t0}ms] Page ${pageNum} ERROR: ${err.message}`);
        break;
      }
      if (!page || page.length === 0) break;
      salesData = salesData.concat(page);
      steps.push(`[${Date.now() - t0}ms] Page ${pageNum}: ${page.length} rows (total: ${salesData.length})`);
      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    // Aggregate
    const daily: Record<string, number> = {};
    for (const s of salesData) {
      const d = s.ts_bucket.split("T")[0];
      daily[d] = (daily[d] || 0) + Number(s.sales_net || 0);
    }
    const dates = Object.keys(daily).sort();
    steps.push(`[${Date.now() - t0}ms] Aggregated: ${dates.length} days (${dates[0]} to ${dates[dates.length - 1]})`);

    // Build regressors inline (NO async calls, NO weather API)
    const HOLIDAYS = new Set(["2025-01-01","2025-01-06","2025-04-18","2025-04-21","2025-05-01","2025-05-02","2025-05-15","2025-08-15","2025-10-12","2025-11-01","2025-11-09","2025-12-06","2025-12-08","2025-12-25","2025-12-26","2026-01-01","2026-01-06","2026-02-09"]);
    const EVENTS: Record<string, number> = {"2025-03-15":0.3,"2025-04-20":0.3,"2025-05-15":0.25,"2025-07-10":0.4,"2025-07-11":0.4,"2025-07-12":0.4,"2025-09-20":0.3,"2025-10-25":0.3,"2025-12-31":0.35};
    const MT: Record<number,number> = {1:6,2:8,3:12,4:14,5:19,6:25,7:30,8:29,9:23,10:16,11:10,12:7};

    function regs(ds: string) {
      const d = new Date(ds + "T12:00:00Z");
      const dow = d.getUTCDay();
      const m = d.getUTCMonth() + 1;
      const dy = d.getUTCDate();
      const nd = new Date(d); nd.setUTCDate(nd.getUTCDate() + 1);
      const nds = nd.toISOString().split("T")[0];
      const temp = MT[m] || 15;
      return {
        festivo: HOLIDAYS.has(ds) ? 1 : 0,
        day_before_festivo: HOLIDAYS.has(nds) ? 1 : 0,
        evento_impact: EVENTS[ds] || 0,
        payday: (dy === 1 || dy === 15 || dy >= 25) ? 1 : 0,
        temperatura: temp,
        rain: [3,4,10,11].includes(m) ? 1 : 0,
        cold_day: temp < 10 ? 1 : 0,
        weekend: (dow === 0 || dow === 5 || dow === 6) ? 1 : 0,
        mid_week: (dow === 2 || dow === 3) ? 1 : 0,
      };
    }

    const historical = dates.map(d => ({ ds: d, y: Math.round(daily[d] * 100) / 100, ...regs(d) }));
    steps.push(`[${Date.now() - t0}ms] Built ${historical.length} historical with regressors`);

    const today = new Date();
    const futureRegressors = [];
    for (let k = 1; k <= 30; k++) {
      const fd = new Date(today);
      fd.setDate(today.getDate() + k);
      const ds = fd.toISOString().split("T")[0];
      futureRegressors.push({ ds, ...regs(ds) });
    }
    steps.push(`[${Date.now() - t0}ms] Built ${futureRegressors.length} future regressors`);

    // Call Prophet
    const prophetUrl = Deno.env.get("PROPHET_SERVICE_URL") || "https://josephine-app.onrender.com";
    const apiKey = Deno.env.get("PROPHET_API_KEY") || "";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const payload = {
      historical,
      horizon_days: 30,
      future_regressors: futureRegressors,
      location_id: locationId,
      location_name: "Debug Test",
      freq: "D",
      yearly_seasonality: dates.length >= 365,
      weekly_seasonality: true,
      daily_seasonality: false,
      seasonality_mode: "multiplicative",
      changepoint_prior_scale: 0.05,
      include_regressors: true,
    };

    const bodySize = JSON.stringify(payload).length;
    steps.push(`[${Date.now() - t0}ms] Calling Prophet (body: ${(bodySize/1024).toFixed(1)}KB)...`);

    const prophetRes = await fetch(`${prophetUrl}/forecast`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!prophetRes.ok) {
      const errText = await prophetRes.text();
      steps.push(`[${Date.now() - t0}ms] Prophet ERROR ${prophetRes.status}: ${errText.slice(0, 500)}`);
    } else {
      const result = await prophetRes.json();
      const m = result.metrics;
      steps.push(`[${Date.now() - t0}ms] Prophet OK! ${m.data_points} days, MAPE=${(m.mape*100).toFixed(1)}%, R²=${m.r_squared.toFixed(3)}, forecasts=${result.forecast.length}`);
    }

    steps.push(`[${Date.now() - t0}ms] DONE`);

    return new Response(JSON.stringify({ success: true, steps }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    steps.push(`[${Date.now() - t0}ms] CRASH: ${e instanceof Error ? e.stack || e.message : String(e)}`);
    return new Response(JSON.stringify({ error: true, steps }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
