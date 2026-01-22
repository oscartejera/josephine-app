-- Add prep tracking columns to ticket_lines for KDS (retry without realtime)
ALTER TABLE public.ticket_lines
  ADD COLUMN IF NOT EXISTS prep_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS prep_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ;

-- Drop constraint if exists and re-add
ALTER TABLE public.ticket_lines DROP CONSTRAINT IF EXISTS ticket_lines_prep_status_check;
ALTER TABLE public.ticket_lines
  ADD CONSTRAINT ticket_lines_prep_status_check 
  CHECK (prep_status IN ('pending', 'preparing', 'ready', 'served'));

-- Create index for efficient KDS queries
CREATE INDEX IF NOT EXISTS idx_ticket_lines_kds_pending 
  ON public.ticket_lines(prep_status) 
  WHERE sent_to_kitchen = true AND prep_status IN ('pending', 'preparing');