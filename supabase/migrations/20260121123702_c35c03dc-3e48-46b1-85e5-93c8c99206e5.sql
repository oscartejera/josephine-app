-- Create products table
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  name text NOT NULL,
  category text,
  is_active boolean DEFAULT true,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Create product_sales_daily table
CREATE TABLE public.product_sales_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  units_sold numeric NOT NULL DEFAULT 0,
  net_sales numeric NOT NULL DEFAULT 0,
  cogs numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_product_sales_daily_date_location ON public.product_sales_daily(date, location_id);
CREATE INDEX idx_product_sales_daily_product_date ON public.product_sales_daily(product_id, date);
CREATE INDEX idx_products_group_id ON public.products(group_id);
CREATE INDEX idx_products_location_id ON public.products(location_id);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_sales_daily ENABLE ROW LEVEL SECURITY;

-- RLS for products
CREATE POLICY "Users can view products in their group"
ON public.products FOR SELECT
USING (group_id = get_user_group_id());

CREATE POLICY "Managers can manage products"
ON public.products FOR ALL
USING (is_admin_or_ops() AND group_id = get_user_group_id());

-- RLS for product_sales_daily
CREATE POLICY "Users can view product sales in accessible locations"
ON public.product_sales_daily FOR SELECT
USING (location_id IN (SELECT get_accessible_location_ids()));

CREATE POLICY "Managers can manage product sales"
ON public.product_sales_daily FOR ALL
USING (is_admin_or_ops() AND location_id IN (SELECT get_accessible_location_ids()));

-- Seed demo products and sales RPC
CREATE OR REPLACE FUNCTION public.seed_demo_products_and_sales(p_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_location RECORD;
  v_product_id uuid;
  v_category text;
  v_categories text[] := ARRAY['Bebidas', 'Entrantes', 'Principales', 'Postres'];
  v_product_names jsonb := '{
    "Bebidas": ["Agua mineral", "Coca-Cola", "Fanta Naranja", "Cerveza Mahou", "Cerveza Estrella", "Vino Tinto Rioja", "Vino Blanco Rueda", "Sangría", "Café Solo", "Café con Leche", "Té Verde", "Zumo Naranja", "Limonada", "Mojito", "Gin Tonic"],
    "Entrantes": ["Patatas Bravas", "Croquetas Jamón", "Gambas al Ajillo", "Tortilla Española", "Pan con Tomate", "Jamón Ibérico", "Queso Manchego", "Ensalada Mixta", "Gazpacho", "Pimientos Padrón", "Boquerones Fritos", "Calamares a la Romana", "Aceitunas", "Hummus", "Nachos con Guacamole"],
    "Principales": ["Paella Valenciana", "Pulpo a la Gallega", "Lubina a la Sal", "Entrecot Gallego", "Solomillo Ibérico", "Cochinillo Asado", "Cordero Lechal", "Hamburguesa Gourmet", "Pizza Margherita", "Pizza Cuatro Quesos", "Risotto Setas", "Pasta Carbonara", "Merluza Vasca", "Bacalao Pil-Pil", "Secreto Ibérico"],
    "Postres": ["Tarta de Queso", "Crema Catalana", "Flan Casero", "Brownie Chocolate", "Tiramisú", "Helado Artesanal", "Coulant Chocolate", "Natillas", "Arroz con Leche", "Tarta Santiago"]
  }'::jsonb;
  v_names text[];
  v_name text;
  v_day date;
  v_units numeric;
  v_price numeric;
  v_cogs_ratio numeric;
  v_products_created int := 0;
BEGIN
  -- Get locations for this group
  FOR v_location IN SELECT id FROM public.locations WHERE group_id = p_group_id
  LOOP
    -- Create products for each category
    FOREACH v_category IN ARRAY v_categories
    LOOP
      -- Get product names for this category
      SELECT ARRAY(SELECT jsonb_array_elements_text(v_product_names->v_category)) INTO v_names;
      
      FOREACH v_name IN ARRAY v_names
      LOOP
        -- Insert product (may already exist globally, but we create per location for variety)
        INSERT INTO public.products (name, category, location_id, group_id, is_active)
        VALUES (v_name, v_category, v_location.id, p_group_id, true)
        RETURNING id INTO v_product_id;
        
        v_products_created := v_products_created + 1;
        
        -- Determine COGS ratio by category
        v_cogs_ratio := CASE v_category
          WHEN 'Bebidas' THEN 0.18 + random() * 0.10
          WHEN 'Entrantes' THEN 0.28 + random() * 0.10
          WHEN 'Principales' THEN 0.32 + random() * 0.13
          WHEN 'Postres' THEN 0.22 + random() * 0.10
          ELSE 0.30
        END;
        
        -- Create 30 days of sales data
        FOR v_day IN SELECT generate_series(CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE - INTERVAL '1 day', '1 day')::date
        LOOP
          -- Skip some days randomly to create variation
          IF random() > 0.15 THEN
            -- Units sold varies by category
            v_units := CASE v_category
              WHEN 'Bebidas' THEN 20 + floor(random() * 180)
              WHEN 'Entrantes' THEN 15 + floor(random() * 100)
              WHEN 'Principales' THEN 10 + floor(random() * 60)
              WHEN 'Postres' THEN 5 + floor(random() * 40)
              ELSE 10 + floor(random() * 50)
            END;
            
            -- Weekend boost
            IF EXTRACT(DOW FROM v_day) IN (0, 6) THEN
              v_units := v_units * (1.2 + random() * 0.3);
            END IF;
            
            -- Price varies by category
            v_price := CASE v_category
              WHEN 'Bebidas' THEN 2.5 + random() * 8
              WHEN 'Entrantes' THEN 6 + random() * 10
              WHEN 'Principales' THEN 12 + random() * 18
              WHEN 'Postres' THEN 5 + random() * 6
              ELSE 8 + random() * 10
            END;
            
            INSERT INTO public.product_sales_daily (date, location_id, product_id, units_sold, net_sales, cogs)
            VALUES (
              v_day,
              v_location.id,
              v_product_id,
              v_units,
              ROUND((v_units * v_price)::numeric, 2),
              ROUND((v_units * v_price * v_cogs_ratio)::numeric, 2)
            );
          END IF;
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;
END;
$$;

-- Get top products RPC
CREATE OR REPLACE FUNCTION public.get_top_products(
  p_location_id uuid DEFAULT NULL,
  p_date_from date DEFAULT (CURRENT_DATE - INTERVAL '7 days')::date,
  p_date_to date DEFAULT CURRENT_DATE,
  p_order_by text DEFAULT 'share'
)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  category text,
  units numeric,
  sales numeric,
  sales_share_pct numeric,
  cogs numeric,
  gp numeric,
  gp_pct numeric,
  badge_label text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_sales numeric;
  v_group_id uuid;
BEGIN
  -- Get user's group_id
  v_group_id := get_user_group_id();
  
  -- Calculate total sales for the period
  SELECT COALESCE(SUM(psd.net_sales), 0)
  INTO v_total_sales
  FROM public.product_sales_daily psd
  JOIN public.locations l ON l.id = psd.location_id
  WHERE l.group_id = v_group_id
    AND psd.date >= p_date_from
    AND psd.date <= p_date_to
    AND (p_location_id IS NULL OR psd.location_id = p_location_id);
  
  -- If no sales, return empty
  IF v_total_sales = 0 THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  WITH aggregated AS (
    SELECT
      p.id AS product_id,
      p.name AS product_name,
      p.category,
      SUM(psd.units_sold) AS units,
      SUM(psd.net_sales) AS sales,
      SUM(psd.cogs) AS cogs
    FROM public.product_sales_daily psd
    JOIN public.products p ON p.id = psd.product_id
    JOIN public.locations l ON l.id = psd.location_id
    WHERE l.group_id = v_group_id
      AND psd.date >= p_date_from
      AND psd.date <= p_date_to
      AND (p_location_id IS NULL OR psd.location_id = p_location_id)
    GROUP BY p.id, p.name, p.category
  ),
  calculated AS (
    SELECT
      a.product_id,
      a.product_name,
      a.category,
      a.units,
      a.sales,
      CASE WHEN v_total_sales > 0 THEN ROUND((a.sales / v_total_sales) * 100, 2) ELSE 0 END AS sales_share_pct,
      a.cogs,
      ROUND(a.sales - a.cogs, 2) AS gp,
      CASE WHEN a.sales > 0 THEN ROUND(((a.sales - a.cogs) / a.sales) * 100, 1) ELSE 0 END AS gp_pct
    FROM aggregated a
  )
  SELECT
    c.product_id,
    c.product_name,
    c.category,
    c.units,
    c.sales,
    c.sales_share_pct,
    c.cogs,
    c.gp,
    c.gp_pct,
    CASE 
      WHEN c.sales_share_pct >= 8 AND c.gp_pct <= 25 
      THEN 'High share / Low margin'
      ELSE NULL
    END AS badge_label
  FROM calculated c
  ORDER BY
    CASE p_order_by
      WHEN 'gp_eur' THEN c.gp
      WHEN 'gp_pct' THEN c.gp_pct
      ELSE c.sales_share_pct
    END DESC,
    c.sales DESC
  LIMIT 10;
END;
$$;