-- Create reservations table
CREATE TABLE public.reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  pos_table_id UUID REFERENCES public.pos_tables(id) ON DELETE SET NULL,
  
  -- Guest info
  guest_name TEXT NOT NULL,
  guest_phone TEXT,
  guest_email TEXT,
  party_size INTEGER NOT NULL DEFAULT 2,
  
  -- Reservation details
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  duration_minutes INTEGER DEFAULT 90,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show')),
  confirmation_sent_at TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,
  
  -- Notes
  notes TEXT,
  special_requests TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view reservations for accessible locations"
ON public.reservations FOR SELECT
USING (location_id IN (SELECT get_accessible_location_ids()));

CREATE POLICY "Users can create reservations for accessible locations"
ON public.reservations FOR INSERT
WITH CHECK (location_id IN (SELECT get_accessible_location_ids()));

CREATE POLICY "Users can update reservations for accessible locations"
ON public.reservations FOR UPDATE
USING (location_id IN (SELECT get_accessible_location_ids()));

CREATE POLICY "Users can delete reservations for accessible locations"
ON public.reservations FOR DELETE
USING (location_id IN (SELECT get_accessible_location_ids()));

-- Index for quick lookups
CREATE INDEX idx_reservations_location_date ON public.reservations(location_id, reservation_date);
CREATE INDEX idx_reservations_table ON public.reservations(pos_table_id, reservation_date);
CREATE INDEX idx_reservations_status ON public.reservations(status) WHERE status IN ('pending', 'confirmed');

-- Trigger for updated_at
CREATE TRIGGER update_reservations_updated_at
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;