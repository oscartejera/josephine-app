-- Table for printer configuration per location and destination
CREATE TABLE public.printer_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  destination TEXT NOT NULL CHECK (destination IN ('kitchen', 'bar', 'prep', 'receipt')),
  printnode_printer_id TEXT NOT NULL,
  printer_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  auto_print BOOLEAN DEFAULT true,
  paper_width INTEGER DEFAULT 80,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(location_id, destination)
);

-- Enable RLS
ALTER TABLE public.printer_config ENABLE ROW LEVEL SECURITY;

-- Policy: users can view printers for their accessible locations
CREATE POLICY "Users can view printer config for accessible locations"
  ON public.printer_config FOR SELECT
  USING (location_id IN (SELECT public.get_user_accessible_locations()));

-- Policy: users with settings permission can manage printers
CREATE POLICY "Users can manage printer config for accessible locations"
  ON public.printer_config FOR ALL
  USING (location_id IN (SELECT public.get_user_accessible_locations()))
  WITH CHECK (location_id IN (SELECT public.get_user_accessible_locations()));

-- Table for PrintNode API credentials per group
CREATE TABLE public.printnode_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE UNIQUE,
  api_key_encrypted TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.printnode_credentials ENABLE ROW LEVEL SECURITY;

-- Policy: only group members can view/manage credentials
CREATE POLICY "Group members can view their PrintNode credentials"
  ON public.printnode_credentials FOR SELECT
  USING (group_id = public.get_user_group_id());

CREATE POLICY "Group members can manage their PrintNode credentials"
  ON public.printnode_credentials FOR ALL
  USING (group_id = public.get_user_group_id())
  WITH CHECK (group_id = public.get_user_group_id());

-- Trigger for updated_at
CREATE TRIGGER update_printer_config_updated_at
  BEFORE UPDATE ON public.printer_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_printnode_credentials_updated_at
  BEFORE UPDATE ON public.printnode_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add print_attempts and last_error to pos_print_queue for retry logic
ALTER TABLE public.pos_print_queue 
  ADD COLUMN IF NOT EXISTS print_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS printnode_job_id TEXT;