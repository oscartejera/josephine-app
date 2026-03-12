-- integration_tokens — stores OAuth tokens for external integrations

DO $$
BEGIN
    -- Create table if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integration_tokens') THEN
        CREATE TABLE public.integration_tokens (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            org_id text NOT NULL,
            provider text NOT NULL,
            access_token text NOT NULL,
            refresh_token text,
            token_type text DEFAULT 'Bearer',
            expires_at timestamptz,
            scope text DEFAULT '',
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now(),
            UNIQUE (org_id, provider)
        );

        ALTER TABLE public.integration_tokens ENABLE ROW LEVEL SECURITY;

        -- Only service role should access tokens (never expose to frontend)
        CREATE POLICY "integration_tokens_service_only" ON public.integration_tokens
            FOR ALL USING (false);
    END IF;
END $$;
