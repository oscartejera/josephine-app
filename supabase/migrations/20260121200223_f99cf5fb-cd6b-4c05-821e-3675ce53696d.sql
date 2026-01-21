-- =============================================
-- WASTE MODULE - CLEAN REBUILD
-- =============================================

-- 1. Create waste_items table (items that can be wasted)
CREATE TABLE IF NOT EXISTS public.waste_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('ingredient', 'product')),
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  ingredient_category text CHECK (ingredient_category IN ('Frozen', 'Dairy', 'Sauce', 'Fresh', 'Dry', 'Meat', 'Fish', 'Veg', 'Other')),
  unit text DEFAULT 'kg',
  is_active boolean DEFAULT true,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- 2. Create waste_logs table (each waste event)
CREATE TABLE IF NOT EXISTS public.waste_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  item_id uuid NOT NULL REFERENCES public.waste_items(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('broken', 'end_of_day', 'expired', 'theft', 'other')),
  quantity numeric NOT NULL DEFAULT 1,
  value numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_waste_logs_date_location ON public.waste_logs(date, location_id);
CREATE INDEX IF NOT EXISTS idx_waste_logs_reason_date ON public.waste_logs(reason, date);
CREATE INDEX IF NOT EXISTS idx_waste_logs_item_date ON public.waste_logs(item_id, date);
CREATE INDEX IF NOT EXISTS idx_waste_logs_user_date ON public.waste_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_waste_items_group ON public.waste_items(group_id);
CREATE INDEX IF NOT EXISTS idx_waste_items_category ON public.waste_items(ingredient_category);

-- 4. Enable RLS
ALTER TABLE public.waste_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waste_logs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for waste_items
CREATE POLICY "Users can view waste items in their group"
  ON public.waste_items FOR SELECT
  USING (group_id = get_user_group_id());

CREATE POLICY "Managers can manage waste items"
  ON public.waste_items FOR ALL
  USING (group_id = get_user_group_id() AND is_admin_or_ops());

-- 6. RLS Policies for waste_logs
CREATE POLICY "Users can view waste logs for accessible locations"
  ON public.waste_logs FOR SELECT
  USING (location_id IN (SELECT get_accessible_location_ids()));

CREATE POLICY "Users can insert waste logs for accessible locations"
  ON public.waste_logs FOR INSERT
  WITH CHECK (location_id IN (SELECT get_accessible_location_ids()));

CREATE POLICY "Managers can manage waste logs"
  ON public.waste_logs FOR ALL
  USING (location_id IN (SELECT get_accessible_location_ids()) AND is_admin_or_ops());

-- 7. Enable realtime for waste_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.waste_logs;