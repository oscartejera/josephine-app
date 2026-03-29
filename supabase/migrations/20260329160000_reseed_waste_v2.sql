-- ============================================================
-- v2 Reseed: Adds logged_by + over_production/plate_waste
-- Re-runs the seeding with improved data for demo quality
-- ============================================================

-- Step 0: Ensure logged_by column exists (baseline defines it but live DB may not have it)
DO $$ BEGIN
  ALTER TABLE waste_events ADD COLUMN logged_by uuid;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

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
  v_group_id   uuid;
  v_item_ids   uuid[];
  v_item_count int;
  v_profile_ids uuid[];
  v_profile_count int;
  v_day        date;
  v_events_today int;
  v_dow        int;
  v_reason     text;
  v_hour       int;
  v_minute     int;
  v_value      numeric;
  v_qty        numeric;
  v_item_idx   int;
  v_profile_idx int;
  v_rand       float;
  v_hour_rand  float;
  v_i          int;
BEGIN
  -- Get first active location (locations has org_id)
  SELECT id, org_id INTO v_loc_id, v_org_id
  FROM locations WHERE active = true LIMIT 1;

  IF v_loc_id IS NULL THEN
    RAISE NOTICE 'No active locations found';
    RETURN;
  END IF;

  -- Get group_id from locations for profile lookup
  SELECT group_id INTO v_group_id
  FROM locations WHERE id = v_loc_id;

  -- Fallback: if group_id is null, use org_id
  IF v_group_id IS NULL THEN
    v_group_id := v_org_id;
  END IF;

  -- Get real inventory item IDs (inventory_items uses org_id)
  SELECT ARRAY_AGG(id ORDER BY name)
  INTO v_item_ids
  FROM inventory_items
  WHERE org_id = v_org_id;

  v_item_count := COALESCE(array_length(v_item_ids, 1), 0);

  IF v_item_count = 0 THEN
    RAISE NOTICE 'No inventory items found';
    RETURN;
  END IF;

  -- Get real profile IDs for logged_by (profiles uses group_id)
  SELECT ARRAY_AGG(id ORDER BY full_name)
  INTO v_profile_ids
  FROM profiles
  WHERE group_id = v_group_id AND full_name IS NOT NULL;

  v_profile_count := COALESCE(array_length(v_profile_ids, 1), 0);

  -- Fallback: try without full_name filter
  IF v_profile_count = 0 THEN
    SELECT ARRAY_AGG(id)
    INTO v_profile_ids
    FROM profiles
    WHERE group_id = v_group_id;
    v_profile_count := COALESCE(array_length(v_profile_ids, 1), 0);
  END IF;

  RAISE NOTICE 'Seeding waste: loc=%, items=%, profiles=%', v_loc_id, v_item_count, v_profile_count;

  -- Loop through last 90 days
  v_day := CURRENT_DATE - 90;

  WHILE v_day < CURRENT_DATE LOOP
    v_dow := EXTRACT(DOW FROM v_day)::int;

    -- Events per day based on day-of-week (Fri/Sat higher)
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
      -- Reason: Pareto distribution with 11 canonical codes
      v_rand := random();
      v_reason := CASE
        WHEN v_rand < 0.25 THEN 'end_of_day'
        WHEN v_rand < 0.43 THEN 'expiry'
        WHEN v_rand < 0.58 THEN 'kitchen_error'
        WHEN v_rand < 0.68 THEN 'spillage'
        WHEN v_rand < 0.76 THEN 'over_production'
        WHEN v_rand < 0.83 THEN 'broken'
        WHEN v_rand < 0.89 THEN 'courtesy'
        WHEN v_rand < 0.93 THEN 'plate_waste'
        WHEN v_rand < 0.96 THEN 'expired'
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

      -- Profile: distribute across team members (weighted)
      IF v_profile_count > 0 THEN
        v_rand := random();
        IF v_rand < 0.35 THEN
          v_profile_idx := 1;
        ELSIF v_rand < 0.60 THEN
          v_profile_idx := LEAST(2, v_profile_count);
        ELSIF v_rand < 0.80 THEN
          v_profile_idx := LEAST(3, v_profile_count);
        ELSE
          v_profile_idx := LEAST(floor(random() * v_profile_count)::int + 1, v_profile_count);
        END IF;
      ELSE
        v_profile_idx := 0;
      END IF;

      INSERT INTO waste_events (
        id, location_id, inventory_item_id,
        quantity, waste_value, reason, logged_by, created_at
      ) VALUES (
        gen_random_uuid(),
        v_loc_id,
        v_item_ids[v_item_idx],
        v_qty,
        v_value,
        v_reason,
        CASE WHEN v_profile_count > 0 THEN v_profile_ids[v_profile_idx] ELSE NULL END,
        (v_day::timestamp + (v_hour * interval '1 hour') + (v_minute * interval '1 minute'))::timestamptz
      );

      v_i := v_i + 1;
    END LOOP;

    v_day := v_day + 1;
  END LOOP;

  RAISE NOTICE 'Waste seed v2 complete for location %', v_loc_id;
END $$;
