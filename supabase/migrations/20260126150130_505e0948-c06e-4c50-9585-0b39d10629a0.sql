-- Create a new function that seeds sales data for EXISTING products (POS products)
-- This replaces the old function that created new products
CREATE OR REPLACE FUNCTION public.seed_sales_for_existing_products(p_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_location RECORD;
  v_product RECORD;
  v_day date;
  v_units numeric;
  v_price numeric;
  v_cogs_ratio numeric;
  v_sales_created int := 0;
BEGIN
  -- First, delete any existing sales data for this group's locations
  DELETE FROM public.product_sales_daily 
  WHERE location_id IN (SELECT id FROM public.locations WHERE group_id = p_group_id);
  
  -- Get locations for this group
  FOR v_location IN SELECT id FROM public.locations WHERE group_id = p_group_id
  LOOP
    -- Get all active products for this location
    FOR v_product IN 
      SELECT id, name, category, price 
      FROM public.products 
      WHERE location_id = v_location.id 
        AND is_active = true
    LOOP
      -- Determine COGS ratio by category
      v_cogs_ratio := CASE COALESCE(v_product.category, 'Otros')
        WHEN 'Bebidas' THEN 0.18 + random() * 0.10
        WHEN 'Entrantes' THEN 0.28 + random() * 0.10
        WHEN 'Principales' THEN 0.32 + random() * 0.13
        WHEN 'Postres' THEN 0.22 + random() * 0.10
        ELSE 0.28 + random() * 0.10
      END;
      
      -- Create 30 days of sales data
      FOR v_day IN SELECT generate_series(CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE - INTERVAL '1 day', '1 day')::date
      LOOP
        -- Skip some days randomly to create variation
        IF random() > 0.12 THEN
          -- Units sold varies by category
          v_units := CASE COALESCE(v_product.category, 'Otros')
            WHEN 'Bebidas' THEN 15 + floor(random() * 150)
            WHEN 'Entrantes' THEN 12 + floor(random() * 80)
            WHEN 'Principales' THEN 8 + floor(random() * 50)
            WHEN 'Postres' THEN 5 + floor(random() * 35)
            ELSE 8 + floor(random() * 45)
          END;
          
          -- Weekend boost
          IF EXTRACT(DOW FROM v_day) IN (0, 6) THEN
            v_units := v_units * (1.25 + random() * 0.35);
          END IF;
          
          -- Use actual product price if available, otherwise estimate
          v_price := COALESCE(v_product.price, CASE COALESCE(v_product.category, 'Otros')
            WHEN 'Bebidas' THEN 3 + random() * 7
            WHEN 'Entrantes' THEN 7 + random() * 10
            WHEN 'Principales' THEN 12 + random() * 18
            WHEN 'Postres' THEN 5 + random() * 7
            ELSE 8 + random() * 12
          END);
          
          -- Insert sales record
          INSERT INTO public.product_sales_daily (
            date,
            location_id,
            product_id,
            units_sold,
            net_sales,
            cogs
          ) VALUES (
            v_day,
            v_location.id,
            v_product.id,
            v_units,
            v_units * v_price,
            v_units * v_price * v_cogs_ratio
          );
          
          v_sales_created := v_sales_created + 1;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Created % sales records for existing products', v_sales_created;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.seed_sales_for_existing_products(uuid) TO authenticated;