-- Allow authenticated users to read sync run history.
-- The frontend SquareIntegration page needs this to show sync history.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'authenticated_read_sync_runs'
  ) THEN
    CREATE POLICY authenticated_read_sync_runs
      ON integration_sync_runs
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;
