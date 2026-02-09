-- =============================================================
-- Add Schedule Settings columns to location_settings
-- These power the Nory-style AI scheduler configuration
-- =============================================================

-- Venue Profile
ALTER TABLE public.location_settings ADD COLUMN IF NOT EXISTS tables_count INTEGER DEFAULT 30;
ALTER TABLE public.location_settings ADD COLUMN IF NOT EXISTS service_type TEXT DEFAULT 'casual_dining';

-- Operating Hours & Day Parts
ALTER TABLE public.location_settings ADD COLUMN IF NOT EXISTS opening_time TIME DEFAULT '09:00';
ALTER TABLE public.location_settings ADD COLUMN IF NOT EXISTS closing_time TIME DEFAULT '01:00';
ALTER TABLE public.location_settings ADD COLUMN IF NOT EXISTS closed_days INTEGER[] DEFAULT '{}';
ALTER TABLE public.location_settings ADD COLUMN IF NOT EXISTS day_parts JSONB DEFAULT '[
  {"name":"Prep","start":"09:00","end":"11:00"},
  {"name":"Comida","start":"12:00","end":"16:00"},
  {"name":"Transicion","start":"16:00","end":"18:00"},
  {"name":"Cena","start":"19:00","end":"23:00"},
  {"name":"Cierre","start":"23:00","end":"01:00"}
]';

-- Labor Goals
ALTER TABLE public.location_settings ADD COLUMN IF NOT EXISTS splh_goal NUMERIC DEFAULT 50;
ALTER TABLE public.location_settings ADD COLUMN IF NOT EXISTS average_check_size NUMERIC DEFAULT 25;

-- Staffing Rules
ALTER TABLE public.location_settings ADD COLUMN IF NOT EXISTS min_rest_hours NUMERIC DEFAULT 10;
ALTER TABLE public.location_settings ADD COLUMN IF NOT EXISTS max_hours_per_day NUMERIC DEFAULT 10;
ALTER TABLE public.location_settings ADD COLUMN IF NOT EXISTS staffing_ratios JSONB DEFAULT '{
  "Chef": 12,
  "Server": 16,
  "Bartender": 25,
  "Host": 40,
  "Manager": 999
}';

-- Hourly Demand Curve (% of daily sales per hour)
ALTER TABLE public.location_settings ADD COLUMN IF NOT EXISTS hourly_demand_curve JSONB DEFAULT '{
  "9": 0.01, "10": 0.02, "11": 0.04, "12": 0.07,
  "13": 0.14, "14": 0.15, "15": 0.08, "16": 0.03,
  "17": 0.03, "18": 0.04, "19": 0.05, "20": 0.10,
  "21": 0.12, "22": 0.09, "23": 0.03
}';
