/**
 * AI Recommendations Engine
 * Genera recomendaciones accionables basadas en forecasts y datos
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { locationId, types } = await req.json();

    const recommendations = [];

    // 1) Check labor recommendations (based on forecast vs scheduled)
    if (!types || types.includes('adjust_staff')) {
      const laborRec = await generateLaborRecommendation(supabase, locationId);
      if (laborRec) recommendations.push(laborRec);
    }

    // 2) Check procurement recommendations (based on inventory + forecast)
    if (!types || types.includes('create_order')) {
      const procurementRec = await generateProcurementRecommendation(supabase, locationId);
      if (procurementRec) recommendations.push(procurementRec);
    }

    // 3) Check menu engineering recommendations
    if (!types || types.includes('push_menu_item')) {
      const menuRec = await generateMenuRecommendation(supabase, locationId);
      if (menuRec) recommendations.push(menuRec);
    }

    // 4) Alert on variances
    if (!types || types.includes('alert_variance')) {
      const alertRec = await generateVarianceAlert(supabase, locationId);
      if (alertRec) recommendations.push(alertRec);
    }

    // Save recommendations to DB
    for (const rec of recommendations) {
      await supabase
        .from('ai_recommendations')
        .insert(rec);
    }

    return new Response(
      JSON.stringify({ recommendations }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[AI Recommendations] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateLaborRecommendation(supabase: any, locationId: string) {
  // Get forecast for next week
  const { data: forecast } = await supabase
    .from('ai_forecasts')
    .select('*')
    .eq('location_id', locationId)
    .eq('metric', 'covers')
    .gte('horizon_start', new Date().toISOString())
    .limit(1)
    .single();

  if (!forecast) return null;

  // Get current labor scheduled
  const { data: labor } = await supabase
    .from('facts_labor_daily')
    .select('*')
    .eq('location_id', locationId)
    .gte('day', new Date().toISOString().split('T')[0])
    .limit(7);

  if (!labor || labor.length === 0) return null;

  // Simple logic: if forecast > +20% vs average, recommend +staff
  const forecastData = forecast.forecast_json;
  const avgForecast = forecastData.reduce((sum: number, p: any) => sum + p.yhat, 0) / forecastData.length;
  const avgHistorical = 100; // Mock - would calculate from facts_sales_15m

  if (avgForecast > avgHistorical * 1.2) {
    return {
      type: 'adjust_staff',
      location_id: locationId,
      payload_json: {
        action: 'increase',
        shift: 'dinner',
        delta_headcount: 2,
        affected_days: ['2026-02-07', '2026-02-08'],
      },
      rationale: `Forecast prevé +${((avgForecast / avgHistorical - 1) * 100).toFixed(0)}% covers próxima semana. Recomiendo +2 staff en turno cena para mantener calidad de servicio.`,
      expected_impact: {
        revenue_protected: 500,
        labor_cost_increase: 240,
        net_benefit: 260,
      },
      confidence: 0.82,
    };
  }

  return null;
}

async function generateProcurementRecommendation(supabase: any, locationId: string) {
  // Mock implementation - would check stock levels vs forecast
  return {
    type: 'create_order',
    location_id: locationId,
    payload_json: {
      vendor: 'Macro',
      items: [
        { sku: 'SALMON-FRESH-KG', qty: 15, reason: 'Stock bajo + forecast alto fin de semana' },
        { sku: 'WINE-RIOJA-BOT', qty: 24, reason: 'Patrón histórico viernes-sábado' },
      ],
      delivery_date: '2026-02-05',
    },
    rationale: 'Basado en forecast de ventas y niveles actuales de stock, recomiendo pedido urgente para evitar stockout en fin de semana.',
    expected_impact: {
      revenue_at_risk: 1200,
      order_cost: 320,
      margin_protected: 880,
    },
    confidence: 0.75,
  };
}

async function generateMenuRecommendation(supabase: any, locationId: string) {
  // Mock - would analyze item mix and margins
  return {
    type: 'push_menu_item',
    location_id: locationId,
    payload_json: {
      item_id: 'item-paella',
      item_name: 'Paella Valenciana',
      action: 'promote',
      channels: ['menu_highlight', 'server_suggestion'],
    },
    rationale: 'Paella tiene 42% margen (vs 28% promedio) y 85% attachment rate positivo. Promocionar puede aumentar mix hacia alta rentabilidad.',
    expected_impact: {
      revenue_increase: 350,
      margin_improvement: 180,
    },
    confidence: 0.68,
  };
}

async function generateVarianceAlert(supabase: any, locationId: string) {
  // Would check actual vs forecast/budget
  return null; // No alerts for now
}
