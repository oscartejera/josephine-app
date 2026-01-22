
-- =============================================
-- CREATE HELPER FUNCTION FIRST
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =============================================
-- POS TABLES MIGRATION
-- =============================================

-- 1. Planos de sala por location
CREATE TABLE public.pos_floor_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Sala Principal',
  config_json JSONB NOT NULL DEFAULT '{"width": 800, "height": 600, "background": null}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Mesas definidas en cada plano
CREATE TABLE public.pos_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_map_id UUID NOT NULL REFERENCES public.pos_floor_maps(id) ON DELETE CASCADE,
  table_number TEXT NOT NULL,
  seats INT NOT NULL DEFAULT 4,
  position_x NUMERIC NOT NULL DEFAULT 0,
  position_y NUMERIC NOT NULL DEFAULT 0,
  shape TEXT NOT NULL DEFAULT 'square' CHECK (shape IN ('square', 'round', 'rectangle')),
  width NUMERIC NOT NULL DEFAULT 80,
  height NUMERIC NOT NULL DEFAULT 80,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved', 'blocked')),
  current_ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Grupos de modificadores por producto
CREATE TABLE public.pos_product_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  modifier_type TEXT NOT NULL DEFAULT 'single' CHECK (modifier_type IN ('single', 'multiple')),
  required BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Opciones dentro de cada grupo de modificadores
CREATE TABLE public.pos_modifier_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modifier_id UUID NOT NULL REFERENCES public.pos_product_modifiers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_delta NUMERIC DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Modificadores aplicados a líneas de ticket específicas
CREATE TABLE public.ticket_line_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_line_id UUID NOT NULL REFERENCES public.ticket_lines(id) ON DELETE CASCADE,
  modifier_name TEXT NOT NULL,
  option_name TEXT NOT NULL,
  price_delta NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Cola de impresión para cocina/barra
CREATE TABLE public.pos_print_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  destination TEXT NOT NULL CHECK (destination IN ('kitchen', 'bar', 'prep', 'receipt')),
  items_json JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'printed', 'acknowledged', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  printed_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ
);

-- 7. Sesiones de caja POS (para arqueos)
CREATE TABLE public.pos_cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  opened_by UUID NOT NULL REFERENCES auth.users(id),
  closed_by UUID REFERENCES auth.users(id),
  opening_cash NUMERIC NOT NULL DEFAULT 0,
  closing_cash NUMERIC,
  expected_cash NUMERIC,
  cash_difference NUMERIC,
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed'))
);

-- =============================================
-- ADD COLUMNS TO EXISTING TABLES
-- =============================================

-- Add POS-specific columns to tickets
ALTER TABLE public.tickets 
  ADD COLUMN IF NOT EXISTS pos_table_id UUID REFERENCES public.pos_tables(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS service_type TEXT DEFAULT 'dine_in',
  ADD COLUMN IF NOT EXISTS cash_session_id UUID REFERENCES public.pos_cash_sessions(id) ON DELETE SET NULL;

-- Add notes column to ticket_lines
ALTER TABLE public.ticket_lines
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS sent_to_kitchen BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_pos_floor_maps_location ON public.pos_floor_maps(location_id);
CREATE INDEX IF NOT EXISTS idx_pos_tables_floor_map ON public.pos_tables(floor_map_id);
CREATE INDEX IF NOT EXISTS idx_pos_tables_status ON public.pos_tables(status);
CREATE INDEX IF NOT EXISTS idx_pos_tables_current_ticket ON public.pos_tables(current_ticket_id);
CREATE INDEX IF NOT EXISTS idx_pos_product_modifiers_product ON public.pos_product_modifiers(product_id);
CREATE INDEX IF NOT EXISTS idx_pos_modifier_options_modifier ON public.pos_modifier_options(modifier_id);
CREATE INDEX IF NOT EXISTS idx_ticket_line_modifiers_line ON public.ticket_line_modifiers(ticket_line_id);
CREATE INDEX IF NOT EXISTS idx_pos_print_queue_location ON public.pos_print_queue(location_id);
CREATE INDEX IF NOT EXISTS idx_pos_print_queue_status ON public.pos_print_queue(status);
CREATE INDEX IF NOT EXISTS idx_tickets_pos_table ON public.tickets(pos_table_id);
CREATE INDEX IF NOT EXISTS idx_tickets_server ON public.tickets(server_id);
CREATE INDEX IF NOT EXISTS idx_pos_cash_sessions_location ON public.pos_cash_sessions(location_id);
CREATE INDEX IF NOT EXISTS idx_pos_cash_sessions_status ON public.pos_cash_sessions(status);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- Enable RLS on all new tables
ALTER TABLE public.pos_floor_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_product_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_modifier_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_line_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_print_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_cash_sessions ENABLE ROW LEVEL SECURITY;

-- pos_floor_maps policies
CREATE POLICY "Users can view floor maps in their group" ON public.pos_floor_maps
  FOR SELECT USING (
    location_id IN (SELECT public.get_user_accessible_locations())
  );

CREATE POLICY "Users can manage floor maps in their group" ON public.pos_floor_maps
  FOR ALL USING (
    location_id IN (SELECT public.get_user_accessible_locations())
  );

-- pos_tables policies
CREATE POLICY "Users can view tables in accessible locations" ON public.pos_tables
  FOR SELECT USING (
    floor_map_id IN (
      SELECT id FROM public.pos_floor_maps 
      WHERE location_id IN (SELECT public.get_user_accessible_locations())
    )
  );

CREATE POLICY "Users can manage tables in accessible locations" ON public.pos_tables
  FOR ALL USING (
    floor_map_id IN (
      SELECT id FROM public.pos_floor_maps 
      WHERE location_id IN (SELECT public.get_user_accessible_locations())
    )
  );

-- pos_product_modifiers policies
CREATE POLICY "Users can view modifiers in their group" ON public.pos_product_modifiers
  FOR SELECT USING (
    product_id IN (
      SELECT id FROM public.products 
      WHERE group_id = public.get_user_group_id()
    )
  );

CREATE POLICY "Users can manage modifiers in their group" ON public.pos_product_modifiers
  FOR ALL USING (
    product_id IN (
      SELECT id FROM public.products 
      WHERE group_id = public.get_user_group_id()
    )
  );

-- pos_modifier_options policies
CREATE POLICY "Users can view modifier options in their group" ON public.pos_modifier_options
  FOR SELECT USING (
    modifier_id IN (
      SELECT pm.id FROM public.pos_product_modifiers pm
      JOIN public.products p ON p.id = pm.product_id
      WHERE p.group_id = public.get_user_group_id()
    )
  );

CREATE POLICY "Users can manage modifier options in their group" ON public.pos_modifier_options
  FOR ALL USING (
    modifier_id IN (
      SELECT pm.id FROM public.pos_product_modifiers pm
      JOIN public.products p ON p.id = pm.product_id
      WHERE p.group_id = public.get_user_group_id()
    )
  );

-- ticket_line_modifiers policies
CREATE POLICY "Users can view line modifiers in their group" ON public.ticket_line_modifiers
  FOR SELECT USING (
    ticket_line_id IN (
      SELECT tl.id FROM public.ticket_lines tl
      JOIN public.tickets t ON t.id = tl.ticket_id
      JOIN public.locations l ON l.id = t.location_id
      WHERE l.group_id = public.get_user_group_id()
    )
  );

CREATE POLICY "Users can manage line modifiers in their group" ON public.ticket_line_modifiers
  FOR ALL USING (
    ticket_line_id IN (
      SELECT tl.id FROM public.ticket_lines tl
      JOIN public.tickets t ON t.id = tl.ticket_id
      JOIN public.locations l ON l.id = t.location_id
      WHERE l.group_id = public.get_user_group_id()
    )
  );

-- pos_print_queue policies
CREATE POLICY "Users can view print queue in accessible locations" ON public.pos_print_queue
  FOR SELECT USING (
    location_id IN (SELECT public.get_user_accessible_locations())
  );

CREATE POLICY "Users can manage print queue in accessible locations" ON public.pos_print_queue
  FOR ALL USING (
    location_id IN (SELECT public.get_user_accessible_locations())
  );

-- pos_cash_sessions policies
CREATE POLICY "Users can view cash sessions in accessible locations" ON public.pos_cash_sessions
  FOR SELECT USING (
    location_id IN (SELECT public.get_user_accessible_locations())
  );

CREATE POLICY "Users can manage cash sessions in accessible locations" ON public.pos_cash_sessions
  FOR ALL USING (
    location_id IN (SELECT public.get_user_accessible_locations())
  );

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================

CREATE TRIGGER update_pos_floor_maps_updated_at
  BEFORE UPDATE ON public.pos_floor_maps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pos_tables_updated_at
  BEFORE UPDATE ON public.pos_tables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- REALTIME FOR POS
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_tables;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_print_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_cash_sessions;

-- =============================================
-- HELPER FUNCTION: Update table status when ticket changes
-- =============================================

CREATE OR REPLACE FUNCTION public.sync_pos_table_status()
RETURNS TRIGGER AS $$
BEGIN
  -- When ticket is closed, free up the table
  IF NEW.status = 'closed' AND OLD.status IS DISTINCT FROM 'closed' AND NEW.pos_table_id IS NOT NULL THEN
    UPDATE public.pos_tables 
    SET status = 'available', current_ticket_id = NULL, updated_at = now()
    WHERE id = NEW.pos_table_id;
  END IF;
  
  -- When ticket is voided, also free up the table
  IF NEW.status = 'void' AND OLD.status IS DISTINCT FROM 'void' AND NEW.pos_table_id IS NOT NULL THEN
    UPDATE public.pos_tables 
    SET status = 'available', current_ticket_id = NULL, updated_at = now()
    WHERE id = NEW.pos_table_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER sync_table_on_ticket_close
  AFTER UPDATE ON public.tickets
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.sync_pos_table_status();
