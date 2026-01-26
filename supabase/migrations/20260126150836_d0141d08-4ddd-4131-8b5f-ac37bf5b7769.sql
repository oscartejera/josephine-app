-- Create function to seed waste events using existing inventory items (from POS products)
CREATE OR REPLACE FUNCTION public.seed_waste_for_pos_products(p_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_location RECORD;
  v_item RECORD;
  v_day date;
  v_quantity numeric;
  v_reason text;
  v_reasons text[] := ARRAY['Fin de día', 'Fin de día', 'Fin de día', 'Caducado', 'Caducado', 'Rotura', 'Rotura', 'Otro'];
  v_waste_created int := 0;
BEGIN
  -- First, delete any existing waste data for this group's locations
  DELETE FROM public.waste_events 
  WHERE location_id IN (SELECT id FROM public.locations WHERE group_id = p_group_id);
  
  -- Get locations for this group
  FOR v_location IN SELECT id FROM public.locations WHERE group_id = p_group_id
  LOOP
    -- Get all inventory items for this group
    FOR v_item IN 
      SELECT id, name, last_cost 
      FROM public.inventory_items 
      WHERE group_id = p_group_id
    LOOP
      -- Create waste events for some days (not all products every day)
      FOR v_day IN SELECT generate_series(CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE - INTERVAL '1 day', '1 day')::date
      LOOP
        -- Only ~20% chance of waste per product per day
        IF random() < 0.20 THEN
          v_quantity := 0.5 + random() * 3;
          v_reason := v_reasons[1 + floor(random() * array_length(v_reasons, 1))::int];
          
          INSERT INTO public.waste_events (
            location_id,
            inventory_item_id,
            quantity,
            reason,
            waste_value,
            created_at
          ) VALUES (
            v_location.id,
            v_item.id,
            ROUND(v_quantity::numeric, 2),
            v_reason,
            ROUND((v_quantity * v_item.last_cost)::numeric, 2),
            v_day + (random() * INTERVAL '12 hours')
          );
          
          v_waste_created := v_waste_created + 1;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Created % waste events for POS products', v_waste_created;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_waste_for_pos_products(uuid) TO authenticated;