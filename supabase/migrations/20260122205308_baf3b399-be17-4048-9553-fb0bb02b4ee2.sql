-- Add destination column to ticket_lines for KDS filtering
ALTER TABLE public.ticket_lines
  ADD COLUMN IF NOT EXISTS destination TEXT DEFAULT 'kitchen';

-- Add constraint for valid destinations
ALTER TABLE public.ticket_lines DROP CONSTRAINT IF EXISTS ticket_lines_destination_check;
ALTER TABLE public.ticket_lines
  ADD CONSTRAINT ticket_lines_destination_check 
  CHECK (destination IN ('kitchen', 'bar', 'prep'));

-- Create index for efficient filtering by destination
CREATE INDEX IF NOT EXISTS idx_ticket_lines_destination 
  ON public.ticket_lines(destination) WHERE sent_to_kitchen = true;