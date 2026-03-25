-- ============================================================
-- Sprint 7: shift_swap_requests table for shift swaps
-- ============================================================

-- Table to track shift swap requests between employees
CREATE TABLE IF NOT EXISTS public.shift_swap_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id     UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    requester_id    UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    target_id       UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    requester_shift_id UUID NOT NULL REFERENCES public.planned_shifts(id) ON DELETE CASCADE,
    target_shift_id    UUID NOT NULL REFERENCES public.planned_shifts(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
    reason          TEXT,
    reviewed_by     UUID REFERENCES auth.users(id),
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_swap_requests_requester
    ON public.shift_swap_requests(requester_id)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_swap_requests_target
    ON public.shift_swap_requests(target_id)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_swap_requests_location_status
    ON public.shift_swap_requests(location_id, status);

-- ─── Row Level Security ───────────────────────────────────

ALTER TABLE public.shift_swap_requests ENABLE ROW LEVEL SECURITY;

-- Employees can view swap requests they are involved in
CREATE POLICY "Employees view own swap requests"
    ON public.shift_swap_requests
    FOR SELECT
    USING (
        requester_id IN (
            SELECT id FROM employees WHERE profile_user_id = auth.uid()
        )
        OR target_id IN (
            SELECT id FROM employees WHERE profile_user_id = auth.uid()
        )
    );

-- Employees can create swap requests as requester
CREATE POLICY "Employees create own swap requests"
    ON public.shift_swap_requests
    FOR INSERT
    WITH CHECK (
        requester_id IN (
            SELECT id FROM employees WHERE profile_user_id = auth.uid()
        )
    );

-- Employees can update swap requests they are target of (approve/reject)
-- or that they created (cancel)
CREATE POLICY "Employees update involved swap requests"
    ON public.shift_swap_requests
    FOR UPDATE
    USING (
        requester_id IN (
            SELECT id FROM employees WHERE profile_user_id = auth.uid()
        )
        OR target_id IN (
            SELECT id FROM employees WHERE profile_user_id = auth.uid()
        )
    );

-- Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION public.update_swap_request_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_swap_requests_updated_at
    BEFORE UPDATE ON public.shift_swap_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_swap_request_timestamp();

-- ─── Seed Data ────────────────────────────────────────────

-- Insert sample swap requests for the demo location
-- Uses existing employee + planned_shift IDs from baseline seed
DO $$
DECLARE
    v_location_id uuid;
    v_emp1      uuid := 'e0000001-0000-0000-0000-000000000001';
    v_emp2      uuid := 'e0000001-0000-0000-0000-000000000002';
    v_emp3      uuid := 'e0000001-0000-0000-0000-000000000003';
    v_shift1    uuid;
    v_shift2    uuid;
    v_shift3    uuid;
    v_shift4    uuid;
BEGIN
    -- Get location_id from first employee
    SELECT e.location_id INTO v_location_id
    FROM employees e WHERE e.id = v_emp1;

    IF v_location_id IS NULL THEN
        RAISE NOTICE 'No seed employees found — skipping swap request seeds';
        RETURN;
    END IF;

    -- Get recent shifts for each employee
    SELECT id INTO v_shift1
    FROM planned_shifts
    WHERE employee_id = v_emp1 AND shift_date >= CURRENT_DATE
    ORDER BY shift_date LIMIT 1;

    SELECT id INTO v_shift2
    FROM planned_shifts
    WHERE employee_id = v_emp2 AND shift_date >= CURRENT_DATE
    ORDER BY shift_date LIMIT 1;

    SELECT id INTO v_shift3
    FROM planned_shifts
    WHERE employee_id = v_emp2 AND shift_date >= CURRENT_DATE
    ORDER BY shift_date LIMIT 1 OFFSET 1;

    SELECT id INTO v_shift4
    FROM planned_shifts
    WHERE employee_id = v_emp3 AND shift_date >= CURRENT_DATE
    ORDER BY shift_date LIMIT 1;

    -- Only seed if we found shifts
    IF v_shift1 IS NOT NULL AND v_shift2 IS NOT NULL THEN
        INSERT INTO shift_swap_requests (location_id, requester_id, target_id, requester_shift_id, target_shift_id, status, reason)
        VALUES (v_location_id, v_emp1, v_emp2, v_shift1, v_shift2, 'pending', 'Tengo cita médica ese día')
        ON CONFLICT DO NOTHING;
    END IF;

    IF v_shift3 IS NOT NULL AND v_shift4 IS NOT NULL THEN
        INSERT INTO shift_swap_requests (location_id, requester_id, target_id, requester_shift_id, target_shift_id, status, reason)
        VALUES (v_location_id, v_emp2, v_emp3, v_shift3, v_shift4, 'approved', 'Evento familiar')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- ─── Comments ─────────────────────────────────────────────

COMMENT ON TABLE public.shift_swap_requests IS 'Shift swap requests between employees — Sprint 7';
COMMENT ON COLUMN public.shift_swap_requests.status IS 'pending | approved | rejected';
COMMENT ON COLUMN public.shift_swap_requests.reviewed_by IS 'Auth user who approved/rejected the request';
