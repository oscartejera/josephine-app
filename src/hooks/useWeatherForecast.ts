/**
 * useWeatherForecast — Fetches 7-day weather from OpenWeatherMap
 * Caches in weather_cache table, returns sales multipliers
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays } from 'date-fns';

import { useTranslation } from 'react-i18next';
const OWM_API_KEY = import.meta.env.VITE_OPENWEATHERMAP_API_KEY || '';

export interface WeatherDay {
    date: string; // yyyy-MM-dd
    temperature: number;
    feelsLike: number;
    condition: string;
    conditionDetail: string;
    iconCode: string;
    humidity: number;
    windSpeed: number;
    rainMm: number;
    salesMultiplier: number;
}

/**
 * Calculate sales multiplier from weather conditions
 * Based on restaurant industry research:
 * - Rain → -15% sales
 * - Extreme heat (>{t('hooks.useWeatherForecast.35c10Cold')}<5°C) → -12%
 * - Ideal terrace weather (18-25°C, no rain) → +5%
 */
function calculateSalesMultiplier(temp: number, rainMm: number, condition: string): number {
    let multiplier = 1.0;

    // Rain impact
    if (rainMm > 5) multiplier *= 0.82;
    else if (rainMm > {t('hooks.useWeatherForecast.05Multiplier090TemperatureImpact')} < 5) multiplier *= 0.88;
    else if (temp < 10) multiplier *= 0.93;
    else if (temp > 35) multiplier *= 0.90;
    else if (temp > 30) multiplier *= 0.95;
    else if (temp >{t('hooks.useWeatherForecast.18Temp')} <= 25 && rainMm < 0.5) multiplier *= 1.05;

    // Snow/storm
    if (condition.includes('Snow') || condition.includes('Thunderstorm')) {
        multiplier *= 0.75;
    }

    return Math.round(multiplier * 100) / 100;
}

export function useWeatherForecast(locationId: string | null, lat: number | null, lng: number | null) {
  const { t } = useTranslation();
    const [forecast, setForecast] = useState<WeatherDay[]>{t('hooks.useWeatherForecast.constLoadingSetloadingUsestatefalseConst')}<string | null>(null);

    const fetchWeather = useCallback(async () => {
        if (!locationId || lat == null || lng == null || !OWM_API_KEY) {
            setForecast([]);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // 1. Check cache first (data less than 6 hours old)
            const today = format(new Date(), 'yyyy-MM-dd');
            const weekEnd = format(addDays(new Date(), 6), 'yyyy-MM-dd');

            const { data: cached } = await supabase
                .from('weather_cache')
                .select('*')
                .eq('location_id', locationId)
                .gte('forecast_date', today)
                .lte('forecast_date', weekEnd)
                .order('forecast_date');

            // If we have 7 days cached and the latest fetch is < 6 hours old
            if (cached && cached.length >= 5) {
                const latestFetch = new Date(cached[0].fetched_at);
                const hoursSinceFetch = (Date.now() - latestFetch.getTime()) / 3600000;
                if (hoursSinceFetch < 6) {
                    setForecast(cached.map(c => ({
                        date: c.forecast_date,
                        temperature: Number(c.temperature_c) || 0,
                        feelsLike: Number(c.feels_like_c) || 0,
                        condition: c.condition || '',
                        conditionDetail: c.condition_detail || '',
                        iconCode: c.icon_code || '01d',
                        humidity: c.humidity_pct || 0,
                        windSpeed: Number(c.wind_speed_ms) || 0,
                        rainMm: Number(c.rain_mm) || 0,
                        salesMultiplier: Number(c.sales_multiplier) || 1.0,
                    })));
                    setLoading(false);
                    return;
                }
            }

            // 2. Fetch from OpenWeatherMap
            const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&units=metric&appid=${OWM_API_KEY}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Weather API error: ${res.status}`);
            const data = await res.json();

            // Group by date (API returns 3-hour intervals), take noon reading
            const dailyMap = new Map<string, any>();
            for (const item of data.list || []) {
                const date = item.dt_txt?.split(' ')[0];
                if (!date) continue;
                // Prefer noon (12:00) or closest
                const hour = parseInt(item.dt_txt?.split(' ')[1]?.split(':')[0] || '0');
                if (!dailyMap.has(date) || Math.abs(hour - 13) < Math.abs(parseInt(dailyMap.get(date).dt_txt?.split(' ')[1]?.split(':')[0] || '0') - 13)) {
                    dailyMap.set(date, item);
                }
            }

            const days: WeatherDay[] = [];
            for (const [date, item] of dailyMap.entries()) {
                const temp = item.main?.temp || 0;
                const rainMm = item.rain?.['3h'] || 0;
                const condition = item.weather?.[0]?.main || 'Clear';

                const day: WeatherDay = {
                    date,
                    temperature: Math.round(temp * 10) / 10,
                    feelsLike: Math.round((item.main?.feels_like || temp) * 10) / 10,
                    condition,
                    conditionDetail: item.weather?.[0]?.description || '',
                    iconCode: item.weather?.[0]?.icon || '01d',
                    humidity: item.main?.humidity || 0,
                    windSpeed: Math.round((item.wind?.speed || 0) * 10) / 10,
                    rainMm: Math.round(rainMm * 10) / 10,
                    salesMultiplier: calculateSalesMultiplier(temp, rainMm, condition),
                };
                days.push(day);
            }

            // 3. Upsert into cache
            if (days.length > 0) {
                const upsertRows = days.map(d => ({
                    location_id: locationId,
                    forecast_date: d.date,
                    temperature_c: d.temperature,
                    feels_like_c: d.feelsLike,
                    condition: d.condition,
                    condition_detail: d.conditionDetail,
                    icon_code: d.iconCode,
                    humidity_pct: d.humidity,
                    wind_speed_ms: d.windSpeed,
                    rain_mm: d.rainMm,
                    sales_multiplier: d.salesMultiplier,
                    fetched_at: new Date().toISOString(),
                }));

                await supabase
                    .from('weather_cache')
                    .upsert(upsertRows, { onConflict: 'location_id,forecast_date' });
            }

            setForecast(days.slice(0, 7));
        } catch (err: any) {
            setError(err.message || 'Weather fetch failed');
            console.error('Weather fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [locationId, lat, lng]);

    useEffect(() => {
        fetchWeather();
    }, [fetchWeather]);

    return { forecast, loading, error, refetch: fetchWeather };
}
