/**
 * Admin Tools - Herramientas de administración y seed data
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Database, Loader2, CheckCircle2, AlertCircle, TrendingUp, Calendar, Sparkles, Brain } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export default function AdminTools() {
  const { t } = useTranslation();
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<any>{t('adminTools.nullConstErrorSeterrorUsestate')}<string | null>{t('adminTools.nullConstIsgeneratingforecastSetisgenera')}<any>{t('adminTools.nullConstIsgeneratingv5Setisgeneratingv5')}<any>(null);

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
      toast.success(t('adminTools.toast18Months'));

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
      toast.success(t('adminTools.toast30Days'));
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

  const handleGenerateProphetV5 = async () => {
    setIsGeneratingV5(true);
    setV5Result(null);
    setError(null);

    try {
      console.log('🧠 Generating Real Prophet ML forecast...');

      const { data, error } = await supabase.functions.invoke('generate_forecast_v5', {
        body: { horizon_days: 90 }
      });

      if (error) throw error;

      console.log('Prophet v5 result:', data);
      setV5Result(data);
      toast.success(`Prophet ML forecast: ${data.locations_processed} locations`);

    } catch (err) {
      console.error('Prophet v5 error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMsg);
      toast.error(`Error: ${errorMsg}`);
    } finally {
      setIsGeneratingV5(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t('adminTools.adminTools')}</h1>
        <p className="text-gray-600 mt-2">{t("admin.toolsDescription")}</p>
      </div>

      {/* Forecast Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">{t('adminTools.generateProphetForecast')}</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* V4 - Statistical Prophet */}
          <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-100">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                <Sparkles className="h-6 w-6 text-purple-600" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">{t('adminTools.prophetV4')}</h3>
                    <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">{t('adminTools.statistical')}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {t('adminTools.forecastEstadisticoConTrendSeasonality')}
                  </p>
                </div>

                <div className="bg-white rounded-lg p-3 space-y-2 text-sm">
                  <p className="font-medium text-gray-900">{t('adminTools.incluye')}</p>
                  <ul className="space-y-1 text-gray-700 ml-4">
                    <li>{t('adminTools.trendLinealSeasonality')}</li>
                    <li>{t('adminTools.9RegresoresExternos')}</li>
                    <li>{t('adminTools.confidenceIntervals95')}</li>
                    <li>{t('adminTools.noRequiereServicioExterno')}</li>
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
                      {t('adminTools.generando60Seg')}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      {t('adminTools.generarV43Meses')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>

          {/* V5 - Real Python Prophet ML */}
          <Card className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200 ring-2 ring-blue-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <Brain className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">{t('adminTools.prophetV5')}</h3>
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{t('adminTools.realMl')}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {t('adminTools.facebookProphetRealPythonCon')}
                  </p>
                </div>

                <div className="bg-white rounded-lg p-3 space-y-2 text-sm">
                  <p className="font-medium text-gray-900">{t("admin.advantagesOverV4")}:</p>
                  <ul className="space-y-1 text-gray-700 ml-4">
                    <li>{t('adminTools.facebookProphetMlRealPython')}</li>
                    <li>{t('adminTools.changepointDetectionAutomatico')}</li>
                    <li>{t('adminTools.bayesianUncertaintyIntervals')}</li>
                    <li>{t('adminTools.fourierSeasonalityMonthlyCustom')}</li>
                    <li>{t('adminTools.crossvalidationMetricsMapeRmse')}</li>
                    <li>{t('adminTools.multiplicativeAdditiveRegressors')}</li>
                  </ul>
                </div>

                <Button
                  onClick={handleGenerateProphetV5}
                  disabled={isGeneratingV5}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                >
                  {isGeneratingV5 ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {t('adminTools.entrenandoModeloMl23Min')}
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-2" />
                      {t('adminTools.generarV5ProphetMl3')}
                    </>
                  )}
                </Button>

                <p className="text-xs text-gray-500">
                  {t('adminTools.requiereProphetserviceurlConfiguradoDepl')}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Seed Data Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">{t('adminTools.generateDemoData')}</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 18 Months Seed */}
          <Card className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                  <TrendingUp className="h-6 w-6 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{t('adminTools.18MesesCompletos')}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {t('adminTools.paraDemosEInversores')}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-700">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-indigo-600" />
                  <span className="font-medium">2025-01 a 2025-12:</span>
                  <span>{t("admin.actualsComplete")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-indigo-600" />
                  <span className="font-medium">2026-01 a 2026-02:</span>
                  <span>{t("admin.actualsCurrent")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-indigo-600" />
                  <span className="font-medium">2026-03 a 2026-06:</span>
                  <span>{t('adminTools.forecastplanned')}</span>
                </div>
              </div>

              <div className="bg-white rounded-lg p-3 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('adminTools.salesRecords')}</span>
                  <span className="font-semibold">~60,000</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('adminTools.labourRecords')}</span>
                  <span className="font-semibold">~1,980</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('adminTools.locations')}</span>
                  <span className="font-semibold">3</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('adminTools.employees')}</span>
                  <span className="font-semibold">70</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('adminTools.tiempo')}</span>
                  <span className="font-semibold text-amber-600">{t('adminTools.35Min')}</span>
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
                    {t('adminTools.generando35Min')}
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4 mr-2" />
                    {t('adminTools.generar18Meses')}
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
                  <h3 className="text-lg font-semibold text-gray-900">{t('admin.30DiasRapido')}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {t('adminTools.paraTestingRapido')}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-700">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-600" />
                  <span>{t('admin.ultimos30DiasConActuals')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>{t("admin.sufficientForFeatures")}</span>
                </div>
              </div>

              <div className="bg-white rounded-lg p-3 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('adminTools.salesRecords1')}</span>
                  <span className="font-semibold">~4,680</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('adminTools.labourRecords1')}</span>
                  <span className="font-semibold">~90</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('adminTools.tiempo1')}</span>
                  <span className="font-semibold text-emerald-600">{t('adminTools.30Seg')}</span>
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
                    {t('adminTools.generando')}
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4 mr-2" />
                    {t('adminTools.generar30Dias')}
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
                {t('adminTools.datosGeneradosExitosamente')}
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {seedResult.period && (
                  <div>
                    <span className="text-gray-600">{t('admin.periodo')}</span>
                    <span className="font-semibold ml-2">{seedResult.period}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-600">{t('adminTools.locations1')}</span>
                  <span className="font-semibold ml-2">{seedResult.locations}</span>
                </div>
                <div>
                  <span className="text-gray-600">{t('adminTools.employees1')}</span>
                  <span className="font-semibold ml-2">{seedResult.employees}</span>
                </div>
                <div>
                  <span className="text-gray-600">{t('adminTools.salesRecords2')}</span>
                  <span className="font-semibold ml-2">{seedResult.salesRecords?.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-600">{t('adminTools.labourRecords2')}</span>
                  <span className="font-semibold ml-2">{seedResult.labourRecords?.toLocaleString()}</span>
                </div>
              </div>
              
              {seedResult.breakdown && (
                <div className="mt-3 pt-3 border-t border-emerald-200">
                  <p className="text-sm font-medium text-gray-900 mb-2">{t('adminTools.breakdown')}</p>
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
                  {t('adminTools.verSalesModule')}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => window.location.href = '/insights/labour'}
                >
                  {t('adminTools.verLabourModule')}
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
                {t('adminTools.forecastGeneradoConProphetV4')}
              </h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">{t('adminTools.locationsProcesadas')}</span>
                    <span className="font-semibold ml-2">{forecastResult.locations_processed}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">{t('adminTools.horizon')}</span>
                    <span className="font-semibold ml-2">{forecastResult.horizon_days} días</span>
                  </div>
                </div>

                {forecastResult.results && forecastResult.results.length > 0 && (
                  <div className="bg-white rounded-lg p-3 space-y-2">
                    <p className="font-medium text-gray-900 text-sm">{t('admin.resultadosPorLocation')}</p>
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
                            <p className="font-medium mb-1">{t('admin.proximos7Dias')}</p>
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
                    {t('adminTools.verEnSales')}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => window.location.href = '/insights/labour'}
                  >
                    {t('adminTools.verEnLabour')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* V5 Prophet ML Result Display */}
      {v5Result && (
        <Card className="p-6 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <Brain className="h-6 w-6 text-blue-600 shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {t('adminTools.prophetV5RealMlForecast')}
              </h3>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">{t('adminTools.engine')}</span>
                    <span className="font-semibold ml-2">{v5Result.engine}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">{t('adminTools.locations2')}</span>
                    <span className="font-semibold ml-2">{v5Result.locations_processed}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">{t('adminTools.horizon1')}</span>
                    <span className="font-semibold ml-2">{v5Result.horizon_days} dias</span>
                  </div>
                </div>

                {v5Result.features && (
                  <div className="bg-white rounded-lg p-3 text-xs">
                    <p className="font-medium text-gray-900 mb-1">{t('adminTools.mlFeatures')}</p>
                    <div className="flex flex-wrap gap-1">
                      {v5Result.features.map((f: string, i: number) => (
                        <span key={i} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {v5Result.results && v5Result.results.length > 0 && (
                  <div className="bg-white rounded-lg p-3 space-y-3">
                    <p className="font-medium text-gray-900 text-sm">{t('admin.resultadosPorLocation')}</p>
                    {v5Result.results.map((r: any, i: number) => (
                      <div key={i} className="text-xs space-y-2 border-b border-gray-100 pb-3 last:border-0">
                        <p className="font-semibold text-gray-900 text-sm">{r.location_name}</p>

                        {r.error ? (
                          <p className="text-red-600">{r.error}</p>
                        ) : (
                          <>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              <div className="bg-blue-50 rounded p-2 text-center">
                                <p className="text-[10px] text-gray-500">MAPE</p>
                                <p className="font-bold text-blue-700">{r.metrics?.mape}</p>
                              </div>
                              <div className="bg-blue-50 rounded p-2 text-center">
                                <p className="text-[10px] text-gray-500">RMSE</p>
                                <p className="font-bold text-blue-700">{r.metrics?.rmse}</p>
                              </div>
                              <div className="bg-blue-50 rounded p-2 text-center">
                                <p className="text-[10px] text-gray-500">R2</p>
                                <p className="font-bold text-blue-700">{r.metrics?.r_squared}</p>
                              </div>
                              <div className="bg-blue-50 rounded p-2 text-center">
                                <p className="text-[10px] text-gray-500">{t('adminTools.confidence')}</p>
                                <p className="font-bold text-blue-700">{r.confidence}%</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-gray-700">
                              <span>Engine: {r.engine}</span>
                              <span>Changepoints: {r.changepoints}</span>
                              <span>Data: {r.data_points} dias</span>
                            </div>

                            {r.sample_forecast && r.sample_forecast.length > 0 && (
                              <div className="mt-2 bg-gray-50 p-2 rounded">
                                <p className="font-medium mb-1">{t('adminTools.proximos7Dias')}</p>
                                {r.sample_forecast.slice(0, 5).map((f: any, j: number) => (
                                  <div key={j} className="text-[10px] text-gray-600 flex justify-between">
                                    <span>{f.date}</span>
                                    <span className="font-medium">
                                      EUR{f.forecast?.toFixed(0)} [{f.lower?.toFixed(0)} - {f.upper?.toFixed(0)}]
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
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
                    {t('adminTools.verEnSales1')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.location.href = '/insights/labour'}
                  >
                    {t('adminTools.verEnLabour1')}
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
                {t('adminTools.errorAlGenerarDatos')}
              </h3>
              <p className="text-sm text-gray-700 mb-3">{error}</p>
              
              <div className="bg-white rounded-lg p-3 text-xs">
                <p className="font-medium mb-2">{t('adminTools.alternativas')}</p>
                <ol className="list-decimal list-inside space-y-1 text-gray-600">
                  <li>{t('adminTools.irASupabaseDashboardSql')}</li>
                  <li>{t('adminTools.ejecutar')} <code className="bg-gray-100 px-1 rounded">SELECT * FROM seed_josephine_demo_data();</code></li>
                  <li>{t('admin.oUsarElBoton30')}</li>
                </ol>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Instructions */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('adminTools.instrucciones')}</h3>
        
        <div className="space-y-3 text-sm text-gray-700">
          <div>
            <p className="font-medium text-gray-900 mb-1">{t('adminTools.18MesesRecomendadoParaDemos')}</p>
            <ul className="list-disc list-inside space-y-1 ml-4 text-gray-600">
              <li>{t('admin.todo2025ConDatosHistoricos')}</li>
              <li>{t('adminTools.enerofebrero2026ConActuals')}</li>
              <li>{t('adminTools.marzojunio2026ConForecast')}</li>
              <li>{t('adminTools.permiteComparacionesYoyVsLast')}</li>
              <li>{t('adminTools.60000RegistrosTarda35Minutos')}</li>
            </ul>
          </div>

          <div>
            <p className="font-medium text-gray-900 mb-1">{t('admin.30DiasParaTestingRapido')}</p>
            <ul className="list-disc list-inside space-y-1 ml-4 text-gray-600">
              <li>{t('admin.ultimos30DiasConActuals')}</li>
              <li>{t('adminTools.suficienteParaVerTodasLas')}</li>
              <li>{t('adminTools.4680RegistrosTarda30Segundos')}</li>
              <li>{t('adminTools.idealParaDesarrolloYTesting')}</li>
            </ul>
          </div>

          <div className="pt-3 border-t">
            <p className="font-medium text-gray-900 mb-1">{t('adminTools.importante')}</p>
            <ul className="list-disc list-inside space-y-1 ml-4 text-gray-600">
              <li>{t('admin.estoBorraraDatosDemoPrevios')}</li>
              <li>{t('adminTools.noAfectaDatosRealesDe')}</li>
              <li>{t('adminTools.soloBorraLocationsLaTaberna')}</li>
              <li>{t('adminTools.puedesRegenerarCuantasVecesNecesites')}</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* What Gets Generated */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("admin.whatIsGenerated")}</h3>
        
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">{t('adminTools.masterData')}</h4>
            <ul className="space-y-1 text-sm text-gray-700">
              <li>{t('adminTools.3LocationsMadridSalamanca')}</li>
              <li>{t('admin.70EmpleadosConRolesRealistas')}</li>
              <li>{t('admin.10ProductosDelMenuEspanol')}</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-2">{t('adminTools.factsData')}</h4>
            <ul className="space-y-1 text-sm text-gray-700">
              <li>{t('adminTools.factssales15mCada15min')}</li>
              <li>{t('admin.factslabordailyPorDia')}</li>
              <li>{t('adminTools.patronesRealistasWeekendsPeaks')}</li>
              <li>{t('admin.coherenciaMatematicaGarantizada')}</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Verification Queries */}
      <Card className="p-6 bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("admin.verificationQueries")}</h3>
        
        <div className="space-y-3">
          <div className="bg-white rounded-lg p-3 border">
            <p className="text-xs font-medium text-gray-700 mb-2">{t("admin.viewTotals")}:</p>
            <code className="text-xs bg-gray-100 p-2 rounded block overflow-x-auto">
              {`SELECT 
  (SELECT COUNT(*) FROM facts_sales_15m) as sales,
  (SELECT COUNT(*) FROM facts_labor_daily) as labour,
  (SELECT COUNT(*) FROM employees) as employees,
  (SELECT COUNT(*) FROM locations) as locations;`}
            </code>
          </div>

          <div className="bg-white rounded-lg p-3 border">
            <p className="text-xs font-medium text-gray-700 mb-2">{t("admin.viewSalesByMonth")}:</p>
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
