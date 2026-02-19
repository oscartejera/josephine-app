
-- ENUMS (idempotent: skip if already exists)
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('owner_admin', 'ops_manager', 'location_manager', 'viewer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.pos_provider AS ENUM ('revo', 'glop', 'square', 'lightspeed', 'csv'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.pos_status AS ENUM ('connected', 'disconnected', 'error', 'syncing'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.ticket_status AS ENUM ('open', 'closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.ticket_channel AS ENUM ('dinein', 'takeaway', 'delivery', 'unknown'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payment_method AS ENUM ('card', 'cash', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.po_status AS ENUM ('draft', 'sent', 'received'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CORE TABLES
CREATE TABLE IF NOT EXISTS public.orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  city TEXT,
  timezone TEXT DEFAULT 'Europe/Madrid',
  currency TEXT DEFAULT 'EUR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.orgs(id) ON DELETE SET NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.user_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, location_id)
);

-- POS TABLES
CREATE TABLE IF NOT EXISTS public.pos_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  provider public.pos_provider NOT NULL,
  status public.pos_status DEFAULT 'disconnected',
  last_sync_at TIMESTAMPTZ,
  config_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  external_id TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  status public.ticket_status DEFAULT 'open',
  covers INT,
  table_name TEXT,
  channel public.ticket_channel DEFAULT 'unknown',
  gross_total NUMERIC(12,2) DEFAULT 0,
  net_total NUMERIC(12,2) DEFAULT 0,
  tax_total NUMERIC(12,2) DEFAULT 0,
  discount_total NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ticket_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  external_line_id TEXT,
  item_external_id TEXT,
  item_name TEXT NOT NULL,
  category_name TEXT,
  quantity NUMERIC(10,3) DEFAULT 1,
  unit_price NUMERIC(10,2) DEFAULT 0,
  gross_line_total NUMERIC(12,2) DEFAULT 0,
  discount_line_total NUMERIC(12,2) DEFAULT 0,
  tax_rate NUMERIC(5,2),
  voided BOOLEAN DEFAULT false,
  comped BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  method public.payment_method DEFAULT 'card',
  amount NUMERIC(12,2) NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- LABOR TABLES
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  external_id TEXT,
  full_name TEXT NOT NULL,
  role_name TEXT,
  hourly_cost NUMERIC(8,2),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  minutes INT,
  labor_cost NUMERIC(10,2),
  approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- INVENTORY & PROCUREMENT TABLES
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT DEFAULT 'kg',
  par_level NUMERIC(10,3),
  current_stock NUMERIC(10,3) DEFAULT 0,
  last_cost NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  menu_item_name TEXT NOT NULL,
  selling_price NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  quantity NUMERIC(10,3) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  status public.po_status DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  quantity NUMERIC(10,3) NOT NULL,
  unit_cost NUMERIC(10,2)
);

CREATE TABLE IF NOT EXISTS public.waste_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  quantity NUMERIC(10,3) NOT NULL,
  reason TEXT,
  waste_value NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FORECAST TABLE
CREATE TABLE IF NOT EXISTS public.forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  forecast_date DATE NOT NULL,
  hour INT NOT NULL CHECK (hour >= 0 AND hour <= 23),
  forecast_sales NUMERIC(12,2) DEFAULT 0,
  forecast_covers INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, forecast_date, hour)
);

-- SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.location_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE UNIQUE,
  target_gp_percent NUMERIC(5,2) DEFAULT 70,
  target_col_percent NUMERIC(5,2) DEFAULT 25,
  default_cogs_percent NUMERIC(5,2) DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- INDEXES (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_locations_group ON public.locations(group_id);
CREATE INDEX IF NOT EXISTS idx_profiles_group ON public.profiles(group_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_user ON public.user_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_location ON public.tickets(location_id);
CREATE INDEX IF NOT EXISTS idx_tickets_closed_at ON public.tickets(closed_at);
CREATE INDEX IF NOT EXISTS idx_ticket_lines_ticket ON public.ticket_lines(ticket_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_location ON public.timesheets(location_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_employee ON public.timesheets(employee_id);
CREATE INDEX IF NOT EXISTS idx_forecasts_location_date ON public.forecasts(location_id, forecast_date);

-- SECURITY DEFINER FUNCTIONS
CREATE OR REPLACE FUNCTION public.get_user_group_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT group_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.has_role(_role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_ops()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('owner_admin', 'ops_manager')
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_location(_location_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_locations
    WHERE user_id = auth.uid() AND location_id = _location_id
  ) OR public.is_admin_or_ops()
$$;

CREATE OR REPLACE FUNCTION public.get_accessible_location_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id FROM public.locations l
  WHERE l.group_id = public.get_user_group_id()
    AND (
      public.is_admin_or_ops()
      OR EXISTS (
        SELECT 1 FROM public.user_locations ul
        WHERE ul.user_id = auth.uid() AND ul.location_id = l.id
      )
    )
$$;

-- ENABLE RLS ON ALL TABLES (safe to re-run)
ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waste_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_settings ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES (drop if exists + create for idempotency)

-- Groups
DROP POLICY IF EXISTS "Users can view own group" ON public.orgs;
CREATE POLICY "Users can view own group" ON public.orgs
  FOR SELECT USING (id = public.get_user_group_id());

-- Locations
DROP POLICY IF EXISTS "Users can view accessible locations" ON public.locations;
CREATE POLICY "Users can view accessible locations" ON public.locations
  FOR SELECT USING (id IN (SELECT public.get_accessible_location_ids()));

DROP POLICY IF EXISTS "Admins can manage locations" ON public.locations;
CREATE POLICY "Admins can manage locations" ON public.locations
  FOR ALL USING (group_id = public.get_user_group_id() AND public.has_role('owner_admin'));

-- Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- User roles
DROP POLICY IF EXISTS "Admins can view roles" ON public.user_roles;
CREATE POLICY "Admins can view roles" ON public.user_roles
  FOR SELECT USING (public.has_role('owner_admin') OR user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role('owner_admin'));

-- User locations
DROP POLICY IF EXISTS "Users can view own locations" ON public.user_locations;
CREATE POLICY "Users can view own locations" ON public.user_locations
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin_or_ops());

DROP POLICY IF EXISTS "Admins can manage user locations" ON public.user_locations;
CREATE POLICY "Admins can manage user locations" ON public.user_locations
  FOR ALL USING (public.has_role('owner_admin'));

-- POS connections
DROP POLICY IF EXISTS "Users can view pos connections" ON public.pos_connections;
CREATE POLICY "Users can view pos connections" ON public.pos_connections
  FOR SELECT USING (location_id IN (SELECT public.get_accessible_location_ids()));

DROP POLICY IF EXISTS "Admins can manage pos connections" ON public.pos_connections;
CREATE POLICY "Admins can manage pos connections" ON public.pos_connections
  FOR ALL USING (public.is_admin_or_ops() AND location_id IN (SELECT public.get_accessible_location_ids()));

-- Tickets
DROP POLICY IF EXISTS "Users can view tickets" ON public.tickets;
CREATE POLICY "Users can view tickets" ON public.tickets
  FOR SELECT USING (location_id IN (SELECT public.get_accessible_location_ids()));

DROP POLICY IF EXISTS "System can insert tickets" ON public.tickets;
CREATE POLICY "System can insert tickets" ON public.tickets
  FOR INSERT WITH CHECK (location_id IN (SELECT public.get_accessible_location_ids()));

-- Ticket lines
DROP POLICY IF EXISTS "Users can view ticket lines" ON public.ticket_lines;
CREATE POLICY "Users can view ticket lines" ON public.ticket_lines
  FOR SELECT USING (ticket_id IN (SELECT id FROM public.tickets WHERE location_id IN (SELECT public.get_accessible_location_ids())));

DROP POLICY IF EXISTS "System can insert ticket lines" ON public.ticket_lines;
CREATE POLICY "System can insert ticket lines" ON public.ticket_lines
  FOR INSERT WITH CHECK (ticket_id IN (SELECT id FROM public.tickets WHERE location_id IN (SELECT public.get_accessible_location_ids())));

-- Payments
DROP POLICY IF EXISTS "Users can view payments" ON public.payments;
CREATE POLICY "Users can view payments" ON public.payments
  FOR SELECT USING (ticket_id IN (SELECT id FROM public.tickets WHERE location_id IN (SELECT public.get_accessible_location_ids())));

DROP POLICY IF EXISTS "System can insert payments" ON public.payments;
CREATE POLICY "System can insert payments" ON public.payments
  FOR INSERT WITH CHECK (ticket_id IN (SELECT id FROM public.tickets WHERE location_id IN (SELECT public.get_accessible_location_ids())));

-- Employees
DROP POLICY IF EXISTS "Users can view employees" ON public.employees;
CREATE POLICY "Users can view employees" ON public.employees
  FOR SELECT USING (location_id IN (SELECT public.get_accessible_location_ids()));

DROP POLICY IF EXISTS "Managers can manage employees" ON public.employees;
CREATE POLICY "Managers can manage employees" ON public.employees
  FOR ALL USING (public.is_admin_or_ops() AND location_id IN (SELECT public.get_accessible_location_ids()));

-- Timesheets
DROP POLICY IF EXISTS "Users can view timesheets" ON public.timesheets;
CREATE POLICY "Users can view timesheets" ON public.timesheets
  FOR SELECT USING (location_id IN (SELECT public.get_accessible_location_ids()));

DROP POLICY IF EXISTS "Managers can manage timesheets" ON public.timesheets;
CREATE POLICY "Managers can manage timesheets" ON public.timesheets
  FOR ALL USING (public.is_admin_or_ops() AND location_id IN (SELECT public.get_accessible_location_ids()));

-- Suppliers
DROP POLICY IF EXISTS "Users can view suppliers" ON public.suppliers;
CREATE POLICY "Users can view suppliers" ON public.suppliers
  FOR SELECT USING (group_id = public.get_user_group_id());

DROP POLICY IF EXISTS "Admins can manage suppliers" ON public.suppliers;
CREATE POLICY "Admins can manage suppliers" ON public.suppliers
  FOR ALL USING (public.is_admin_or_ops() AND group_id = public.get_user_group_id());

-- Inventory items
DROP POLICY IF EXISTS "Users can view inventory" ON public.inventory_items;
CREATE POLICY "Users can view inventory" ON public.inventory_items
  FOR SELECT USING (group_id = public.get_user_group_id());

DROP POLICY IF EXISTS "Managers can manage inventory" ON public.inventory_items;
CREATE POLICY "Managers can manage inventory" ON public.inventory_items
  FOR ALL USING (public.is_admin_or_ops() AND group_id = public.get_user_group_id());

-- Recipes
DROP POLICY IF EXISTS "Users can view recipes" ON public.recipes;
CREATE POLICY "Users can view recipes" ON public.recipes
  FOR SELECT USING (group_id = public.get_user_group_id());

DROP POLICY IF EXISTS "Managers can manage recipes" ON public.recipes;
CREATE POLICY "Managers can manage recipes" ON public.recipes
  FOR ALL USING (public.is_admin_or_ops() AND group_id = public.get_user_group_id());

-- Recipe ingredients
DROP POLICY IF EXISTS "Users can view recipe ingredients" ON public.recipe_ingredients;
CREATE POLICY "Users can view recipe ingredients" ON public.recipe_ingredients
  FOR SELECT USING (recipe_id IN (SELECT id FROM public.recipes WHERE group_id = public.get_user_group_id()));

DROP POLICY IF EXISTS "Managers can manage recipe ingredients" ON public.recipe_ingredients;
CREATE POLICY "Managers can manage recipe ingredients" ON public.recipe_ingredients
  FOR ALL USING (public.is_admin_or_ops());

-- Purchase orders
DROP POLICY IF EXISTS "Users can view purchase orders" ON public.purchase_orders;
CREATE POLICY "Users can view purchase orders" ON public.purchase_orders
  FOR SELECT USING (group_id = public.get_user_group_id());

DROP POLICY IF EXISTS "Managers can manage purchase orders" ON public.purchase_orders;
CREATE POLICY "Managers can manage purchase orders" ON public.purchase_orders
  FOR ALL USING (public.is_admin_or_ops() AND group_id = public.get_user_group_id());

-- Purchase order lines
DROP POLICY IF EXISTS "Users can view po lines" ON public.purchase_order_lines;
CREATE POLICY "Users can view po lines" ON public.purchase_order_lines
  FOR SELECT USING (purchase_order_id IN (SELECT id FROM public.purchase_orders WHERE group_id = public.get_user_group_id()));

DROP POLICY IF EXISTS "Managers can manage po lines" ON public.purchase_order_lines;
CREATE POLICY "Managers can manage po lines" ON public.purchase_order_lines
  FOR ALL USING (public.is_admin_or_ops());

-- Waste events
DROP POLICY IF EXISTS "Users can view waste events" ON public.waste_events;
CREATE POLICY "Users can view waste events" ON public.waste_events
  FOR SELECT USING (location_id IN (SELECT public.get_accessible_location_ids()));

DROP POLICY IF EXISTS "Managers can manage waste events" ON public.waste_events;
CREATE POLICY "Managers can manage waste events" ON public.waste_events
  FOR ALL USING (public.is_admin_or_ops() AND location_id IN (SELECT public.get_accessible_location_ids()));

-- Forecasts
DROP POLICY IF EXISTS "Users can view forecasts" ON public.forecasts;
CREATE POLICY "Users can view forecasts" ON public.forecasts
  FOR SELECT USING (location_id IN (SELECT public.get_accessible_location_ids()));

DROP POLICY IF EXISTS "Managers can manage forecasts" ON public.forecasts;
CREATE POLICY "Managers can manage forecasts" ON public.forecasts
  FOR ALL USING (public.is_admin_or_ops() AND location_id IN (SELECT public.get_accessible_location_ids()));

-- Location settings
DROP POLICY IF EXISTS "Users can view location settings" ON public.location_settings;
CREATE POLICY "Users can view location settings" ON public.location_settings
  FOR SELECT USING (location_id IN (SELECT public.get_accessible_location_ids()));

DROP POLICY IF EXISTS "Admins can manage location settings" ON public.location_settings;
CREATE POLICY "Admins can manage location settings" ON public.location_settings
  FOR ALL USING (public.has_role('owner_admin') AND location_id IN (SELECT public.get_accessible_location_ids()));

-- TRIGGER FOR NEW USER PROFILE
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
