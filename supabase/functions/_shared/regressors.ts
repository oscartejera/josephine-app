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

// ============================================
// TIME SERIES ANALYSIS UTILITIES
// ============================================

export interface TimeSeriesMetrics {
  mape: number;
  rmse: number;
  mae: number;
  mase: number;
  directional_accuracy: number;
  forecast_bias: number;
  r_squared: number;
}

export interface StationarityResult {
  is_stationary: boolean;
  adf_statistic: number;
  mean_first_half: number;
  mean_second_half: number;
  variance_ratio: number;
  recommendation: string;
}

export interface SeasonalityStrength {
  weekly: number;   // 0-1 strength
  monthly: number;  // 0-1 strength
  has_weekly: boolean;
  has_monthly: boolean;
  dominant: 'weekly' | 'monthly' | 'none';
}

/**
 * Compute comprehensive forecast evaluation metrics.
 * Implements MAPE, RMSE, MAE, MASE, directional accuracy, and bias.
 * MASE uses naive forecast (y_{t-1}) as baseline - scale-independent metric.
 */
export function computeTimeSeriesMetrics(
  actual: number[],
  predicted: number[],
  historical?: number[]
): TimeSeriesMetrics {
  const n = Math.min(actual.length, predicted.length);
  if (n === 0) return { mape: 0, rmse: 0, mae: 0, mase: 0, directional_accuracy: 0, forecast_bias: 0, r_squared: 0 };

  let sumAbsPercentError = 0;
  let sumSquaredError = 0;
  let sumAbsError = 0;
  let sumError = 0;
  let countMape = 0;
  let correctDirection = 0;
  let directionCount = 0;

  for (let i = 0; i < n; i++) {
    const error = actual[i] - predicted[i];
    sumAbsError += Math.abs(error);
    sumSquaredError += error * error;
    sumError += error;

    if (actual[i] > 0) {
      sumAbsPercentError += Math.abs(error / actual[i]);
      countMape++;
    }

    // Directional accuracy: did we predict the direction of change correctly?
    if (i > 0) {
      const actualDir = actual[i] - actual[i - 1];
      const predDir = predicted[i] - predicted[i - 1];
      if ((actualDir >= 0 && predDir >= 0) || (actualDir < 0 && predDir < 0)) {
        correctDirection++;
      }
      directionCount++;
    }
  }

  const mape = countMape > 0 ? sumAbsPercentError / countMape : 0;
  const rmse = Math.sqrt(sumSquaredError / n);
  const mae = sumAbsError / n;
  const bias = sumError / n;

  // MASE: Mean Absolute Scaled Error (vs naive forecast y_{t-1})
  let mase = 0;
  const hist = historical || actual;
  if (hist.length > 1) {
    let naiveMAE = 0;
    for (let i = 1; i < hist.length; i++) {
      naiveMAE += Math.abs(hist[i] - hist[i - 1]);
    }
    naiveMAE /= (hist.length - 1);
    mase = naiveMAE > 0 ? mae / naiveMAE : 0;
  }

  // R-squared
  const meanActual = actual.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const ssTot = actual.slice(0, n).reduce((s, a) => s + (a - meanActual) ** 2, 0);
  const ssRes = sumSquaredError;
  const rSquared = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  return {
    mape,
    rmse,
    mae,
    mase,
    directional_accuracy: directionCount > 0 ? correctDirection / directionCount : 0,
    forecast_bias: bias,
    r_squared: rSquared,
  };
}

/**
 * Simplified stationarity test for Deno/Edge Functions.
 * Uses mean/variance comparison between first and second half of series
 * plus first-order autocorrelation as a proxy for ADF test.
 * For a proper ADF test, use the Python Prophet service.
 */
export function checkStationarity(values: number[]): StationarityResult {
  const n = values.length;
  if (n < 20) {
    return {
      is_stationary: true,
      adf_statistic: 0,
      mean_first_half: 0,
      mean_second_half: 0,
      variance_ratio: 1,
      recommendation: 'Insufficient data for stationarity test',
    };
  }

  const mid = Math.floor(n / 2);
  const firstHalf = values.slice(0, mid);
  const secondHalf = values.slice(mid);

  const mean1 = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const mean2 = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const var1 = firstHalf.reduce((s, v) => s + (v - mean1) ** 2, 0) / firstHalf.length;
  const var2 = secondHalf.reduce((s, v) => s + (v - mean2) ** 2, 0) / secondHalf.length;

  // First-order autocorrelation as ADF proxy
  const mean = values.reduce((a, b) => a + b, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (let i = 1; i < n; i++) {
    numerator += (values[i] - mean) * (values[i - 1] - mean);
    denominator += (values[i - 1] - mean) ** 2;
  }
  const rho = denominator > 0 ? numerator / denominator : 0;
  // ADF-like statistic: (rho - 1) * sqrt(n)
  const adfStat = (rho - 1) * Math.sqrt(n);

  const varianceRatio = var1 > 0 ? var2 / var1 : 1;
  const meanShift = mean1 > 0 ? Math.abs(mean2 - mean1) / mean1 : 0;

  // Heuristic: stationary if no significant mean shift and ADF < -2.86 (5% critical)
  const isStationary = adfStat < -2.86 && meanShift < 0.25 && varianceRatio < 2.0 && varianceRatio > 0.5;

  let recommendation = 'Series appears stationary';
  if (!isStationary) {
    if (meanShift > 0.25) recommendation = 'Significant trend detected - consider differencing (d=1)';
    else if (varianceRatio > 2.0 || varianceRatio < 0.5) recommendation = 'Variance instability - consider log transform';
    else recommendation = 'High autocorrelation - consider differencing (d=1)';
  }

  return {
    is_stationary: isStationary,
    adf_statistic: Math.round(adfStat * 100) / 100,
    mean_first_half: Math.round(mean1),
    mean_second_half: Math.round(mean2),
    variance_ratio: Math.round(varianceRatio * 100) / 100,
    recommendation,
  };
}

/**
 * Detect seasonality strength using variance decomposition.
 * Compares variance within seasonal groups to total variance.
 * Strength 0-1: 0 = no seasonality, 1 = perfectly seasonal.
 */
export function detectSeasonalityStrength(
  dailyData: { dayOfWeek: number; month: number; sales: number }[]
): SeasonalityStrength {
  if (dailyData.length < 14) {
    return { weekly: 0, monthly: 0, has_weekly: false, has_monthly: false, dominant: 'none' };
  }

  const salesValues = dailyData.map(d => d.sales).filter(s => s > 0);
  if (salesValues.length === 0) {
    return { weekly: 0, monthly: 0, has_weekly: false, has_monthly: false, dominant: 'none' };
  }

  const grandMean = salesValues.reduce((a, b) => a + b, 0) / salesValues.length;
  const totalVar = salesValues.reduce((s, v) => s + (v - grandMean) ** 2, 0) / salesValues.length;
  if (totalVar === 0) {
    return { weekly: 0, monthly: 0, has_weekly: false, has_monthly: false, dominant: 'none' };
  }

  // Weekly: group by dayOfWeek
  const weekGroups: Record<number, number[]> = {};
  for (const d of dailyData) {
    if (d.sales <= 0) continue;
    if (!weekGroups[d.dayOfWeek]) weekGroups[d.dayOfWeek] = [];
    weekGroups[d.dayOfWeek].push(d.sales);
  }
  let weeklyBetweenVar = 0;
  for (const group of Object.values(weekGroups)) {
    const groupMean = group.reduce((a, b) => a + b, 0) / group.length;
    weeklyBetweenVar += group.length * (groupMean - grandMean) ** 2;
  }
  weeklyBetweenVar /= salesValues.length;
  const weeklyStrength = Math.min(1, weeklyBetweenVar / totalVar);

  // Monthly: group by month
  const monthGroups: Record<number, number[]> = {};
  for (const d of dailyData) {
    if (d.sales <= 0) continue;
    if (!monthGroups[d.month]) monthGroups[d.month] = [];
    monthGroups[d.month].push(d.sales);
  }
  let monthlyBetweenVar = 0;
  for (const group of Object.values(monthGroups)) {
    const groupMean = group.reduce((a, b) => a + b, 0) / group.length;
    monthlyBetweenVar += group.length * (groupMean - grandMean) ** 2;
  }
  monthlyBetweenVar /= salesValues.length;
  const monthlyStrength = Math.min(1, monthlyBetweenVar / totalVar);

  const hasWeekly = weeklyStrength > 0.05;
  const hasMonthly = monthlyStrength > 0.05;

  return {
    weekly: Math.round(weeklyStrength * 1000) / 1000,
    monthly: Math.round(monthlyStrength * 1000) / 1000,
    has_weekly: hasWeekly,
    has_monthly: hasMonthly,
    dominant: weeklyStrength > monthlyStrength ? 'weekly' : monthlyStrength > 0.05 ? 'monthly' : 'none',
  };
}

/**
 * Expanding window cross-validation for time series.
 * Unlike random K-fold, this preserves temporal order:
 *   Fold 1: train[0..60%] → test[60%..70%]
 *   Fold 2: train[0..70%] → test[70%..80%]
 *   Fold 3: train[0..80%] → test[80%..90%]
 *   Fold 4: train[0..90%] → test[90%..100%]
 *
 * Returns per-fold metrics and aggregated metrics.
 */
export interface CVFold {
  fold: number;
  train_size: number;
  test_size: number;
  metrics: TimeSeriesMetrics;
}

export interface ExpandingWindowCVResult {
  folds: CVFold[];
  aggregated: TimeSeriesMetrics;
  stability: number; // std of MAPE across folds / mean MAPE (lower = more stable)
}

export function expandingWindowCV(
  dailyData: { t: number; sales: number; month: number; dayOfWeek: number }[],
  predictFn: (train: typeof dailyData, testDates: typeof dailyData) => number[],
  nFolds: number = 4,
  minTrainPct: number = 0.5
): ExpandingWindowCVResult {
  const n = dailyData.length;
  const folds: CVFold[] = [];

  // Calculate fold boundaries
  const testPct = (1 - minTrainPct) / nFolds;

  for (let i = 0; i < nFolds; i++) {
    const trainEnd = Math.floor(n * (minTrainPct + i * testPct));
    const testEnd = Math.floor(n * (minTrainPct + (i + 1) * testPct));

    if (trainEnd < 30 || testEnd > n) continue;

    const train = dailyData.slice(0, trainEnd);
    const test = dailyData.slice(trainEnd, testEnd);

    if (test.length < 7) continue;

    const predictions = predictFn(train, test);
    const actual = test.map(d => d.sales);
    const historical = train.map(d => d.sales);

    const metrics = computeTimeSeriesMetrics(actual, predictions, historical);

    folds.push({
      fold: i + 1,
      train_size: train.length,
      test_size: test.length,
      metrics,
    });
  }

  // Aggregate metrics
  if (folds.length === 0) {
    return {
      folds: [],
      aggregated: { mape: 0, rmse: 0, mae: 0, mase: 0, directional_accuracy: 0, forecast_bias: 0, r_squared: 0 },
      stability: 0,
    };
  }

  const agg: TimeSeriesMetrics = {
    mape: folds.reduce((s, f) => s + f.metrics.mape, 0) / folds.length,
    rmse: folds.reduce((s, f) => s + f.metrics.rmse, 0) / folds.length,
    mae: folds.reduce((s, f) => s + f.metrics.mae, 0) / folds.length,
    mase: folds.reduce((s, f) => s + f.metrics.mase, 0) / folds.length,
    directional_accuracy: folds.reduce((s, f) => s + f.metrics.directional_accuracy, 0) / folds.length,
    forecast_bias: folds.reduce((s, f) => s + f.metrics.forecast_bias, 0) / folds.length,
    r_squared: folds.reduce((s, f) => s + f.metrics.r_squared, 0) / folds.length,
  };

  // Stability: coefficient of variation of MAPE across folds
  const mapes = folds.map(f => f.metrics.mape);
  const mapeMean = mapes.reduce((a, b) => a + b, 0) / mapes.length;
  const mapeStd = Math.sqrt(mapes.reduce((s, m) => s + (m - mapeMean) ** 2, 0) / mapes.length);
  const stability = mapeMean > 0 ? mapeStd / mapeMean : 0;

  return { folds, aggregated: agg, stability: Math.round(stability * 1000) / 1000 };
}
