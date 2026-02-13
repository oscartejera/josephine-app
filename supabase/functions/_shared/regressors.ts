/**
 * External Regressors for Prophet Forecast
 * Adds clima, eventos, festivos to improve forecast accuracy
 */

// ============================================
// FESTIVOS ESPAÑOLES 2025-2026
// ============================================
const SPANISH_HOLIDAYS = [
  // 2025
  '2025-01-01', // Año Nuevo
  '2025-01-06', // Reyes
  '2025-04-18', // Viernes Santo
  '2025-04-21', // Lunes de Pascua
  '2025-05-01', // Día del Trabajo
  '2025-08-15', // Asunción
  '2025-10-12', // Fiesta Nacional
  '2025-11-01', // Todos los Santos
  '2025-12-06', // Constitución
  '2025-12-08', // Inmaculada
  '2025-12-25', // Navidad
  // 2026
  '2026-01-01', // Año Nuevo
  '2026-01-06', // Reyes
  '2026-04-03', // Viernes Santo
  '2026-04-06', // Lunes de Pascua
  '2026-05-01', // Día del Trabajo
  '2026-08-15', // Asunción
  '2026-10-12', // Fiesta Nacional
  '2026-11-01', // Todos los Santos
  '2026-12-06', // Constitución
  '2026-12-08', // Inmaculada
  '2026-12-25', // Navidad
];

// ============================================
// EVENTOS GRANDES EN MADRID 2025-2026
// ============================================
const MADRID_EVENTS = [
  // Real Madrid Champions League (partidos grandes)
  { date: '2025-03-15', impact: 1.3, name: 'Real Madrid Champions' },
  { date: '2025-04-20', impact: 1.3, name: 'Real Madrid Champions' },
  { date: '2025-09-20', impact: 1.3, name: 'Real Madrid Champions' },
  { date: '2025-10-25', impact: 1.3, name: 'Real Madrid Champions' },
  { date: '2026-02-18', impact: 1.3, name: 'Real Madrid Champions' },
  { date: '2026-03-10', impact: 1.3, name: 'Real Madrid Champions' },
  { date: '2026-04-15', impact: 1.3, name: 'Real Madrid Champions' },
  { date: '2026-05-20', impact: 1.3, name: 'Real Madrid Champions' },
  
  // Mad Cool Festival (verano)
  { date: '2025-07-10', impact: 1.4, name: 'Mad Cool Festival' },
  { date: '2025-07-11', impact: 1.4, name: 'Mad Cool Festival' },
  { date: '2025-07-12', impact: 1.4, name: 'Mad Cool Festival' },
  { date: '2026-07-09', impact: 1.4, name: 'Mad Cool Festival' },
  { date: '2026-07-10', impact: 1.4, name: 'Mad Cool Festival' },
  { date: '2026-07-11', impact: 1.4, name: 'Mad Cool Festival' },
  
  // San Isidro (Mayo)
  { date: '2025-05-15', impact: 1.2, name: 'San Isidro' },
  { date: '2026-05-15', impact: 1.2, name: 'San Isidro' },
];

// ============================================
// FUNCIONES HELPER
// ============================================

export function isFestivo(dateStr: string): boolean {
  return SPANISH_HOLIDAYS.includes(dateStr);
}

export function getEventImpact(dateStr: string): number {
  const event = MADRID_EVENTS.find(e => e.date === dateStr);
  return event ? event.impact : 1.0;
}

export function isDayBeforeFestivo(dateStr: string): boolean {
  const date = new Date(dateStr);
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  const nextDayStr = nextDay.toISOString().split('T')[0];
  return SPANISH_HOLIDAYS.includes(nextDayStr);
}

export function isPayday(dateStr: string): boolean {
  const date = new Date(dateStr);
  const dayOfMonth = date.getDate();
  // Días de pago típicos: 1, 15, 25-31 (fin de mes)
  return dayOfMonth === 1 || dayOfMonth === 15 || dayOfMonth >= 25;
}

// ============================================
// CLIMA (Mock - en producción usar OpenWeather API)
// ============================================

interface WeatherData {
  temperature: number; // Celsius
  rain: boolean;
  conditions: 'sunny' | 'cloudy' | 'rainy' | 'cold';
}

export function getWeatherMock(dateStr: string): WeatherData {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const dayOfMonth = date.getDate();
  
  // Temperatura media por mes en Madrid
  const avgTempByMonth: Record<number, number> = {
    1: 8, 2: 10, 3: 13, 4: 15, 5: 19, 6: 24,
    7: 28, 8: 28, 9: 24, 10: 18, 11: 12, 12: 9
  };
  
  const baseTemp = avgTempByMonth[month] || 18;
  const temperature = baseTemp + (Math.random() - 0.5) * 5; // ±2.5°C variation
  
  // Probabilidad de lluvia por mes
  const rainProbByMonth: Record<number, number> = {
    1: 0.30, 2: 0.28, 3: 0.25, 4: 0.35, 5: 0.30, 6: 0.15,
    7: 0.10, 8: 0.10, 9: 0.20, 10: 0.30, 11: 0.32, 12: 0.35
  };
  
  const rainProb = rainProbByMonth[month] || 0.25;
  const rain = Math.random() < rainProb;
  
  let conditions: 'sunny' | 'cloudy' | 'rainy' | 'cold' = 'sunny';
  if (rain) conditions = 'rainy';
  else if (temperature < 10) conditions = 'cold';
  else if (Math.random() < 0.3) conditions = 'cloudy';
  
  return { temperature, rain, conditions };
}

// ============================================
// REAL WEATHER API (OpenWeather)
// ============================================

export async function getWeatherReal(dateStr: string, apiKey: string): Promise<WeatherData> {
  // Para datos históricos: OpenWeather Historical API
  // Para forecast: OpenWeather Forecast API
  
  try {
    const date = new Date(dateStr);
    const now = new Date();
    
    if (date < now) {
      // Historical weather (requiere suscripción)
      const timestamp = Math.floor(date.getTime() / 1000);
      const url = `https://api.openweathermap.org/data/3.0/onecall/timemachine?lat=40.4168&lon=-3.7038&dt=${timestamp}&appid=${apiKey}&units=metric`;
      
      const response = await fetch(url);
      if (!response.ok) {
        console.warn('Weather API failed, using mock');
        return getWeatherMock(dateStr);
      }
      
      const data = await response.json();
      const weather = data.data?.[0];
      
      return {
        temperature: weather?.temp || 18,
        rain: weather?.rain?.['1h'] > 0 || false,
        conditions: weather?.weather?.[0]?.main === 'Rain' ? 'rainy' : 'sunny'
      };
    } else {
      // Forecast weather (gratis hasta 5 días)
      const url = `https://api.openweathermap.org/data/2.5/forecast?lat=40.4168&lon=-3.7038&appid=${apiKey}&units=metric`;
      
      const response = await fetch(url);
      if (!response.ok) {
        return getWeatherMock(dateStr);
      }
      
      const data = await response.json();
      // Buscar el forecast más cercano a la fecha
      const targetDate = date.toISOString().split('T')[0];
      const forecast = data.list?.find((f: any) => f.dt_txt.startsWith(targetDate));
      
      if (forecast) {
        return {
          temperature: forecast.main?.temp || 18,
          rain: forecast.weather?.[0]?.main === 'Rain',
          conditions: forecast.weather?.[0]?.main === 'Rain' ? 'rainy' : 'sunny'
        };
      }
      
      return getWeatherMock(dateStr);
    }
  } catch (error) {
    console.error('Weather API error:', error);
    return getWeatherMock(dateStr);
  }
}

// ============================================
// CALCULAR TODOS LOS REGRESORES PARA UNA FECHA
// ============================================

export interface Regressors {
  festivo: number;              // 0 o 1
  day_before_festivo: number;   // 0 o 1
  evento_impact: number;        // 1.0 a 1.4
  payday: number;               // 0 o 1
  temperatura: number;          // Celsius
  rain: number;                 // 0 o 1
  cold_day: number;             // 0 o 1 (temp < 10°C)
  weekend: number;              // 0 o 1
  mid_week: number;             // 0 o 1 (Tue o Wed)
}

export async function getRegressors(
  dateStr: string, 
  weatherApiKey?: string
): Promise<Regressors> {
  const date = new Date(dateStr);
  const dayOfWeek = date.getDay();
  
  // Get weather (use real API if available, otherwise mock)
  const weather = weatherApiKey 
    ? await getWeatherReal(dateStr, weatherApiKey)
    : getWeatherMock(dateStr);
  
  return {
    festivo: isFestivo(dateStr) ? 1 : 0,
    day_before_festivo: isDayBeforeFestivo(dateStr) ? 1 : 0,
    evento_impact: getEventImpact(dateStr),
    payday: isPayday(dateStr) ? 1 : 0,
    temperatura: weather.temperature,
    rain: weather.rain ? 1 : 0,
    cold_day: weather.temperature < 10 ? 1 : 0,
    weekend: (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) ? 1 : 0,
    mid_week: (dayOfWeek === 2 || dayOfWeek === 3) ? 1 : 0,
  };
}

// ============================================
// CALCULAR ADJUSTMENT FACTOR BASADO EN REGRESORES
// ============================================

export function calculateRegressorAdjustment(regressors: Regressors): number {
  let adjustment = 1.0;
  
  // Festivos: -20% (restaurantes cierran o menos gente)
  if (regressors.festivo === 1) {
    adjustment *= 0.80;
  }
  
  // Día antes de festivo: +10% (gente sale más)
  if (regressors.day_before_festivo === 1) {
    adjustment *= 1.10;
  }
  
  // Eventos: multiplicador directo
  adjustment *= regressors.evento_impact;
  
  // Día de pago: +5%
  if (regressors.payday === 1) {
    adjustment *= 1.05;
  }
  
  // Temperatura:
  // Óptimo: 18-25°C (no adjustment)
  // Frío <10°C: -15%
  // Mucho calor >30°C: -10%
  if (regressors.temperatura < 10) {
    adjustment *= 0.85;
  } else if (regressors.temperatura > 30) {
    adjustment *= 0.90;
  } else if (regressors.temperatura >= 18 && regressors.temperatura <= 25) {
    adjustment *= 1.05; // Temperatura ideal boost
  }
  
  // Lluvia: -25% (gran impacto en dine-in)
  if (regressors.rain === 1) {
    adjustment *= 0.75;
  }
  
  // Weekend boost (si no está ya en seasonal index)
  // Ya manejado en seasonal index, no duplicar
  
  return adjustment;
}

// ============================================
// WEIGHT IMPORTANCE (para logging)
// ============================================

export function getRegressorImportance(): Record<keyof Regressors, number> {
  return {
    rain: 0.25,              // 25% impact
    evento_impact: 0.20,     // 20% impact
    festivo: 0.20,           // 20% impact
    temperatura: 0.15,       // 15% impact
    cold_day: 0.10,          // 10% impact
    day_before_festivo: 0.10, // 10% impact
    payday: 0.05,            // 5% impact
    weekend: 0.00,           // Handled by seasonal
    mid_week: 0.00,          // Handled by seasonal
  };
}

export function explainForecast(
  baseForecast: number,
  regressors: Regressors,
  finalForecast: number
): string {
  const adjustment = (finalForecast / baseForecast - 1) * 100;
  const parts: string[] = [];
  
  if (regressors.rain === 1) parts.push('lluvia (-25%)');
  if (regressors.festivo === 1) parts.push('festivo (-20%)');
  if (regressors.evento_impact > 1.1) parts.push(`evento (+${((regressors.evento_impact - 1) * 100).toFixed(0)}%)`);
  if (regressors.day_before_festivo === 1) parts.push('pre-festivo (+10%)');
  if (regressors.payday === 1) parts.push('día de pago (+5%)');
  if (regressors.temperatura < 10) parts.push('frío (-15%)');
  if (regressors.temperatura > 30) parts.push('mucho calor (-10%)');
  
  if (parts.length === 0) return `Base forecast: €${baseForecast.toFixed(0)}`;
  
  return `Base €${baseForecast.toFixed(0)} ${adjustment >= 0 ? '+' : ''}${adjustment.toFixed(1)}% (${parts.join(', ')}) = €${finalForecast.toFixed(0)}`;
}
