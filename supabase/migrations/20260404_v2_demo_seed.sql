-- ============================================================================
-- V2 DEMO DATA SEED — Josephine v2 — 2026-04-04
-- Populates demo data for the newly created tables
-- Org: Josephine Demo Group (a0000000-0000-0000-0000-000000000001)
-- ============================================================================

-- SUPPLIERS (5 proveedores demo)
INSERT INTO suppliers (org_id, name, category, integration_type, order_email, phone) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Macro', 'General', 'email', 'pedidos@macro.es', '+34 900 100 200'),
  ('a0000000-0000-0000-0000-000000000001', 'Mercamadrid Pescados', 'Seafood', 'manual', 'ventas@mercamadrid.com', '+34 913 200 400'),
  ('a0000000-0000-0000-0000-000000000001', 'La Viña Selecta', 'Beverages', 'email', 'bodega@lavinaselecta.com', '+34 941 500 600'),
  ('a0000000-0000-0000-0000-000000000001', 'Huerta del Sol', 'Produce', 'manual', NULL, '+34 622 800 900'),
  ('a0000000-0000-0000-0000-000000000001', 'Carnes Ibéricas Ruiz', 'Meat', 'email', 'pedidos@carnesruiz.es', '+34 924 300 500');

-- SUPPLIER_ITEMS (link proveedor ↔ ingrediente)
INSERT INTO supplier_items (org_id, supplier_id, inventory_item_id, unit_price, pack_size, is_preferred)
  SELECT 'a0000000-0000-0000-0000-000000000001', s.id, '6cbb5c8f-677d-bfb5-607f-784b9f6781c0', 4.50, '1x1litro', true
  FROM suppliers s WHERE s.name = 'Macro' AND s.org_id = 'a0000000-0000-0000-0000-000000000001' LIMIT 1;

INSERT INTO supplier_items (org_id, supplier_id, inventory_item_id, unit_price, pack_size, is_preferred)
  SELECT 'a0000000-0000-0000-0000-000000000001', s.id, '514da19f-4d82-41ec-b2eb-84f8df3f6ebb', 2.80, '1x1kg', true
  FROM suppliers s WHERE s.name = 'Huerta del Sol' AND s.org_id = 'a0000000-0000-0000-0000-000000000001' LIMIT 1;

INSERT INTO supplier_items (org_id, supplier_id, inventory_item_id, unit_price, pack_size, is_preferred)
  SELECT 'a0000000-0000-0000-0000-000000000001', s.id, '6595e2c3-b697-3c60-81b1-3a40c077222c', 28.50, '1x500g', true
  FROM suppliers s WHERE s.name = 'Carnes Ibéricas Ruiz' AND s.org_id = 'a0000000-0000-0000-0000-000000000001' LIMIT 1;

INSERT INTO supplier_items (org_id, supplier_id, inventory_item_id, unit_price, pack_size, is_preferred)
  SELECT 'a0000000-0000-0000-0000-000000000001', s.id, '2666daa8-5bda-0073-901e-d9cc7248ade0', 14.90, '1x1kg', true
  FROM suppliers s WHERE s.name = 'Mercamadrid Pescados' AND s.org_id = 'a0000000-0000-0000-0000-000000000001' LIMIT 1;

INSERT INTO supplier_items (org_id, supplier_id, inventory_item_id, unit_price, pack_size, is_preferred)
  SELECT 'a0000000-0000-0000-0000-000000000001', s.id, '5a1bb74a-0180-7d1c-d496-dced82c942a7', 8.90, '1x750ml', true
  FROM suppliers s WHERE s.name = 'La Viña Selecta' AND s.org_id = 'a0000000-0000-0000-0000-000000000001' LIMIT 1;

-- AVAILABILITY (3 empleados, 5 días cada uno)
INSERT INTO availability (org_id, employee_id, day_of_week, start_time, end_time, is_available) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', 1, '08:00', '16:00', true),
  ('a0000000-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', 2, '08:00', '16:00', true),
  ('a0000000-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', 3, '08:00', '16:00', true),
  ('a0000000-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', 4, '08:00', '16:00', true),
  ('a0000000-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', 5, '08:00', '16:00', true),
  ('a0000000-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000002', 1, '10:00', '18:00', true),
  ('a0000000-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000002', 2, '10:00', '18:00', true),
  ('a0000000-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000002', 3, '10:00', '18:00', true),
  ('a0000000-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000002', 4, '10:00', '18:00', true),
  ('a0000000-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000002', 5, '10:00', '18:00', true),
  ('a0000000-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000003', 0, '09:00', '17:00', true),
  ('a0000000-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000003', 1, '09:00', '17:00', true),
  ('a0000000-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000003', 2, '09:00', '17:00', true),
  ('a0000000-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000003', 3, '09:00', '17:00', true),
  ('a0000000-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000003', 4, '09:00', '17:00', true);

-- COGS_ENTRIES (Marzo y Febrero 2026)
INSERT INTO cogs_entries (org_id, location_id, period_month, category, amount) VALUES
  ('a0000000-0000-0000-0000-000000000001', '57f62bae-4d5b-44b0-8055-fdde12ee5a96', '2026-03-01', 'food', 18500.00),
  ('a0000000-0000-0000-0000-000000000001', '57f62bae-4d5b-44b0-8055-fdde12ee5a96', '2026-03-01', 'beverage', 4200.00),
  ('a0000000-0000-0000-0000-000000000001', '57f62bae-4d5b-44b0-8055-fdde12ee5a96', '2026-03-01', 'packaging', 850.00),
  ('a0000000-0000-0000-0000-000000000001', '57f62bae-4d5b-44b0-8055-fdde12ee5a96', '2026-03-01', 'supplies', 620.00),
  ('a0000000-0000-0000-0000-000000000001', '57f62bae-4d5b-44b0-8055-fdde12ee5a96', '2026-02-01', 'food', 17800.00),
  ('a0000000-0000-0000-0000-000000000001', '57f62bae-4d5b-44b0-8055-fdde12ee5a96', '2026-02-01', 'beverage', 3950.00);
