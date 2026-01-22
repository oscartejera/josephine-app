import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * ML-based Sales Forecasting Engine
 * 
 * Implements:
 * - Linear regression with day-of-week seasonality
 * - Annual seasonality patterns
 * - Backtesting with MSE/MAPE metrics
 * - Confidence scoring based on data quality
 */

const MODEL_VERSION = "v1.0-linear-seasonal";

interface HistoricalData {
  date: string;
  location_id: string;
  net_sales: number;
  day_of_week: number; // 0-6 (Sunday-Saturday)
  week_of_year: number;
  month: number;
}

interface ForecastResult {
  date: string;
  location_id: string;
  forecast_sales: number;
  planned_labor_cost: number;
  planned_labor_hours: number;
  model_version: string;
  mse: number;
  mape: number;
  confidence: number;
}

// Simple linear regression
function linearRegression(x: number[], y: number[]): { slope: number; intercept: number } {
  const n = x.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
  
  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return { slope: 0, intercept: sumY / n };
  
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  
  return { slope, intercept };
}

// Calculate day-of-week seasonality factors
function calculateDowSeasonality(data: HistoricalData[]): Record<number, number> {
  const dowSums: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  
  data.forEach(d => {
    dowSums[d.day_of_week].push(d.net_sales);
  });
  
  const overallMean = data.reduce((sum, d) => sum + d.net_sales, 0) / data.length;
  const factors: Record<number, number> = {};
  
  for (let dow = 0; dow < 7; dow++) {
    if (dowSums[dow].length > 0) {
      const dowMean = dowSums[dow].reduce((a, b) => a + b, 0) / dowSums[dow].length;
      factors[dow] = overallMean > 0 ? dowMean / overallMean : 1;
    } else {
      factors[dow] = 1;
    }
  }
  
  return factors;
}

// Calculate monthly seasonality factors
function calculateMonthlySeasonality(data: HistoricalData[]): Record<number, number> {
  const monthSums: Record<number, number[]> = {};
  for (let m = 1; m <= 12; m++) monthSums[m] = [];
  
  data.forEach(d => {
    monthSums[d.month].push(d.net_sales);
  });
  
  const overallMean = data.reduce((sum, d) => sum + d.net_sales, 0) / data.length;
  const factors: Record<number, number> = {};
  
  for (let m = 1; m <= 12; m++) {
    if (monthSums[m].length > 0) {
      const monthMean = monthSums[m].reduce((a, b) => a + b, 0) / monthSums[m].length;
      factors[m] = overallMean > 0 ? monthMean / overallMean : 1;
    } else {
      factors[m] = 1;
    }
  }
  
  return factors;
}

// Backtesting: Calculate MSE and MAPE
function calculateMetrics(
  actual: number[],
  predicted: number[]
): { mse: number; mape: number } {
  if (actual.length === 0) return { mse: 0, mape: 0 };
  
  let sumSquaredError = 0;
  let sumAbsPercentError = 0;
  let validMapeCount = 0;
  
  for (let i = 0; i < actual.length; i++) {
    const error = actual[i] - predicted[i];
    sumSquaredError += error * error;
    
    if (actual[i] > 0) {
      sumAbsPercentError += Math.abs(error / actual[i]);
      validMapeCount++;
    }
  }
  
  const mse = sumSquaredError / actual.length;
  const mape = validMapeCount > 0 ? (sumAbsPercentError / validMapeCount) * 100 : 0;
  
  return { mse, mape };
}

// Calculate confidence score based on data quality
function calculateConfidence(
  dataPoints: number,
  mape: number,
  daysWithData: number
): number {
  // Base confidence from data quantity (min 30 days for decent forecast)
  const dataConfidence = Math.min(1, dataPoints / 90);
  
  // MAPE-based confidence (lower is better)
  // MAPE < 10% = excellent, < 20% = good, < 30% = fair, > 30% = poor
  const mapeConfidence = mape < 10 ? 1 : mape < 20 ? 0.8 : mape < 30 ? 0.6 : 0.4;
  
  // Coverage confidence (how many days of week are represented)
  const coverageConfidence = Math.min(1, daysWithData / 7);
  
  // Weighted average
  return Math.round((dataConfidence * 0.4 + mapeConfidence * 0.4 + coverageConfidence * 0.2) * 100) / 100;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const locationId = body.location_id;
    const horizonDays = body.horizon_days || 365;
    const regenerateAll = body.regenerate_all || false;

    console.log(`Starting forecast generation: location=${locationId || 'all'}, horizon=${horizonDays} days`);

    // Get locations to process
    let locationsToProcess: { id: string; name: string }[] = [];
    
    if (locationId) {
      const { data: loc } = await supabase
        .from("locations")
        .select("id, name")
        .eq("id", locationId)
        .single();
      
      if (loc) locationsToProcess = [loc];
    } else {
      const { data: locs } = await supabase
        .from("locations")
        .select("id, name");
      
      locationsToProcess = locs || [];
    }

    if (locationsToProcess.length === 0) {
      return new Response(
        JSON.stringify({ error: "No locations found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { location_id: string; location_name: string; forecasts_generated: number; mse: number; mape: number; confidence: number }[] = [];
    const today = new Date();
    
    for (const location of locationsToProcess) {
      console.log(`Processing location: ${location.name}`);
      
      // Fetch historical data from product_sales_daily
      const { data: historicalRaw, error: histError } = await supabase
        .from("product_sales_daily")
        .select("date, location_id, net_sales")
        .eq("location_id", location.id)
        .order("date", { ascending: true });

      if (histError) {
        console.error(`Error fetching historical data for ${location.name}:`, histError);
        continue;
      }

      // Aggregate by date (sum all products for each day)
      const dailyTotals: Record<string, number> = {};
      (historicalRaw || []).forEach((row: any) => {
        const date = row.date;
        dailyTotals[date] = (dailyTotals[date] || 0) + (row.net_sales || 0);
      });

      // Convert to historical data array
      const historicalData: HistoricalData[] = Object.entries(dailyTotals).map(([date, net_sales]) => {
        const d = new Date(date);
        return {
          date,
          location_id: location.id,
          net_sales,
          day_of_week: d.getDay(),
          week_of_year: Math.ceil((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)),
          month: d.getMonth() + 1,
        };
      });

      console.log(`${location.name}: ${historicalData.length} historical days`);

      let forecasts: ForecastResult[] = [];
      let mse = 0;
      let mape = 0;
      let confidence = 0.3; // Default low confidence

      if (historicalData.length >= 14) {
        // Enough data for proper forecasting
        
        // Calculate seasonality factors
        const dowFactors = calculateDowSeasonality(historicalData);
        const monthFactors = calculateMonthlySeasonality(historicalData);
        
        // Deseasonalize data for trend estimation
        const deseasonalized = historicalData.map((d, i) => ({
          x: i,
          y: d.net_sales / (dowFactors[d.day_of_week] * monthFactors[d.month]),
        }));
        
        // Fit linear regression to deseasonalized data
        const regression = linearRegression(
          deseasonalized.map(d => d.x),
          deseasonalized.map(d => d.y)
        );
        
        // Backtesting: predict last 20% of data
        const splitIndex = Math.floor(historicalData.length * 0.8);
        const testData = historicalData.slice(splitIndex);
        
        const actual = testData.map(d => d.net_sales);
        const predicted = testData.map((d, i) => {
          const trendValue = regression.slope * (splitIndex + i) + regression.intercept;
          return trendValue * dowFactors[d.day_of_week] * monthFactors[d.month];
        });
        
        const metrics = calculateMetrics(actual, predicted);
        mse = Math.round(metrics.mse);
        mape = Math.round(metrics.mape * 10) / 10;
        
        // Calculate unique days of week with data
        const uniqueDows = new Set(historicalData.map(d => d.day_of_week)).size;
        confidence = calculateConfidence(historicalData.length, mape, uniqueDows);
        
        // Get target COL% and blended hourly cost for labor planning
        const { data: settings } = await supabase
          .from("location_settings")
          .select("target_col_percent, default_hourly_cost")
          .eq("location_id", location.id)
          .single();
        
        const targetColPct = settings?.target_col_percent || 22;
        
        // Get average hourly cost of employees at this location
        const { data: employees } = await supabase
          .from("employees")
          .select("hourly_cost")
          .eq("location_id", location.id)
          .not("hourly_cost", "is", null);
        
        let blendedHourlyCost = settings?.default_hourly_cost || 15;
        if (employees && employees.length > 0) {
          const totalCost = employees.reduce((sum: number, e: any) => sum + (e.hourly_cost || 0), 0);
          blendedHourlyCost = totalCost / employees.length;
        }
        
        // Generate forecasts for horizon days
        const lastIndex = historicalData.length - 1;
        
        for (let i = 1; i <= horizonDays; i++) {
          const forecastDate = new Date(today);
          forecastDate.setDate(today.getDate() + i);
          
          const dow = forecastDate.getDay();
          const month = forecastDate.getMonth() + 1;
          
          // Apply trend + seasonality
          const trendValue = regression.slope * (lastIndex + i) + regression.intercept;
          let forecastSales = trendValue * dowFactors[dow] * monthFactors[month];
          
          // Ensure non-negative
          forecastSales = Math.max(0, Math.round(forecastSales * 100) / 100);
          
          // Calculate planned labor
          const plannedLaborCost = Math.round(forecastSales * (targetColPct / 100) * 100) / 100;
          const plannedLaborHours = Math.round((plannedLaborCost / blendedHourlyCost) * 10) / 10;
          
          forecasts.push({
            date: forecastDate.toISOString().split("T")[0],
            location_id: location.id,
            forecast_sales: forecastSales,
            planned_labor_cost: plannedLaborCost,
            planned_labor_hours: plannedLaborHours,
            model_version: MODEL_VERSION,
            mse,
            mape,
            confidence,
          });
        }
      } else {
        // Fallback: Not enough data - use simple average with low confidence
        console.log(`${location.name}: Insufficient data, using fallback method`);
        
        const avgSales = historicalData.length > 0
          ? historicalData.reduce((sum, d) => sum + d.net_sales, 0) / historicalData.length
          : 2500; // Default if no data
        
        // Very simple DOW multipliers for fallback
        const fallbackDowMultipliers: Record<number, number> = {
          0: 1.15, 1: 0.75, 2: 0.85, 3: 0.90, 4: 0.95, 5: 1.30, 6: 1.40
        };
        
        confidence = historicalData.length > 0 ? 0.3 : 0.1;
        
        for (let i = 1; i <= horizonDays; i++) {
          const forecastDate = new Date(today);
          forecastDate.setDate(today.getDate() + i);
          
          const dow = forecastDate.getDay();
          let forecastSales = avgSales * fallbackDowMultipliers[dow];
          forecastSales = Math.round(forecastSales * 100) / 100;
          
          const plannedLaborCost = Math.round(forecastSales * 0.22 * 100) / 100;
          const plannedLaborHours = Math.round((plannedLaborCost / 15) * 10) / 10;
          
          forecasts.push({
            date: forecastDate.toISOString().split("T")[0],
            location_id: location.id,
            forecast_sales: forecastSales,
            planned_labor_cost: plannedLaborCost,
            planned_labor_hours: plannedLaborHours,
            model_version: MODEL_VERSION + "-fallback",
            mse: 0,
            mape: 0,
            confidence,
          });
        }
      }
      
      // Upsert forecasts in batches
      const batchSize = 500;
      for (let i = 0; i < forecasts.length; i += batchSize) {
        const batch = forecasts.slice(i, i + batchSize);
        
        const { error: upsertError } = await supabase
          .from("forecast_daily_metrics")
          .upsert(
            batch.map(f => ({
              location_id: f.location_id,
              date: f.date,
              forecast_sales: f.forecast_sales,
              planned_labor_cost: f.planned_labor_cost,
              planned_labor_hours: f.planned_labor_hours,
              model_version: f.model_version,
              mse: f.mse,
              mape: f.mape,
              confidence: f.confidence,
              generated_at: new Date().toISOString(),
            })),
            { onConflict: "location_id,date", ignoreDuplicates: false }
          );
        
        if (upsertError) {
          console.error(`Upsert error for ${location.name}:`, upsertError.message);
        }
      }
      
      results.push({
        location_id: location.id,
        location_name: location.name,
        forecasts_generated: forecasts.length,
        mse,
        mape,
        confidence,
      });
      
      console.log(`${location.name}: Generated ${forecasts.length} forecasts (MSE: ${mse}, MAPE: ${mape}%, Confidence: ${confidence})`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        model_version: MODEL_VERSION,
        horizon_days: horizonDays,
        locations_processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Forecast generation error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});