
-- Create planned_shifts table to store scheduled shifts for comparison with actual timesheets
CREATE TABLE public.planned_shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  planned_hours NUMERIC NOT NULL,
  planned_cost NUMERIC,
  role TEXT,
  status TEXT NOT NULL DEFAULT 'published', -- draft, published
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX idx_planned_shifts_location_date ON public.planned_shifts(location_id, shift_date);
CREATE INDEX idx_planned_shifts_employee_date ON public.planned_shifts(employee_id, shift_date);

-- Enable RLS
ALTER TABLE public.planned_shifts ENABLE ROW LEVEL SECURITY;

-- RLS policies for planned_shifts
CREATE POLICY "Users can view planned shifts"
ON public.planned_shifts
FOR SELECT
USING (location_id IN (SELECT get_accessible_location_ids()));

CREATE POLICY "Managers can manage planned shifts"
ON public.planned_shifts
FOR ALL
USING (is_admin_or_ops() AND location_id IN (SELECT get_accessible_location_ids()));

-- Enable realtime for planned_shifts
ALTER PUBLICATION supabase_realtime ADD TABLE public.planned_shifts;
