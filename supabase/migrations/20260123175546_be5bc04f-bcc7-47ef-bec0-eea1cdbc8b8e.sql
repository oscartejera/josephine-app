-- Fix locations INSERT policy to allow owners AND admins to create locations
DROP POLICY IF EXISTS "Owners can insert locations" ON public.locations;

CREATE POLICY "Owners and admins can insert locations"
ON public.locations FOR INSERT
TO authenticated
WITH CHECK (
  group_id = (SELECT group_id FROM public.profiles WHERE id = auth.uid())
  AND public.is_owner_or_admin()
);