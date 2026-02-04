/**
 * Admin Tools - Herramientas de administración y seed data
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Database, Loader2, CheckCircle2, AlertCircle, TrendingUp, Calendar, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function AdminTools() {
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingForecast, setIsGeneratingForecast] = useState(false);
  const [forecastResult, setForecastResult] = useState<any>(null);

  const handleSeed18Months = async () => {
    setIsSeeding(true);
    setError(null);
    setSeedResult(null);

    try {
      console.log('🌱 Starting 18-month seed...');
      
      const { data, error } = await supabase.functions.invoke('seed_josephine_18m', {
        body: {}
      });

      if (error) throw error;

      console.log('✅ Seed result:', data);
      setSeedResult(data);
      toast.success('18 meses de datos generados exitosamente!');

    } catch (err) {
      console.error('❌ Seed error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMsg);
      toast.error(`Error: ${errorMsg}`);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleQuickSeed = async () => {
    setIsSeeding(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('seed_josephine_demo', {
        body: { days: 30 }
      });

      if (error) throw error;

      setSeedResult(data);
      toast.success('30 días de datos generados!');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMsg);
      toast.error(`Error: ${errorMsg}`);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleGenerateForecast = async () => {
    setIsGeneratingForecast(true);
    setForecastResult(null);
    setError(null);

    try {
      console.log('🔮 Generating Prophet forecast with regressors...');

      const { data, error } = await supabase.functions.invoke('generate_forecast_v4', {
        body: { horizon_days: 90 } // 3 months
      });

      if (error) throw error;

      console.log('✅ Forecast generated:', data);
      setForecastResult(data);
      toast.success(`Forecast generado: ${data.results?.length} locations`);

    } catch (err) {
      console.error('❌ Forecast error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMsg);
      toast.error(`Error: ${errorMsg}`);
    } finally {
      setIsGeneratingForecast(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Tools</h1>
        <p className="text-gray-600 mt-2">Herramientas para generar datos demo y gestión del sistema</p>
      </div>

      {/* Banner de instrucciones SQL directas */}
      <Card className="p-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Database className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold mb-2">⚡ Usa SQL Directo (más rápido)</h3>
            <p className="text-indigo-100 mb-4">
              Los botones de abajo pueden dar error porque las Edge Functions están desplegándose.
              Mientras tanto, usa este método SQL directo (funciona 100%):
            </p>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4 space-y-2">
              <p className="font-semibold text-sm">Pasos:</p>
              <ol className="list-decimal list-inside space-y-1.5 text-sm text-indigo-100">
                <li>Ir a <strong className="text-white">Supabase Dashboard → SQL Editor</strong></li>
                <li>Abrir archivo del proyecto: <code className="bg-white/20 px-2 py-0.5 rounded font-mono text-white">SEED_DIRECT_SQL.sql</code></li>
                <li>Copiar <strong className="text-white">TODO</strong> el contenido</li>
                <li>Pegar en SQL Editor y click <strong className="text-white">"Run"</strong></li>
                <li>Esperar 2-3 minutos (verás progress en logs)</li>
                <li>Verás: <span className="text-emerald-300 font-semibold">"✅ COMPLETADO! 📊 ~60,000 registros"</span></li>
              </ol>
            </div>
            <div className="flex gap-3 mt-4">
              <Button 
                variant="secondary"
                size="sm"
                onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
              >
                Abrir Supabase Dashboard
              </Button>
              <Button 
                variant="outline"
                size="sm"
                className="bg-white/10 hover:bg-white/20 text-white border-white/30"
                onClick={() => {
                  // Copy SQL content to clipboard
                  const sqlContent = `-- Ver SEED_DIRECT_SQL.sql en el proyecto para el código completo\n-- O ejecuta esto rápido (30 días):\n\nINSERT INTO locations (group_id, name, city) VALUES ((SELECT id FROM groups LIMIT 1), 'La Taberna Centro', 'Salamanca');\n-- Ver archivo completo para más...`;
                  navigator.clipboard.writeText(sqlContent);
                  toast.success('Link copiado - ve a supabase.com/dashboard');
                }}
              >
                Copiar link Supabase
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Forecast Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Generate Prophet Forecast</h2>
        
        <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-100">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
              <Sparkles className="h-6 w-6 text-purple-600" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Forecast con Regresores Externos</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Genera forecast de 90 días (3 meses) usando Prophet mejorado con clima, eventos y festivos españoles
                </p>
              </div>

              <div className="bg-white rounded-lg p-3 space-y-2 text-sm">
                <p className="font-medium text-gray-900">Incluye:</p>
                <ul className="space-y-1 text-gray-700 ml-4">
                  <li>✓ Trend + Seasonality (13 meses de historia)</li>
                  <li>✓ Clima: Temperatura y lluvia (impacto -25% en lluvia)</li>
                  <li>✓ Eventos: Partidos Real Madrid, festivales (+30%)</li>
                  <li>✓ Festivos españoles: 20+ días marcados (-20%)</li>
                  <li>✓ Días de pago: Fin de mes (+5%)</li>
                  <li>✓ Confidence intervals al 95%</li>
                </ul>
              </div>

              <Button 
                onClick={handleGenerateForecast}
                disabled={isGeneratingForecast}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                {isGeneratingForecast ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Generando forecast... (~60 seg)
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generar Forecast (3 meses)
                  </>
                )}
              </Button>

              <p className="text-xs text-gray-500">
                ⚠️ Requiere datos históricos en facts_sales_15m. Ejecuta "Generar 18 Meses" primero si no tienes datos.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Seed Data Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Generate Demo Data</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 18 Months Seed */}
          <Card className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                  <TrendingUp className="h-6 w-6 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">18 Meses Completos</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Para demos e inversores
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-700">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-indigo-600" />
                  <span className="font-medium">2025-01 a 2025-12:</span>
                  <span>Actuals completos</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-indigo-600" />
                  <span className="font-medium">2026-01 a 2026-02:</span>
                  <span>Actuals actuales</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-indigo-600" />
                  <span className="font-medium">2026-03 a 2026-06:</span>
                  <span>Forecast/Planned</span>
                </div>
              </div>

              <div className="bg-white rounded-lg p-3 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">Sales records:</span>
                  <span className="font-semibold">~60,000</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Labour records:</span>
                  <span className="font-semibold">~1,980</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Locations:</span>
                  <span className="font-semibold">3</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Employees:</span>
                  <span className="font-semibold">70</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tiempo:</span>
                  <span className="font-semibold text-amber-600">~3-5 min</span>
                </div>
              </div>

              <Button 
                onClick={handleSeed18Months}
                disabled={isSeeding}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              >
                {isSeeding ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Generando... (3-5 min)
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4 mr-2" />
                    Generar 18 Meses
                  </>
                )}
              </Button>
            </div>
          </Card>

          {/* Quick 30 Days Seed */}
          <Card className="p-6 bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <Database className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">30 Días Rápido</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Para testing rápido
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-700">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-600" />
                  <span>Últimos 30 días con actuals</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Suficiente para ver funcionalidades</span>
                </div>
              </div>

              <div className="bg-white rounded-lg p-3 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">Sales records:</span>
                  <span className="font-semibold">~4,680</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Labour records:</span>
                  <span className="font-semibold">~90</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tiempo:</span>
                  <span className="font-semibold text-emerald-600">~30 seg</span>
                </div>
              </div>

              <Button 
                onClick={handleQuickSeed}
                disabled={isSeeding}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
              >
                {isSeeding ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4 mr-2" />
                    Generar 30 Días
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Result Display */}
      {seedResult && (
        <Card className="p-6 bg-emerald-50 border-emerald-200">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                ✅ Datos generados exitosamente
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {seedResult.period && (
                  <div>
                    <span className="text-gray-600">Periodo:</span>
                    <span className="font-semibold ml-2">{seedResult.period}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-600">Locations:</span>
                  <span className="font-semibold ml-2">{seedResult.locations}</span>
                </div>
                <div>
                  <span className="text-gray-600">Employees:</span>
                  <span className="font-semibold ml-2">{seedResult.employees}</span>
                </div>
                <div>
                  <span className="text-gray-600">Sales records:</span>
                  <span className="font-semibold ml-2">{seedResult.salesRecords?.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-600">Labour records:</span>
                  <span className="font-semibold ml-2">{seedResult.labourRecords?.toLocaleString()}</span>
                </div>
              </div>
              
              {seedResult.breakdown && (
                <div className="mt-3 pt-3 border-t border-emerald-200">
                  <p className="text-sm font-medium text-gray-900 mb-2">Breakdown:</p>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>✓ {seedResult.breakdown.historical_2025}</li>
                    <li>✓ {seedResult.breakdown.current_2026_jan_feb}</li>
                    <li>✓ {seedResult.breakdown.forecast_2026_mar_jun}</li>
                  </ul>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => window.location.href = '/sales'}
                >
                  Ver Sales Module
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => window.location.href = '/insights/labour'}
                >
                  Ver Labour Module
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Forecast Result Display */}
      {forecastResult && (
        <Card className="p-6 bg-purple-50 border-purple-200">
          <div className="flex items-start gap-3">
            <Sparkles className="h-6 w-6 text-purple-600 shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                🔮 Forecast generado con Prophet v4
              </h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">Locations procesadas:</span>
                    <span className="font-semibold ml-2">{forecastResult.locations_processed}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Horizon:</span>
                    <span className="font-semibold ml-2">{forecastResult.horizon_days} días</span>
                  </div>
                </div>

                {forecastResult.results && forecastResult.results.length > 0 && (
                  <div className="bg-white rounded-lg p-3 space-y-2">
                    <p className="font-medium text-gray-900 text-sm">Resultados por location:</p>
                    {forecastResult.results.map((r: any, i: number) => (
                      <div key={i} className="text-xs space-y-1 border-b border-gray-100 pb-2 last:border-0">
                        <p className="font-semibold text-gray-900">{r.location_name}</p>
                        <div className="grid grid-cols-2 gap-2 text-gray-700">
                          <span>Modelo: {r.model}</span>
                          <span>R²: {r.trend_r_squared}</span>
                          <span>Confidence: {r.confidence}%</span>
                          <span>Forecasts: {r.forecasts_generated}</span>
                        </div>
                        {r.sample_forecast && r.sample_forecast.length > 0 && (
                          <div className="mt-2 bg-gray-50 p-2 rounded">
                            <p className="font-medium mb-1">Próximos 7 días:</p>
                            {r.sample_forecast.slice(0, 3).map((f: any, j: number) => (
                              <div key={j} className="text-[10px] text-gray-600">
                                {f.date}: €{f.forecast.toFixed(0)} - {f.explanation}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => window.location.href = '/sales'}
                  >
                    Ver en Sales
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => window.location.href = '/insights/labour'}
                  >
                    Ver en Labour
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="p-6 bg-red-50 border-red-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-red-600 shrink-0" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Error al generar datos
              </h3>
              <p className="text-sm text-gray-700 mb-3">{error}</p>
              
              <div className="bg-white rounded-lg p-3 text-xs">
                <p className="font-medium mb-2">Solución directa (USA ESTO):</p>
                <ol className="list-decimal list-inside space-y-2 text-gray-600">
                  <li className="font-semibold text-indigo-600">
                    Ir a Supabase Dashboard → SQL Editor
                  </li>
                  <li>
                    Abrir archivo: <code className="bg-indigo-50 px-2 py-1 rounded font-mono text-indigo-700">SEED_DIRECT_SQL.sql</code>
                  </li>
                  <li>
                    Copiar TODO el contenido y pegarlo en SQL Editor
                  </li>
                  <li>
                    Click "Run" → Esperar 2-3 minutos
                  </li>
                  <li>
                    Verás: "✅ COMPLETADO! 📊 Sales records: ~60000"
                  </li>
                  <li className="font-semibold text-emerald-600">
                    Refresh esta página y ve a /sales
                  </li>
                </ol>
                <p className="mt-2 text-amber-600 font-medium">
                  ⚠️ Las Edge Functions se desplegarán en próximo push de Lovable.
                  Mientras tanto, usa el SQL directo.
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Instructions */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Instrucciones</h3>
        
        <div className="space-y-3 text-sm text-gray-700">
          <div>
            <p className="font-medium text-gray-900 mb-1">📊 18 Meses (Recomendado para demos):</p>
            <ul className="list-disc list-inside space-y-1 ml-4 text-gray-600">
              <li>Todo 2025 con datos históricos (baseline)</li>
              <li>Enero-Febrero 2026 con actuals</li>
              <li>Marzo-Junio 2026 con forecast</li>
              <li>Permite comparaciones YoY (vs Last Year)</li>
              <li>~60,000 registros, tarda 3-5 minutos</li>
            </ul>
          </div>

          <div>
            <p className="font-medium text-gray-900 mb-1">⚡ 30 Días (Para testing rápido):</p>
            <ul className="list-disc list-inside space-y-1 ml-4 text-gray-600">
              <li>Últimos 30 días con actuals</li>
              <li>Suficiente para ver todas las funcionalidades</li>
              <li>~4,680 registros, tarda 30 segundos</li>
              <li>Ideal para desarrollo y testing</li>
            </ul>
          </div>

          <div className="pt-3 border-t">
            <p className="font-medium text-gray-900 mb-1">⚠️ Importante:</p>
            <ul className="list-disc list-inside space-y-1 ml-4 text-gray-600">
              <li>Esto borrará datos demo previos</li>
              <li>NO afecta datos reales de POS conectados</li>
              <li>Solo borra locations: "La Taberna Centro", "Chamberí", "Malasaña"</li>
              <li>Puedes regenerar cuantas veces necesites</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* What Gets Generated */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Qué se genera</h3>
        
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Master Data:</h4>
            <ul className="space-y-1 text-sm text-gray-700">
              <li>✓ 3 Locations (Madrid + Salamanca)</li>
              <li>✓ 70 Empleados con roles realistas</li>
              <li>✓ 10 Productos del menú español</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-2">Facts Data:</h4>
            <ul className="space-y-1 text-sm text-gray-700">
              <li>✓ facts_sales_15m (cada 15min)</li>
              <li>✓ facts_labor_daily (por día)</li>
              <li>✓ Patrones realistas (weekends, peaks)</li>
              <li>✓ Coherencia matemática garantizada</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Verification Queries */}
      <Card className="p-6 bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Queries de Verificación</h3>
        
        <div className="space-y-3">
          <div className="bg-white rounded-lg p-3 border">
            <p className="text-xs font-medium text-gray-700 mb-2">Ver totales:</p>
            <code className="text-xs bg-gray-100 p-2 rounded block overflow-x-auto">
              {`SELECT 
  (SELECT COUNT(*) FROM facts_sales_15m) as sales,
  (SELECT COUNT(*) FROM facts_labor_daily) as labour,
  (SELECT COUNT(*) FROM employees) as employees,
  (SELECT COUNT(*) FROM locations) as locations;`}
            </code>
          </div>

          <div className="bg-white rounded-lg p-3 border">
            <p className="text-xs font-medium text-gray-700 mb-2">Ver sales por mes:</p>
            <code className="text-xs bg-gray-100 p-2 rounded block overflow-x-auto">
              {`SELECT 
  TO_CHAR(DATE(ts_bucket), 'YYYY-MM') as month,
  ROUND(SUM(sales_net)::NUMERIC, 0) as sales
FROM facts_sales_15m
GROUP BY month
ORDER BY month;`}
            </code>
          </div>
        </div>
      </Card>
    </div>
  );
}
