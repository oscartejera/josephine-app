-- Drop existing tables if they were partially created
DROP TABLE IF EXISTS public.stock_count_lines CASCADE;
DROP TABLE IF EXISTS public.stock_counts CASCADE;

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- STOCK COUNTS TABLES FOR INVENTORY RECONCILIATION

-- Stock counts (periodic inventory counts per location)
CREATE TABLE public.stock_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('counted', 'uncounted', 'in_progress')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stock count lines (individual item counts)
CREATE TABLE public.stock_count_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_count_id UUID NOT NULL REFERENCES public.stock_counts(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  opening_qty NUMERIC(12,3) DEFAULT 0,
  deliveries_qty NUMERIC(12,3) DEFAULT 0,
  transfers_net_qty NUMERIC(12,3) DEFAULT 0,
  closing_qty NUMERIC(12,3) DEFAULT 0,
  used_qty NUMERIC(12,3) DEFAULT 0,
  sales_qty NUMERIC(12,3) DEFAULT 0,
  variance_qty NUMERIC(12,3) DEFAULT 0,
  batch_balance NUMERIC(12,3) DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_count_lines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stock_counts
CREATE POLICY "Managers can manage stock counts"
ON public.stock_counts
FOR ALL
USING (is_admin_or_ops() AND location_id IN (SELECT get_accessible_location_ids()));

CREATE POLICY "Users can view stock counts"
ON public.stock_counts
FOR SELECT
USING (location_id IN (SELECT get_accessible_location_ids()));

-- RLS Policies for stock_count_lines
CREATE POLICY "Managers can manage stock count lines"
ON public.stock_count_lines
FOR ALL
USING (is_admin_or_ops() AND stock_count_id IN (
  SELECT id FROM public.stock_counts 
  WHERE location_id IN (SELECT get_accessible_location_ids())
));

CREATE POLICY "Users can view stock count lines"
ON public.stock_count_lines
FOR SELECT
USING (stock_count_id IN (
  SELECT id FROM public.stock_counts 
  WHERE location_id IN (SELECT get_accessible_location_ids())
));

-- Triggers for updated_at
CREATE TRIGGER update_stock_counts_updated_at
  BEFORE UPDATE ON public.stock_counts
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE TRIGGER update_stock_count_lines_updated_at
  BEFORE UPDATE ON public.stock_count_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

-- Add category column to inventory_items for breakdown charts
ALTER TABLE public.inventory_items 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'food';