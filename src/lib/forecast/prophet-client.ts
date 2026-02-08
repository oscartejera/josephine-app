/**
 * Prophet API Client
 * Supports v4 (Supabase Edge Function) and v5 (Real Python Prophet ML)
 * Note: This is for browser context - use environment variables
 */

export interface ProphetForecastRequest {
  historical: { ds: string; y: number }[]; // Date + value
  periods: number; // Number of periods to forecast
  freq: string; // '15min', '30min', 'H', 'D'
  seasonality: {
    daily?: boolean;
    weekly?: boolean;
    yearly?: boolean;
  };
}

export interface ProphetForecastResponse {
  forecast: {
    ds: string;
    yhat: number;
    yhat_lower: number;
    yhat_upper: number;
  }[];
  model_version: string;
}

// ── V5 Real Prophet ML Types ─────────────────────────────────────────────────

export interface ProphetV5Metrics {
  mape: string;
  rmse: string;
  mae: string;
  r_squared: string;
}

export interface ProphetV5LocationResult {
  location_id: string;
  location_name: string;
  model: string;
  engine: string;
  forecasts_generated: number;
  data_points: number;
  metrics: ProphetV5Metrics;
  confidence: number;
  changepoints: number;
  components: Record<string, unknown>;
  sample_forecast: {
    date: string;
    forecast: number;
    lower: number;
    upper: number;
    explanation: string;
  }[];
  error?: string;
}

export interface ProphetV5Response {
  success: boolean;
  version: string;
  engine: string;
  features: string[];
  horizon_days: number;
  locations_processed: number;
  results: ProphetV5LocationResult[];
}

export class ProphetClient {
  private apiUrl: string;
  private apiKey: string | null;

  constructor(apiUrl?: string, apiKey?: string | null) {
    // Use environment variables for browser context
    this.apiUrl = apiUrl || import.meta.env.VITE_PROPHET_API_URL || 'https://your-modal-app.modal.run/forecast';
    this.apiKey = apiKey || import.meta.env.VITE_PROPHET_API_KEY || null;
  }

  async forecast(request: ProphetForecastRequest): Promise<ProphetForecastResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Prophet API error (${response.status}): ${error}`);
    }

    return response.json();
  }
}

/**
 * Mock Prophet Client for development
 */
export class MockProphetClient {
  async forecast(request: ProphetForecastRequest): Promise<ProphetForecastResponse> {
    console.log('[Mock Prophet] Generating forecast for', request.periods, 'periods');

    // Generate mock forecast based on historical mean + trend
    const historical = request.historical;
    const mean = historical.reduce((sum, p) => sum + p.y, 0) / historical.length;
    const trend = this.calculateTrend(historical);

    const forecast = [];
    const lastDate = new Date(historical[historical.length - 1].ds);

    for (let i = 1; i <= request.periods; i++) {
      const forecastDate = this.addPeriod(lastDate, i, request.freq);
      const seasonal = this.getSeasonalFactor(forecastDate, request.freq);
      const noise = (Math.random() - 0.5) * mean * 0.1; // 10% random variation
      
      const yhat = mean + trend * i + seasonal + noise;
      const uncertainty = mean * 0.15; // 15% uncertainty

      forecast.push({
        ds: forecastDate.toISOString(),
        yhat,
        yhat_lower: yhat - uncertainty,
        yhat_upper: yhat + uncertainty,
      });
    }

    return {
      forecast,
      model_version: 'mock_v1',
    };
  }

  private calculateTrend(data: { ds: string; y: number }[]): number {
    if (data.length < 2) return 0;
    
    const recent = data.slice(-7);
    const older = data.slice(-14, -7);
    
    const recentAvg = recent.reduce((sum, p) => sum + p.y, 0) / recent.length;
    const olderAvg = older.reduce((sum, p) => sum + p.y, 0) / older.length;
    
    return (recentAvg - olderAvg) / 7; // Trend per period
  }

  private getSeasonalFactor(date: Date, freq: string): number {
    const hour = date.getHours();
    const dayOfWeek = date.getDay();

    // Simple seasonal adjustments
    let factor = 0;

    // Hour of day seasonality
    if (hour >= 12 && hour <= 14) factor += 20; // Lunch boost
    if (hour >= 20 && hour <= 22) factor += 30; // Dinner boost

    // Day of week
    if (dayOfWeek === 5 || dayOfWeek === 6) factor += 15; // Weekend boost

    return factor;
  }

  private addPeriod(date: Date, count: number, freq: string): Date {
    const newDate = new Date(date);
    
    switch (freq) {
      case '15min':
        newDate.setMinutes(newDate.getMinutes() + count * 15);
        break;
      case '30min':
        newDate.setMinutes(newDate.getMinutes() + count * 30);
        break;
      case 'H':
        newDate.setHours(newDate.getHours() + count);
        break;
      case 'D':
        newDate.setDate(newDate.getDate() + count);
        break;
    }

    return newDate;
  }
}
