-- Drop existing restrictive policy if exists
DROP POLICY IF EXISTS "Admins can manage locations" ON public.locations;

-- Create proper insert policy for owners/admins
CREATE POLICY "Owners can insert locations"
  ON public.locations
  FOR INSERT
  WITH CHECK (
    group_id = public.get_user_group_id() 
    AND public.is_owner(auth.uid())
  );

-- Create proper update policy
CREATE POLICY "Owners can update locations"
  ON public.locations
  FOR UPDATE
  USING (
    group_id = public.get_user_group_id() 
    AND public.is_owner(auth.uid())
  )
  WITH CHECK (
    group_id = public.get_user_group_id() 
    AND public.is_owner(auth.uid())
  );

-- Create proper delete policy
CREATE POLICY "Owners can delete locations"
  ON public.locations
  FOR DELETE
  USING (
    group_id = public.get_user_group_id() 
    AND public.is_owner(auth.uid())
  );

-- Ensure location_settings has proper policies for new locations
DROP POLICY IF EXISTS "Users can insert location settings" ON public.location_settings;
CREATE POLICY "Owners can insert location settings"
  ON public.location_settings
  FOR INSERT
  WITH CHECK (
    location_id IN (SELECT id FROM public.locations WHERE group_id = public.get_user_group_id())
    AND public.is_owner(auth.uid())
  );

-- Ensure payroll_location_settings has proper policies
DROP POLICY IF EXISTS "Users can insert payroll location settings" ON public.payroll_location_settings;
CREATE POLICY "Owners can insert payroll location settings"
  ON public.payroll_location_settings
  FOR INSERT
  WITH CHECK (
    location_id IN (SELECT id FROM public.locations WHERE group_id = public.get_user_group_id())
    AND public.is_owner(auth.uid())
  );

-- Ensure pos_floor_maps has proper insert policy
DROP POLICY IF EXISTS "Users can insert floor maps" ON public.pos_floor_maps;
CREATE POLICY "Owners can insert floor maps"
  ON public.pos_floor_maps
  FOR INSERT
  WITH CHECK (
    location_id IN (SELECT id FROM public.locations WHERE group_id = public.get_user_group_id())
    AND public.is_owner(auth.uid())
  );

-- Ensure pos_tables has proper insert policy  
DROP POLICY IF EXISTS "Users can insert tables" ON public.pos_tables;
CREATE POLICY "Owners can insert tables"
  ON public.pos_tables
  FOR INSERT
  WITH CHECK (
    floor_map_id IN (
      SELECT fm.id FROM public.pos_floor_maps fm
      JOIN public.locations l ON fm.location_id = l.id
      WHERE l.group_id = public.get_user_group_id()
    )
    AND public.is_owner(auth.uid())
  );