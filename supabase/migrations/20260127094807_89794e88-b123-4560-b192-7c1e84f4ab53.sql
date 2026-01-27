-- Create product_locations junction table for multi-location product assignment
CREATE TABLE public.product_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true,
  price_override numeric(10,2) DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(product_id, location_id)
);

-- Enable RLS
ALTER TABLE public.product_locations ENABLE ROW LEVEL SECURITY;

-- RLS policies (profiles.id = auth.uid())
CREATE POLICY "Users can view product_locations of their group"
  ON public.product_locations FOR SELECT
  USING (
    location_id IN (
      SELECT l.id FROM locations l
      JOIN profiles pr ON pr.group_id = l.group_id
      WHERE pr.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert product_locations of their group"
  ON public.product_locations FOR INSERT
  WITH CHECK (
    location_id IN (
      SELECT l.id FROM locations l
      JOIN profiles pr ON pr.group_id = l.group_id
      WHERE pr.id = auth.uid()
    )
  );

CREATE POLICY "Users can update product_locations of their group"
  ON public.product_locations FOR UPDATE
  USING (
    location_id IN (
      SELECT l.id FROM locations l
      JOIN profiles pr ON pr.group_id = l.group_id
      WHERE pr.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete product_locations of their group"
  ON public.product_locations FOR DELETE
  USING (
    location_id IN (
      SELECT l.id FROM locations l
      JOIN profiles pr ON pr.group_id = l.group_id
      WHERE pr.id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_product_locations_product ON product_locations(product_id);
CREATE INDEX idx_product_locations_location ON product_locations(location_id);

-- Migrate existing products: create entries for all products in all locations of same group
INSERT INTO public.product_locations (product_id, location_id, is_active)
SELECT DISTINCT p.id, l.id, p.is_active
FROM products p
JOIN locations l ON l.group_id = p.group_id
WHERE p.location_id IS NOT NULL;