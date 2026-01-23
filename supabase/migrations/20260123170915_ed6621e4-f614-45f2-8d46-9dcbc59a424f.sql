-- Add integration fields to suppliers table
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS integration_type text DEFAULT 'manual' CHECK (integration_type IN ('api', 'edi', 'email', 'manual'));
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS api_endpoint text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS api_format text DEFAULT 'json' CHECK (api_format IN ('json', 'xml', 'edifact'));
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS order_email text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS order_whatsapp text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS customer_id text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS coverage text DEFAULT 'national' CHECK (coverage IN ('national', 'regional'));
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS regions text[];
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS is_template boolean DEFAULT false;

-- Add tracking fields to purchase_orders table
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS sent_method text CHECK (sent_method IN ('api', 'edi', 'email', 'manual', 'whatsapp'));
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS external_order_id text;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS response_status text;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS response_message text;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_suppliers_integration_type ON suppliers(integration_type);
CREATE INDEX IF NOT EXISTS idx_suppliers_coverage ON suppliers(coverage);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_sent_at ON purchase_orders(sent_at);