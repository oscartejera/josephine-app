/**
 * External Regressors for Prophet Forecast v2
 *
 * Key improvements over v1:
 * - Deterministic weather (seeded PRNG, no Math.random)
 * - Data-driven regressor impacts (learned from historical sales)
 * - Fallback to sensible defaults when no history exists
 * - OpenWeather API integration with deterministic fallback
 */

// ============================================
// FESTIVOS ESPAÑOLES 2025-2027
// ============================================
const SPANISH_HOLIDAYS = [
  // 2025
  '2025-01-01', '2025-01-06', '2025-04-18', '2025-04-21',
  '2025-05-01', '2025-05-02', '2025-08-15', '2025-10-12',
  '2025-11-01', '2025-12-06', '2025-12-08', '2025-12-25',
  // 2026
  '2026-01-01', '2026-01-06', '2026-04-03', '2026-04-06',
  '2026-05-01', '2026-08-15', '2026-10-12', '2026-11-01',
  '2026-12-06', '2026-12-08', '2026-12-25',
  // 2027
  '2027-01-01', '2027-01-06', '2027-03-26', '2027-03-29',
  '2027-05-01', '2027-08-15', '2027-10-12', '2027-11-01',
  '2027-12-06', '2027-12-08', '2027-12-25',
];

// ============================================
// EVENTOS GRANDES EN MADRID 2025-2027
// ============================================
const MADRID_EVENTS = [
  { date: '2025-03-15', impact: 1.3, name: 'Real Madrid Champions' },
  { date: '2025-04-20', impact: 1.3, name: 'Real Madrid Champions' },
  { date: '2025-09-20', impact: 1.3, name: 'Real Madrid Champions' },
  { date: '2025-10-25', impact: 1.3, name: 'Real Madrid Champions' },
  { date: '2025-07-10', impact: 1.4, name: 'Mad Cool Festival' },
  { date: '2025-07-11', impact: 1.4, name: 'Mad Cool Festival' },
  { date: '2025-07-12', impact: 1.4, name: 'Mad Cool Festival' },
  { date: '2025-05-15', impact: 1.2, name: 'San Isidro' },
  { date: '2026-02-18', impact: 1.3, name: 'Real Madrid Champions' },
  { date: '2026-03-10', impact: 1.3, name: 'Real Madrid Champions' },
  { date: '2026-04-15', impact: 1.3, name: 'Real Madrid Champions' },
  { date: '2026-05-20', impact: 1.3, name: 'Real Madrid Champions' },
  { date: '2026-07-09', impact: 1.4, name: 'Mad Cool Festival' },
  { date: '2026-07-10', impact: 1.4, name: 'Mad Cool Festival' },
  { date: '2026-07-11', impact: 1.4, name: 'Mad Cool Festival' },
  { date: '2026-05-15', impact: 1.2, name: 'San Isidro' },
];

// ============================================
// DETERMINISTIC PRNG (Mulberry32)
// ============================================

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dateSeed(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash + dateStr.charCodeAt(i)) | 0;
  }
  return hash;
}

// ============================================
// HELPER FUNCTIONS
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
  return dayOfMonth === 1 || dayOfMonth === 15 || dayOfMonth >= 25;
}

// ============================================
// DETERMINISTIC WEATHER (no Math.random)
// ============================================

interface WeatherData {
  temperature: number;
  rain: boolean;
  conditions: 'sunny' | 'cloudy' | 'rainy' | 'cold';
}

// Madrid monthly climate normals (AEMET data)
const MADRID_CLIMATE: Record<number, { avgTemp: number; tempStd: number; rainProb: number }> = {
  1:  { avgTemp: 6.3,  tempStd: 3.0, rainProb: 0.27 },
  2:  { avgTemp: 7.9,  tempStd: 3.2, rainProb: 0.25 },
  3:  { avgTemp: 11.2, tempStd: 3.5, rainProb: 0.23 },
  4:  { avgTemp: 13.1, tempStd: 3.0, rainProb: 0.30 },
  5:  { avgTemp: 17.2, tempStd: 3.5, rainProb: 0.28 },
  6:  { avgTemp: 22.5, tempStd: 3.0, rainProb: 0.12 },
  7:  { avgTemp: 26.1, tempStd: 2.5, rainProb: 0.07 },
  8:  { avgTemp: 25.6, tempStd: 2.5, rainProb: 0.08 },
  9:  { avgTemp: 21.3, tempStd: 3.0, rainProb: 0.18 },
  10: { avgTemp: 15.1, tempStd: 3.5, rainProb: 0.28 },
  11: { avgTemp: 9.9,  tempStd: 3.0, rainProb: 0.30 },
  12: { avgTemp: 6.9,  tempStd: 3.0, rainProb: 0.30 },
};

export function getWeatherDeterministic(dateStr: string): WeatherData {
  const rng = mulberry32(dateSeed(dateStr));
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const climate = MADRID_CLIMATE[month] || { avgTemp: 15, tempStd: 3, rainProb: 0.2 };

  // Box-Muller for normal distribution (deterministic)
  const u1 = Math.max(0.0001, rng());
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const temperature = Math.round((climate.avgTemp + z * climate.tempStd) * 10) / 10;

  const rain = rng() < climate.rainProb;

  let conditions: WeatherData['conditions'] = 'sunny';
  if (rain) conditions = 'rainy';
  else if (temperature < 10) conditions = 'cold';
  else if (rng() < 0.3) conditions = 'cloudy';

  return { temperature, rain, conditions };
}

// ============================================
// REAL WEATHER API (OpenWeather) with deterministic fallback
// ============================================

export async function getWeatherReal(dateStr: string, apiKey: string): Promise<WeatherData> {
  try {
    const date = new Date(dateStr);
    const now = new Date();

    if (date < now) {
      const timestamp = Math.floor(date.getTime() / 1000);
      const url = `https://api.openweathermap.org/data/3.0/onecall/timemachine?lat=40.4168&lon=-3.7038&dt=${timestamp}&appid=${apiKey}&units=metric`;
      const response = await fetch(url);
      if (!response.ok) return getWeatherDeterministic(dateStr);
      const data = await response.json();
      const weather = data.data?.[0];
      return {
        temperature: weather?.temp || 18,
        rain: weather?.rain?.['1h'] > 0 || false,
        conditions: weather?.weather?.[0]?.main === 'Rain' ? 'rainy' : 'sunny',
      };
    } else {
      const url = `https://api.openweathermap.org/data/2.5/forecast?lat=40.4168&lon=-3.7038&appid=${apiKey}&units=metric`;
      const response = await fetch(url);
      if (!response.ok) return getWeatherDeterministic(dateStr);
      const data = await response.json();
      const targetDate = date.toISOString().split('T')[0];
      const forecast = data.list?.find((f: any) => f.dt_txt.startsWith(targetDate));
      if (forecast) {
        return {
          temperature: forecast.main?.temp || 18,
          rain: forecast.weather?.[0]?.main === 'Rain',
          conditions: forecast.weather?.[0]?.main === 'Rain' ? 'rainy' : 'sunny',
        };
      }
      return getWeatherDeterministic(dateStr);
    }
  } catch {
    return getWeatherDeterministic(dateStr);
  }
}

// ============================================
// REGRESSOR INTERFACE
// ============================================

export interface Regressors {
  festivo: number;
  day_before_festivo: number;
  evento_impact: number;
  payday: number;
  temperatura: number;
  rain: number;
  cold_day: number;
  weekend: number;
  mid_week: number;
}

export async function getRegressors(
  dateStr: string,
  weatherApiKey?: string
): Promise<Regressors> {
  const date = new Date(dateStr);
  const dayOfWeek = date.getDay();

  const weather = weatherApiKey
    ? await getWeatherReal(dateStr, weatherApiKey)
    : getWeatherDeterministic(dateStr);

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
// DATA-DRIVEN REGRESSOR IMPACT LEARNING
// ============================================

export interface LearnedImpacts {
  festivo: number;
  day_before_festivo: number;
  payday: number;
  rain: number;
  cold: number;
  hot: number;
  ideal_temp: number;
  data_points: number;
}

const DEFAULT_IMPACTS: LearnedImpacts = {
  festivo: 0.80,
  day_before_festivo: 1.10,
  payday: 1.05,
  rain: 0.75,
  cold: 0.85,
  hot: 0.90,
  ideal_temp: 1.05,
  data_points: 0,
};

/**
 * Learn regressor impacts from historical sales data.
 * Compares average sales on regressor-active days vs normal days.
 * Returns multipliers (e.g., 0.78 means -22% on holidays).
 */
export function learnRegressorImpacts(
  dailyData: { date: string; sales: number }[]
): LearnedImpacts {
  if (dailyData.length < 30) return { ...DEFAULT_IMPACTS };

  const normalDays: number[] = [];
  const festivoDays: number[] = [];
  const preHolidayDays: number[] = [];
  const paydayDays: number[] = [];
  const rainDays: number[] = [];
  const coldDays: number[] = [];
  const hotDays: number[] = [];
  const idealTempDays: number[] = [];

  for (const d of dailyData) {
    if (d.sales <= 0) continue;
    const weather = getWeatherDeterministic(d.date);
    const holiday = isFestivo(d.date);
    const preHoliday = isDayBeforeFestivo(d.date);
    const payday = isPayday(d.date);

    if (holiday) { festivoDays.push(d.sales); continue; }

    normalDays.push(d.sales);
    if (preHoliday) preHolidayDays.push(d.sales);
    if (payday) paydayDays.push(d.sales);
    if (weather.rain) rainDays.push(d.sales);
    if (weather.temperature < 10) coldDays.push(d.sales);
    if (weather.temperature > 30) hotDays.push(d.sales);
    if (weather.temperature >= 18 && weather.temperature <= 25) idealTempDays.push(d.sales);
  }

  const avgNormal = normalDays.length > 0
    ? normalDays.reduce((a, b) => a + b, 0) / normalDays.length
    : 1;

  function safeRatio(arr: number[], minSamples: number): number | null {
    if (arr.length < minSamples || avgNormal <= 0) return null;
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    const ratio = avg / avgNormal;
    return Math.max(0.5, Math.min(1.5, ratio));
  }

  return {
    festivo: safeRatio(festivoDays, 2) ?? DEFAULT_IMPACTS.festivo,
    day_before_festivo: safeRatio(preHolidayDays, 2) ?? DEFAULT_IMPACTS.day_before_festivo,
    payday: safeRatio(paydayDays, 5) ?? DEFAULT_IMPACTS.payday,
    rain: safeRatio(rainDays, 5) ?? DEFAULT_IMPACTS.rain,
    cold: safeRatio(coldDays, 5) ?? DEFAULT_IMPACTS.cold,
    hot: safeRatio(hotDays, 3) ?? DEFAULT_IMPACTS.hot,
    ideal_temp: safeRatio(idealTempDays, 5) ?? DEFAULT_IMPACTS.ideal_temp,
    data_points: dailyData.length,
  };
}

// ============================================
// ADJUSTMENT FACTOR (data-driven or default)
// ============================================

export function calculateRegressorAdjustment(
  regressors: Regressors,
  impacts?: LearnedImpacts
): number {
  const imp = impacts || DEFAULT_IMPACTS;
  let adjustment = 1.0;

  if (regressors.festivo === 1) adjustment *= imp.festivo;
  if (regressors.day_before_festivo === 1) adjustment *= imp.day_before_festivo;
  adjustment *= regressors.evento_impact;
  if (regressors.payday === 1) adjustment *= imp.payday;

  if (regressors.temperatura < 10) adjustment *= imp.cold;
  else if (regressors.temperatura > 30) adjustment *= imp.hot;
  else if (regressors.temperatura >= 18 && regressors.temperatura <= 25) adjustment *= imp.ideal_temp;

  if (regressors.rain === 1) adjustment *= imp.rain;

  return adjustment;
}

// ============================================
// IMPORTANCE & EXPLANATION
// ============================================

export function getRegressorImportance(): Record<keyof Regressors, number> {
  return {
    rain: 0.25,
    evento_impact: 0.20,
    festivo: 0.20,
    temperatura: 0.15,
    cold_day: 0.10,
    day_before_festivo: 0.10,
    payday: 0.05,
    weekend: 0.00,
    mid_week: 0.00,
  };
}

export function explainForecast(
  baseForecast: number,
  regressors: Regressors,
  finalForecast: number,
  impacts?: LearnedImpacts
): string {
  if (baseForecast <= 0) return `Forecast: €${finalForecast.toFixed(0)}`;
  const adjustment = (finalForecast / baseForecast - 1) * 100;
  const imp = impacts || DEFAULT_IMPACTS;
  const parts: string[] = [];
  const learned = imp.data_points > 0 ? ' [learned]' : '';

  if (regressors.rain === 1) parts.push(`lluvia (${((imp.rain - 1) * 100).toFixed(0)}%${learned})`);
  if (regressors.festivo === 1) parts.push(`festivo (${((imp.festivo - 1) * 100).toFixed(0)}%${learned})`);
  if (regressors.evento_impact > 1.1) parts.push(`evento (+${((regressors.evento_impact - 1) * 100).toFixed(0)}%)`);
  if (regressors.day_before_festivo === 1) parts.push(`pre-festivo (+${((imp.day_before_festivo - 1) * 100).toFixed(0)}%${learned})`);
  if (regressors.payday === 1) parts.push(`día de pago (+${((imp.payday - 1) * 100).toFixed(0)}%${learned})`);
  if (regressors.temperatura < 10) parts.push(`frío (${((imp.cold - 1) * 100).toFixed(0)}%${learned})`);
  if (regressors.temperatura > 30) parts.push(`calor (${((imp.hot - 1) * 100).toFixed(0)}%${learned})`);

  if (parts.length === 0) return `Base forecast: €${baseForecast.toFixed(0)}`;
  return `Base €${baseForecast.toFixed(0)} ${adjustment >= 0 ? '+' : ''}${adjustment.toFixed(1)}% (${parts.join(', ')}) = €${finalForecast.toFixed(0)}`;
}
