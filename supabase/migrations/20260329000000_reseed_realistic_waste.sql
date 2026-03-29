-- ============================================================
-- Realistic Waste Demo Data (90 days)
-- Replaces flat, unrealistic seed data with industry-aligned
-- distributions for reasons, items, shifts, and day-of-week.
-- ============================================================

-- Step 1: Delete existing waste events for all demo locations
DELETE FROM waste_events
WHERE location_id IN (
  SELECT id FROM locations WHERE active = true
);

-- Step 2: Insert realistic waste events
DO $$
DECLARE
  v_loc_id     uuid;
  v_org_id     uuid;
  v_item_ids   uuid[];
  v_item_count int;
  v_day        date;
  v_events_today int;
  v_dow        int;
  v_reason     text;
  v_hour       int;
  v_minute     int;
  v_value      numeric;
  v_qty        numeric;
  v_item_idx   int;
  v_rand       float;
  v_hour_rand  float;
  v_i          int;
BEGIN
  -- Get first active location
  SELECT id, org_id INTO v_loc_id, v_org_id
  FROM locations WHERE active = true LIMIT 1;

  IF v_loc_id IS NULL THEN
    RAISE NOTICE 'No active locations found';
    RETURN;
  END IF;

  -- Get real inventory item IDs
  SELECT ARRAY_AGG(id ORDER BY name)
  INTO v_item_ids
  FROM inventory_items
  WHERE org_id = v_org_id;

  v_item_count := COALESCE(array_length(v_item_ids, 1), 0);

  IF v_item_count = 0 THEN
    RAISE NOTICE 'No inventory items found';
    RETURN;
  END IF;

  -- Loop through last 90 days
  v_day := CURRENT_DATE - 90;

  WHILE v_day < CURRENT_DATE LOOP
    v_dow := EXTRACT(DOW FROM v_day)::int;

    -- Events per day based on day-of-week
    v_events_today := CASE v_dow
      WHEN 0 THEN 9 + floor(random() * 4)::int
      WHEN 1 THEN 11 + floor(random() * 5)::int
      WHEN 2 THEN 8 + floor(random() * 4)::int
      WHEN 3 THEN 8 + floor(random() * 4)::int
      WHEN 4 THEN 9 + floor(random() * 4)::int
      WHEN 5 THEN 13 + floor(random() * 5)::int
      WHEN 6 THEN 12 + floor(random() * 5)::int
      ELSE 10
    END;

    v_i := 1;
    WHILE v_i <= v_events_today LOOP
      -- Reason: Pareto distribution
      v_rand := random();
      v_reason := CASE
        WHEN v_rand < 0.28 THEN 'end_of_day'
        WHEN v_rand < 0.50 THEN 'expiry'
        WHEN v_rand < 0.68 THEN 'kitchen_error'
        WHEN v_rand < 0.80 THEN 'spillage'
        WHEN v_rand < 0.88 THEN 'broken'
        WHEN v_rand < 0.95 THEN 'courtesy'
        WHEN v_rand < 0.98 THEN 'theft'
        ELSE 'other'
      END;

      -- Hour: peaks during service
      v_hour_rand := random();
      v_hour := CASE
        WHEN v_hour_rand < 0.05 THEN 6 + floor(random() * 2)::int
        WHEN v_hour_rand < 0.20 THEN 8 + floor(random() * 3)::int
        WHEN v_hour_rand < 0.45 THEN 11 + floor(random() * 3)::int
        WHEN v_hour_rand < 0.55 THEN 14 + floor(random() * 3)::int
        WHEN v_hour_rand < 0.75 THEN 17 + floor(random() * 3)::int
        WHEN v_hour_rand < 0.90 THEN 20 + floor(random() * 2)::int
        ELSE 22 + floor(random() * 2)::int
      END;
      v_minute := floor(random() * 60)::int;

      -- Value: exponential distribution
      v_rand := random();
      v_value := CASE
        WHEN v_rand < 0.50 THEN ROUND((2 + random() * 10)::numeric, 2)
        WHEN v_rand < 0.80 THEN ROUND((12 + random() * 20)::numeric, 2)
        WHEN v_rand < 0.95 THEN ROUND((32 + random() * 30)::numeric, 2)
        ELSE ROUND((62 + random() * 23)::numeric, 2)
      END;

      v_qty := ROUND((0.5 + random() * 4.5)::numeric, 1);

      -- Item: cycle through real items
      v_item_idx := ((v_i + EXTRACT(DOY FROM v_day)::int) % v_item_count) + 1;

      INSERT INTO waste_events (
        id, location_id, inventory_item_id,
        quantity, waste_value, reason, created_at
      ) VALUES (
        gen_random_uuid(),
        v_loc_id,
        v_item_ids[v_item_idx],
        v_qty,
        v_value,
        v_reason,
        (v_day::timestamp + (v_hour * interval '1 hour') + (v_minute * interval '1 minute'))::timestamptz
      );

      v_i := v_i + 1;
    END LOOP;

    v_day := v_day + 1;
  END LOOP;

  RAISE NOTICE 'Waste seed complete for location %', v_loc_id;
END $$;
