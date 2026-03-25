-- ============================================================
-- Sprint 6: device_tokens table for push notifications
-- ============================================================

-- Table to store APNs (and future FCM/web) device tokens per user
CREATE TABLE IF NOT EXISTS public.device_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    token      TEXT NOT NULL,
    platform   TEXT NOT NULL DEFAULT 'ios',    -- 'ios' | 'android' | 'web'
    active     BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- Each user can only have one entry per token
    UNIQUE(user_id, token)
);

-- Index for fast lookups by employee (used by send-push function)
CREATE INDEX IF NOT EXISTS idx_device_tokens_employee_active
    ON public.device_tokens(employee_id)
    WHERE active = true;

-- Index for fast lookups by user (used by token upsert/deactivation)
CREATE INDEX IF NOT EXISTS idx_device_tokens_user
    ON public.device_tokens(user_id);

-- ─── Row Level Security ───────────────────────────────────

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own device tokens
CREATE POLICY "Users manage own tokens"
    ON public.device_tokens
    FOR ALL
    USING (auth.uid() = user_id);

-- Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION public.update_device_token_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_device_tokens_updated_at
    BEFORE UPDATE ON public.device_tokens
    FOR EACH ROW
    EXECUTE FUNCTION public.update_device_token_timestamp();

-- ─── Comments ─────────────────────────────────────────────

COMMENT ON TABLE public.device_tokens IS 'APNs/FCM push notification tokens per user/device';
COMMENT ON COLUMN public.device_tokens.platform IS 'ios | android | web';
COMMENT ON COLUMN public.device_tokens.active IS 'Deactivated on sign-out; reactivated on next sign-in';
