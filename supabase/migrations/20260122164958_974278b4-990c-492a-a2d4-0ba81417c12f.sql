-- Drop the legacy forecasts table (now replaced by forecast_daily_metrics with LR+SI v3 model)
DROP TABLE IF EXISTS public.forecasts;