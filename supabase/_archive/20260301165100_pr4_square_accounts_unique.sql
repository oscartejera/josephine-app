-- PR4: Unique constraint on integration_accounts to support safe upsert
-- Ensures one account per (integration, external Square merchant).
CREATE UNIQUE INDEX IF NOT EXISTS integration_accounts_integration_external_account_key
  ON integration_accounts (integration_id, external_account_id);
