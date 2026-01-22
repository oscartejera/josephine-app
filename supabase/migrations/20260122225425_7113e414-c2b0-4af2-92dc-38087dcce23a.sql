-- Enable RLS (idempotent)
ALTER TABLE public.ticket_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Allow users to update ticket lines for accessible locations (needed for KDS bump/complete)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='ticket_lines' AND policyname='Users can update ticket lines'
  ) THEN
    CREATE POLICY "Users can update ticket lines"
    ON public.ticket_lines
    FOR UPDATE
    USING (
      ticket_id IN (
        SELECT tickets.id
        FROM public.tickets
        WHERE tickets.location_id IN (SELECT get_accessible_location_ids())
      )
    );
  END IF;
END $$;

-- Allow users to delete ticket lines for accessible locations (optional; useful for cleanup tools)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='ticket_lines' AND policyname='Users can delete ticket lines'
  ) THEN
    CREATE POLICY "Users can delete ticket lines"
    ON public.ticket_lines
    FOR DELETE
    USING (
      ticket_id IN (
        SELECT tickets.id
        FROM public.tickets
        WHERE tickets.location_id IN (SELECT get_accessible_location_ids())
      )
    );
  END IF;
END $$;

-- Allow users to update tickets for accessible locations (needed for closing tickets / totals)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='tickets' AND policyname='Users can update tickets'
  ) THEN
    CREATE POLICY "Users can update tickets"
    ON public.tickets
    FOR UPDATE
    USING (
      location_id IN (SELECT get_accessible_location_ids())
    );
  END IF;
END $$;