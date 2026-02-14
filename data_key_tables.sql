-- ============================================================
-- DATA DUMP: Key tables from Josephine Supabase DB
-- Generated: 2026-02-14
-- ============================================================


-- =======================================================
-- GROUPS (tenant / organization)
-- =======================================================
-- Row count: 3
INSERT INTO groups (id, name, created_at) VALUES
  ('e54e12d7-018e-434e-a166-d041a97854c2', 'Josephine Demo', '2026-02-05T14:34:29.041321+00:00'),
  ('443fe776-4993-4c2a-bfb6-c4252f684fb9', 'Josephine Demo', '2026-02-07T13:20:47.043499+00:00'),
  ('747d5c56-6a90-4913-9a7a-a497a3aa02e1', 'Demo Group', '2026-02-12T16:33:26.546979+00:00');


-- =======================================================
-- LOCATIONS
-- =======================================================
-- Row count: 7
INSERT INTO locations (id, group_id, name, city, timezone, currency, created_at, active) VALUES
  ('513b91a7-48bc-4a36-abe9-7d1765082ff4', 'e54e12d7-018e-434e-a166-d041a97854c2', 'La Taberna Centro', 'Salamanca', 'Europe/Madrid', 'EUR', '2026-02-12T16:13:20.29777+00:00', true),
  ('29a8c774-f155-4f22-a485-e721ad7a9347', 'e54e12d7-018e-434e-a166-d041a97854c2', 'Chamberí', 'Madrid', 'Europe/Madrid', 'EUR', '2026-02-12T16:13:20.29777+00:00', true),
  ('df8cfbfd-8f6b-406e-bd91-53ddc9a42841', 'e54e12d7-018e-434e-a166-d041a97854c2', 'Malasaña', 'Madrid', 'Europe/Madrid', 'EUR', '2026-02-12T16:13:20.29777+00:00', true),
  ('57f62bae-4d5b-44b0-8055-fdde12ee5a96', '747d5c56-6a90-4913-9a7a-a497a3aa02e1', 'La Taberna Centro', 'Madrid', 'Europe/Madrid', 'EUR', '2026-02-12T16:33:27.422522+00:00', true),
  ('9c501324-66e4-40e8-bfcb-7cc855f3754e', '747d5c56-6a90-4913-9a7a-a497a3aa02e1', 'Salamanca', 'Madrid', 'Europe/Madrid', 'EUR', '2026-02-12T16:33:27.6553+00:00', true),
  ('9469ef7a-c1b1-4314-8349-d0ea253ba483', '747d5c56-6a90-4913-9a7a-a497a3aa02e1', 'Chamberí', 'Madrid', 'Europe/Madrid', 'EUR', '2026-02-12T16:33:28.041814+00:00', true),
  ('fe0717f7-6fa7-4e5e-8467-6c9585b03022', '747d5c56-6a90-4913-9a7a-a497a3aa02e1', 'Malasaña', 'Madrid', 'Europe/Madrid', 'EUR', '2026-02-12T16:33:28.20613+00:00', true);


-- =======================================================
-- PROFILES (user accounts)
-- =======================================================
-- Row count: 5
INSERT INTO profiles (id, group_id, full_name, created_at) VALUES
  ('5a4ad6ad-e9f4-4fa3-a0be-17e08c9d23a3', '747d5c56-6a90-4913-9a7a-a497a3aa02e1', 'Demo Owner', '2026-02-07T13:20:47.604412+00:00'),
  ('3c9516f9-b996-4a19-8595-4eec4a4921a4', '747d5c56-6a90-4913-9a7a-a497a3aa02e1', 'Demo Ops Manager', '2026-02-07T13:20:47.949261+00:00'),
  ('5e441300-3a50-4705-8dda-303b5206d019', '747d5c56-6a90-4913-9a7a-a497a3aa02e1', 'Manager Centro', '2026-02-07T13:20:48.225274+00:00'),
  ('c052dfd8-510a-47d2-9815-56f5a8b593ff', '747d5c56-6a90-4913-9a7a-a497a3aa02e1', 'Employee Centro', '2026-02-07T13:20:48.551862+00:00'),
  ('5119e1bc-e187-4131-b491-b56770dfc9b2', '747d5c56-6a90-4913-9a7a-a497a3aa02e1', 'Manager Salamanca', '2026-02-07T13:20:48.812529+00:00');


-- =======================================================
-- LOCATION_SETTINGS
-- =======================================================
-- location_settings: EMPTY (0 rows)


-- =======================================================
-- ROLES (RBAC)
-- =======================================================
-- Row count: 7
INSERT INTO roles (id, name, description, is_system, created_at) VALUES
  ('135ec128-646e-4fd2-9465-0bc2079ea73e', 'owner', 'Full access to everything, bypass all restrictions', true, '2026-02-05T12:47:15.883692+00:00'),
  ('124cbd31-be76-4c10-a869-d1515e874d3e', 'admin', 'Administrative access, most permissions except billing', true, '2026-02-05T12:47:15.883692+00:00'),
  ('fbc006e8-6e30-4fdb-af02-71ce5c9d3787', 'ops_manager', 'Operations manager with broad access across locations', true, '2026-02-05T12:47:15.883692+00:00'),
  ('13c85f94-56de-424e-95ca-930ff8fa2c23', 'store_manager', 'Manager of a specific store/location', true, '2026-02-05T12:47:15.883692+00:00'),
  ('71c8e4ef-1d6b-483b-8226-f275ab7a17a5', 'finance', 'Finance team - access to financial data and reports', true, '2026-02-05T12:47:15.883692+00:00'),
  ('c3afcbaf-c8bf-430a-9de7-1d06a73b8365', 'hr_payroll', 'HR and Payroll team - manage schedules and payroll', true, '2026-02-05T12:47:15.883692+00:00'),
  ('f76d2b97-0173-49f4-b115-3d6fd3db0216', 'employee', 'Regular employee - limited access', true, '2026-02-05T12:47:15.883692+00:00');


-- =======================================================
-- PERMISSIONS (48 entries)
-- =======================================================
-- Row count: 48
INSERT INTO permissions (id, key, module, description, created_at) VALUES
  ('37acff13-45e4-4c35-88fa-7e9b6ceb1cc3', 'dashboard.view', 'dashboard', 'View dashboard', '2026-02-05T12:47:15.883692+00:00'),
  ('eee732e1-f60d-4ec7-8db9-d38017f22e79', 'dashboard.export', 'dashboard', 'Export dashboard data', '2026-02-05T12:47:15.883692+00:00'),
  ('7e45ff06-50a5-47b8-aee8-707e888eae02', 'insights.view', 'insights', 'View insights section', '2026-02-05T12:47:15.883692+00:00'),
  ('e7e376b8-b924-467a-b0c2-3eebc9f0a740', 'sales.view', 'sales', 'View sales data', '2026-02-05T12:47:15.883692+00:00'),
  ('28811b4f-43aa-4f33-b3ee-cf4f1954296e', 'sales.export', 'sales', 'Export sales data', '2026-02-05T12:47:15.883692+00:00'),
  ('ac53380b-b64c-47c1-9a08-4690801d8aae', 'labour.view', 'labour', 'View labour data', '2026-02-05T12:47:15.883692+00:00'),
  ('7aca498f-123c-42db-b3db-02905c0033db', 'labour.export', 'labour', 'Export labour data', '2026-02-05T12:47:15.883692+00:00'),
  ('31f6f29d-c6cf-4a37-a6a0-de985a8c0b69', 'instant_pl.view', 'instant_pl', 'View Instant P&L', '2026-02-05T12:47:15.883692+00:00'),
  ('5ad30cbf-f290-414b-bc1e-38b59957407b', 'instant_pl.export', 'instant_pl', 'Export Instant P&L', '2026-02-05T12:47:15.883692+00:00'),
  ('fd0e9a81-2199-412e-b4d3-b2a0704d86ef', 'reviews.view', 'reviews', 'View customer reviews', '2026-02-05T12:47:15.883692+00:00'),
  ('3a136c4f-0d84-492a-bb74-6bd6955fe66d', 'reviews.reply.generate', 'reviews', 'Generate AI replies', '2026-02-05T12:47:15.883692+00:00'),
  ('2284ab0d-8217-4bfa-b19c-099ce1a0147b', 'reviews.reply.submit', 'reviews', 'Submit replies to platforms', '2026-02-05T12:47:15.883692+00:00'),
  ('01d96080-fbf8-44dd-a821-e329fae8cc1b', 'reviews.export', 'reviews', 'Export reviews data', '2026-02-05T12:47:15.883692+00:00'),
  ('989adf98-4a39-4956-a92f-b9881e8bbc71', 'scheduling.view', 'scheduling', 'View schedules', '2026-02-05T12:47:15.883692+00:00'),
  ('de06bb61-7ed4-4b7d-a169-f543633f0778', 'scheduling.create', 'scheduling', 'Create schedules', '2026-02-05T12:47:15.883692+00:00'),
  ('74a669e0-d257-4205-9a4b-2bde8bba1b87', 'scheduling.edit', 'scheduling', 'Edit schedules', '2026-02-05T12:47:15.883692+00:00'),
  ('53b0c138-b20f-4510-8509-520967c43bc6', 'scheduling.publish', 'scheduling', 'Publish schedules', '2026-02-05T12:47:15.883692+00:00'),
  ('7999c282-8b06-4220-8e3d-46dc85fd4784', 'scheduling.undo', 'scheduling', 'Undo schedule changes', '2026-02-05T12:47:15.883692+00:00'),
  ('91214db5-2549-45d3-ae2a-7fa67a049d42', 'availability.view', 'availability', 'View availability', '2026-02-05T12:47:15.883692+00:00'),
  ('333b823c-8147-4c45-896e-11d3fa1ddd18', 'availability.edit', 'availability', 'Edit availability', '2026-02-05T12:47:15.883692+00:00'),
  ('10335bba-7d1f-4e87-8087-7d83e2cfd7d5', 'inventory.view', 'inventory', 'View inventory', '2026-02-05T12:47:15.883692+00:00'),
  ('121d3d1e-7386-4a4e-bf28-65699aa3bbd3', 'inventory.reconciliation.export', 'inventory', 'Export reconciliation', '2026-02-05T12:47:15.883692+00:00'),
  ('468ca198-0a4d-4b48-86bd-bd345fe4f0a6', 'waste.view', 'waste', 'View waste data', '2026-02-05T12:47:15.883692+00:00'),
  ('382ee292-932a-4ff0-962b-7866af207cf2', 'waste.edit', 'waste', 'Log/edit waste', '2026-02-05T12:47:15.883692+00:00'),
  ('0371a3a4-6f9f-48db-bd9d-9b42959c413d', 'procurement.view', 'procurement', 'View procurement', '2026-02-05T12:47:15.883692+00:00'),
  ('18cb0c06-4b58-467e-9b21-5f747ae5d9a5', 'procurement.order.create', 'procurement', 'Create purchase orders', '2026-02-05T12:47:15.883692+00:00'),
  ('da5e467e-527b-4d8e-9d96-28878501c739', 'procurement.order.edit', 'procurement', 'Edit purchase orders', '2026-02-05T12:47:15.883692+00:00'),
  ('119470cb-a7f7-4bc0-9046-0779b695f1fe', 'procurement.order.place', 'procurement', 'Place purchase orders', '2026-02-05T12:47:15.883692+00:00'),
  ('2db20015-e69d-42d3-93df-96d9bd3caf88', 'procurement.order.pay', 'procurement', 'Pay for orders', '2026-02-05T12:47:15.883692+00:00'),
  ('b8d9de3d-7217-4219-ba3b-67b5ac6418c5', 'procurement.order.history.view', 'procurement', 'View order history', '2026-02-05T12:47:15.883692+00:00'),
  ('2a5aec34-961d-4323-8d6b-0801590892af', 'menu_engineering.view', 'menu_engineering', 'View menu engineering', '2026-02-05T12:47:15.883692+00:00'),
  ('6a8083ba-3ff8-475e-ab34-60c37500fadd', 'menu_engineering.edit', 'menu_engineering', 'Edit menu items', '2026-02-05T12:47:15.883692+00:00'),
  ('dda66e7a-61d6-4c68-96f6-342281b84f32', 'integrations.view', 'integrations', 'View integrations', '2026-02-05T12:47:15.883692+00:00'),
  ('9997bad8-aac8-4fdf-8976-b8950902d3fa', 'integrations.connect', 'integrations', 'Connect integrations', '2026-02-05T12:47:15.883692+00:00'),
  ('9f355095-b3d7-4866-8a45-9165731442d9', 'integrations.disconnect', 'integrations', 'Disconnect integrations', '2026-02-05T12:47:15.883692+00:00'),
  ('6ab0d638-1f2f-4b0e-a116-56019a4d41d0', 'integrations.health.view', 'integrations', 'View integration health', '2026-02-05T12:47:15.883692+00:00'),
  ('f6fe9f44-960a-4870-9c74-6bd2d11d2a48', 'payroll.view', 'payroll', 'View payroll', '2026-02-05T12:47:15.883692+00:00'),
  ('61068a78-7bf5-4844-9a92-1ffbd6bd2878', 'payroll.export', 'payroll', 'Export payroll data', '2026-02-05T12:47:15.883692+00:00'),
  ('0f4bfaed-ea82-453d-a151-3b00c884ffc8', 'payroll.approve_hours', 'payroll', 'Approve work hours', '2026-02-05T12:47:15.883692+00:00'),
  ('0be70043-a532-4f3e-9427-0aefd1d9d4b1', 'settings.view', 'settings', 'View settings', '2026-02-05T12:47:15.883692+00:00'),
  ('ce0aca7b-dbb5-44a8-bda7-18ad84b039eb', 'settings.users.manage', 'settings', 'Manage users and roles', '2026-02-05T12:47:15.883692+00:00'),
  ('d69b35b2-dd5c-4dc4-bb9c-a90ae16b1fd1', 'settings.roles.manage', 'settings', 'Manage role permissions', '2026-02-05T12:47:15.883692+00:00'),
  ('85ae2a7d-2e31-442a-b345-ab87a19e4684', 'settings.billing.manage', 'settings', 'Manage billing', '2026-02-05T12:47:15.883692+00:00'),
  ('5af9c9bc-927d-4c3a-90ee-b668a110af50', 'cash_management.view', 'cash_management', 'View cash management data', '2026-02-05T12:47:16.607046+00:00'),
  ('4d6fcb74-fbcf-4e06-a455-b9103a96e5db', 'cash_management.export', 'cash_management', 'Export cash management data', '2026-02-05T12:47:16.607046+00:00'),
  ('eed89cdf-3a6e-4132-89aa-5898fda41eac', 'budgets.view', 'budgets', 'View budgets data', '2026-02-05T12:47:16.607046+00:00'),
  ('3dff5ba8-69be-4ddc-a95e-85818888924b', 'budgets.edit', 'budgets', 'Edit budgets', '2026-02-05T12:47:16.607046+00:00'),
  ('c346928b-10ff-496f-bf57-11b4b4adbb66', 'budgets.export', 'budgets', 'Export budgets data', '2026-02-05T12:47:16.607046+00:00');


-- =======================================================
-- ROLE_PERMISSIONS (role→permission mapping)
-- =======================================================
-- Row count: 100 (too many for inline, showing first 20)
-- Row count: 20
INSERT INTO role_permissions (role_id, permission_id) VALUES
  ('124cbd31-be76-4c10-a869-d1515e874d3e', 'ac53380b-b64c-47c1-9a08-4690801d8aae'),
  ('124cbd31-be76-4c10-a869-d1515e874d3e', '7aca498f-123c-42db-b3db-02905c0033db'),
  ('124cbd31-be76-4c10-a869-d1515e874d3e', '31f6f29d-c6cf-4a37-a6a0-de985a8c0b69'),
  ('124cbd31-be76-4c10-a869-d1515e874d3e', '5ad30cbf-f290-414b-bc1e-38b59957407b'),
  ('124cbd31-be76-4c10-a869-d1515e874d3e', 'fd0e9a81-2199-412e-b4d3-b2a0704d86ef'),
  ('124cbd31-be76-4c10-a869-d1515e874d3e', '3a136c4f-0d84-492a-bb74-6bd6955fe66d'),
  ('124cbd31-be76-4c10-a869-d1515e874d3e', '2284ab0d-8217-4bfa-b19c-099ce1a0147b'),
  ('124cbd31-be76-4c10-a869-d1515e874d3e', '01d96080-fbf8-44dd-a821-e329fae8cc1b'),
  ('124cbd31-be76-4c10-a869-d1515e874d3e', '989adf98-4a39-4956-a92f-b9881e8bbc71'),
  ('124cbd31-be76-4c10-a869-d1515e874d3e', 'de06bb61-7ed4-4b7d-a169-f543633f0778'),
  ('124cbd31-be76-4c10-a869-d1515e874d3e', '74a669e0-d257-4205-9a4b-2bde8bba1b87'),
  ('124cbd31-be76-4c10-a869-d1515e874d3e', '53b0c138-b20f-4510-8509-520967c43bc6'),
  ('124cbd31-be76-4c10-a869-d1515e874d3e', '7999c282-8b06-4220-8e3d-46dc85fd4784'),
  ('124cbd31-be76-4c10-a869-d1515e874d3e', '91214db5-2549-45d3-ae2a-7fa67a049d42'),
  ('124cbd31-be76-4c10-a869-d1515e874d3e', '333b823c-8147-4c45-896e-11d3fa1ddd18'),
  ('124cbd31-be76-4c10-a869-d1515e874d3e', '10335bba-7d1f-4e87-8087-7d83e2cfd7d5'),
  ('124cbd31-be76-4c10-a869-d1515e874d3e', '121d3d1e-7386-4a4e-bf28-65699aa3bbd3'),
  ('124cbd31-be76-4c10-a869-d1515e874d3e', '468ca198-0a4d-4b48-86bd-bd345fe4f0a6'),
  ('124cbd31-be76-4c10-a869-d1515e874d3e', '382ee292-932a-4ff0-962b-7866af207cf2'),
  ('124cbd31-be76-4c10-a869-d1515e874d3e', '0371a3a4-6f9f-48db-bd9d-9b42959c413d');


-- =======================================================
-- USER_ROLES
-- =======================================================
-- Row count: 5
INSERT INTO user_roles (id, user_id, role_id, location_id) VALUES
  ('f597cdb3-72d7-41db-b624-e6753921f842', '5a4ad6ad-e9f4-4fa3-a0be-17e08c9d23a3', '135ec128-646e-4fd2-9465-0bc2079ea73e', NULL),
  ('b6cdaada-1bdc-4d29-b498-cfcc1f141829', '3c9516f9-b996-4a19-8595-4eec4a4921a4', 'fbc006e8-6e30-4fdb-af02-71ce5c9d3787', NULL),
  ('65da9a2c-d95e-467f-97bb-11e369239b33', '5e441300-3a50-4705-8dda-303b5206d019', '13c85f94-56de-424e-95ca-930ff8fa2c23', '57f62bae-4d5b-44b0-8055-fdde12ee5a96'),
  ('195e1893-3c15-4b42-bc90-67900d468af8', 'c052dfd8-510a-47d2-9815-56f5a8b593ff', 'f76d2b97-0173-49f4-b115-3d6fd3db0216', '57f62bae-4d5b-44b0-8055-fdde12ee5a96'),
  ('8b803290-ec66-4744-9f6d-b60d60fa0947', '5119e1bc-e187-4131-b491-b56770dfc9b2', '13c85f94-56de-424e-95ca-930ff8fa2c23', '9c501324-66e4-40e8-bfcb-7cc855f3754e');


-- =======================================================
-- USER_LOCATIONS
-- =======================================================
-- user_locations: EMPTY (0 rows)


-- =======================================================
-- INTEGRATIONS (POS connections)
-- =======================================================
-- Row count: 22
INSERT INTO integrations (id, org_id, location_id, provider, status, created_at, updated_at, metadata) VALUES
  ('9e930d05-81b4-49b0-8313-06d5c94ec423', '5a4ad6ad-e9f4-4fa3-a0be-17e08c9d23a3', NULL, 'square', 'disabled', '2026-02-12T12:00:58.699367+00:00', '2026-02-12T12:00:58.699367+00:00', '{"app_url": "https://www.josephine-ai.com", "oauth_state": "c81c0adf-7e3c-40e6-8155-93eeb811a10c", "last_synced_at": "2026-02-12T15:15:47.129Z", "oauth_environment": "production"}'::jsonb),
  ('83f16ee6-d6f5-4392-a450-d8f9b0d3b126', '00000000-0000-0000-0000-000000000000', NULL, 'square', 'disabled', '2026-02-11T19:45:56.74129+00:00', '2026-02-11T19:45:56.74129+00:00', '{"oauth_environment": "production"}'::jsonb),
  ('931fb172-5a82-4b8c-8dff-eae88d232daf', '5a4ad6ad-e9f4-4fa3-a0be-17e08c9d23a3', NULL, 'square', 'disabled', '2026-02-12T22:19:49.312234+00:00', '2026-02-12T22:19:49.312234+00:00', '{"app_url": "https://www.josephine-ai.com", "oauth_state": "b199bc45-7a13-4922-99e5-cc50a0295c66", "last_synced_at": "2026-02-13T18:15:55.873Z", "oauth_environment": "production"}'::jsonb),
  ('177da0a9-aadf-41b2-b03e-ca19522a9873', '00000000-0000-0000-0000-000000000000', NULL, 'square', 'disabled', '2026-02-11T23:22:45.999153+00:00', '2026-02-11T23:22:45.999153+00:00', '{"app_url": "https://www.josephine-ai.com", "oauth_environment": "production"}'::jsonb),
  ('b1ae8da3-f4d6-49b1-a636-00494a8f7819', '00000000-0000-0000-0000-000000000000', NULL, 'square', 'disabled', '2026-02-10T21:39:20.424756+00:00', '2026-02-10T21:39:20.424756+00:00', '{}'::jsonb),
  ('6172ac7c-11ad-42d8-bbc2-7a1b54cb26e1', '5a4ad6ad-e9f4-4fa3-a0be-17e08c9d23a3', NULL, 'square', 'disabled', '2026-02-10T21:36:51.89352+00:00', '2026-02-10T21:36:51.89352+00:00', '{"app_url": "https://www.josephine-ai.com", "oauth_state": "87cd7a85-b1de-4dc8-bfd1-4f693d71e93d", "oauth_environment": "sandbox"}'::jsonb),
  ('101e8787-0f55-4e85-8ad8-990d32fa251a', '5a4ad6ad-e9f4-4fa3-a0be-17e08c9d23a3', NULL, 'square', 'disabled', '2026-02-11T14:46:01.289362+00:00', '2026-02-11T14:46:01.289362+00:00', '{"app_url": "https://www.josephine-ai.com", "oauth_state": "3ef1d9ce-a6ed-4246-8b9b-e1ff1d443f46", "oauth_environment": "sandbox"}'::jsonb),
  ('e2f98f58-978c-4f32-9e1a-b8ff4c522131', '5a4ad6ad-e9f4-4fa3-a0be-17e08c9d23a3', NULL, 'square', 'disabled', '2026-02-11T17:27:46.296555+00:00', '2026-02-11T17:27:46.296555+00:00', '{"app_url": "https://www.josephine-ai.com", "oauth_state": "83e574eb-8a5f-407c-91fa-833e6647ff90", "last_synced_at": "2026-02-11T17:46:44.872821+00:00", "oauth_environment": "sandbox"}'::jsonb),
  ('8cb21192-0d10-43fa-9dce-4ce53117f2dd', '5a4ad6ad-e9f4-4fa3-a0be-17e08c9d23a3', NULL, 'square', 'disabled', '2026-02-11T18:44:31.493183+00:00', '2026-02-11T18:44:31.493183+00:00', '{"app_url": "https://www.josephine-ai.com", "oauth_state": "8bfc4f74-2284-45e0-b46f-9ac65b777554", "oauth_environment": "sandbox"}'::jsonb),
  ('6700347d-a33c-484b-860e-2da1a965315b', '5a4ad6ad-e9f4-4fa3-a0be-17e08c9d23a3', NULL, 'square', 'disabled', '2026-02-11T18:45:16.74274+00:00', '2026-02-11T18:45:16.74274+00:00', '{"app_url": "https://www.josephine-ai.com", "oauth_state": "4c0e8b23-a714-4809-a48a-f308725a5891", "oauth_environment": "sandbox"}'::jsonb),
  ('17ee01cf-6992-43ea-89a1-2b625d5d7f27', '5a4ad6ad-e9f4-4fa3-a0be-17e08c9d23a3', NULL, 'square', 'disabled', '2026-02-11T23:33:05.74612+00:00', '2026-02-11T23:33:05.74612+00:00', '{"app_url": "https://www.josephine-ai.com", "oauth_state": "242b38b5-24f0-43e7-9af5-6f85dc4b49f8", "last_synced_at": "2026-02-11T23:45:05.140Z", "oauth_environment": "production"}'::jsonb),
  ('c0f7844a-92b6-4c44-b6fe-bdf77e15d4bd', '5a4ad6ad-e9f4-4fa3-a0be-17e08c9d23a3', NULL, 'square', 'disabled', '2026-02-12T00:03:22.798647+00:00', '2026-02-12T00:03:22.798647+00:00', '{"app_url": "https://www.josephine-ai.com", "oauth_state": "b1a9efbb-9d73-4555-a248-448ce1d894ad", "oauth_environment": "production"}'::jsonb),
  ('81e36b72-72f8-46cf-8bc7-d4539b4c86a8', '5a4ad6ad-e9f4-4fa3-a0be-17e08c9d23a3', NULL, 'square', 'disabled', '2026-02-11T23:43:57.732573+00:00', '2026-02-11T23:43:57.732573+00:00', '{"app_url": "https://www.josephine-ai.com", "oauth_state": "ef4ef650-c1ff-478f-a12c-3d6e6529d37d", "oauth_environment": "production"}'::jsonb),
  ('21b6967c-5262-4002-a3fe-5772c5b2e555', '5a4ad6ad-e9f4-4fa3-a0be-17e08c9d23a3', NULL, 'square', 'disabled', '2026-02-12T00:19:54.357881+00:00', '2026-02-12T00:19:54.357881+00:00', '{"app_url": "https://www.josephine-ai.com", "oauth_state": "61644c38-4ede-4a71-8932-dbd250850241", "oauth_environment": "production"}'::jsonb),
  ('dd3603c3-2edc-4541-b31b-7b65541d6a93', '5a4ad6ad-e9f4-4fa3-a0be-17e08c9d23a3', NULL, 'square', 'disabled', '2026-02-11T23:55:28.078827+00:00', '2026-02-11T23:55:28.078827+00:00', '{"app_url": "https://www.josephine-ai.com", "oauth_state": "471ae793-8e81-465f-b59b-f79d000873eb", "last_synced_at": "2026-02-11T23:57:57.141Z", "oauth_environment": "production"}'::jsonb),
  ('ac48a3c1-3965-4930-941c-b8c5282f60ac', '5a4ad6ad-e9f4-4fa3-a0be-17e08c9d23a3', NULL, 'square', 'disabled', '2026-02-11T19:07:04.294155+00:00', '2026-02-11T19:07:04.294155+00:00', '{"app_url": "https://www.josephine-ai.com", "oauth_state": "0b48b36d-c63b-4615-abe5-3b1ff6363b6d", "last_synced_at": "2026-02-11T23:50:52.356Z", "oauth_environment": "production"}'::jsonb),
  ('e4e73c09-2a10-4d3e-9aee-e7a38539282d', '5a4ad6ad-e9f4-4fa3-a0be-17e08c9d23a3', NULL, 'square', 'disabled', '2026-02-12T01:04:51.078443+00:00', '2026-02-12T01:04:51.078443+00:00', '{"app_url": "https://www.josephine-ai.com", "oauth_state": "2c52170b-2cde-4260-95aa-ca6e61d0967f", "last_synced_at": "2026-02-12T02:42:44.082Z", "oauth_environment": "production"}'::jsonb),
  ('91573b94-39da-47aa-bc17-96cc1ad94e12', '5a4ad6ad-e9f4-4fa3-a0be-17e08c9d23a3', NULL, 'square', 'disabled', '2026-02-12T00:33:00.862932+00:00', '2026-02-12T00:33:00.862932+00:00', '{"app_url": "https://www.josephine-ai.com", "oauth_state": "18acb2f6-dd02-4f00-97ff-e037ab75d8f0", "last_synced_at": "2026-02-12T00:39:27.837Z", "oauth_environment": "production"}'::jsonb),
  ('d8eee51f-eba8-4f94-a002-1ae54cefea14', '5a4ad6ad-e9f4-4fa3-a0be-17e08c9d23a3', NULL, 'square', 'disabled', '2026-02-12T00:49:15.812685+00:00', '2026-02-12T00:49:15.812685+00:00', '{"app_url": "https://www.josephine-ai.com", "oauth_state": "de2d1ef4-c222-4cb5-9d2d-122df31cbb30", "oauth_environment": "production"}'::jsonb),
  ('266cb94d-e16c-45a5-aca4-585c794f3e29', '5a4ad6ad-e9f4-4fa3-a0be-17e08c9d23a3', NULL, 'square', 'disabled', '2026-02-12T19:58:36.286341+00:00', '2026-02-12T19:58:36.286341+00:00', '{"app_url": "https://www.josephine-ai.com", "oauth_state": "9c17b14a-f972-4cfb-8a9d-f2b8956314c0", "last_synced_at": "2026-02-12T21:15:50.654Z", "oauth_environment": "production"}'::jsonb),
  ('ebf1864d-27cc-47d3-8f72-e8ca95b72f78', '5a4ad6ad-e9f4-4fa3-a0be-17e08c9d23a3', NULL, 'square', 'disabled', '2026-02-13T18:46:44.892652+00:00', '2026-02-13T18:46:44.892652+00:00', '{"app_url": "https://www.josephine-ai.com", "oauth_state": "edefe7ea-3b3a-4f03-9fb8-f82d4d04f7ff", "last_synced_at": "2026-02-13T18:48:11.348Z", "oauth_environment": "production"}'::jsonb),
  ('82eea701-090c-451c-8f29-c7cb47c4f6e2', '5a4ad6ad-e9f4-4fa3-a0be-17e08c9d23a3', NULL, 'square', 'disabled', '2026-02-12T01:27:42.914932+00:00', '2026-02-12T01:27:42.914932+00:00', '{"app_url": "https://www.josephine-ai.com", "oauth_state": "9933f788-50d1-409e-af73-0d2681420fc0", "last_synced_at": "2026-02-12T11:45:39.171Z", "oauth_environment": "production"}'::jsonb);


-- =======================================================
-- INTEGRATION_ACCOUNTS (OAuth tokens — REDACTED)
-- =======================================================
-- Row count: 22
INSERT INTO integration_accounts (id, integration_id, provider, environment, external_account_id, access_token_encrypted, refresh_token_encrypted, token_expires_at, scopes, metadata, is_active, created_at, updated_at) VALUES
  ('0a7e3a62-a310-4374-aae1-a4a4758c18fd', '8cb21192-0d10-43fa-9dce-4ce53117f2dd', 'square', 'sandbox', 'ML5K1T6F5Y8EP', '[REDACTED]', '[REDACTED]', '2026-03-13T18:44:35+00:00', '[]'::jsonb, '{"merchant_id": "ML5K1T6F5Y8EP"}'::jsonb, false, '2026-02-11T18:44:35.891223+00:00', '2026-02-11T18:44:35.891223+00:00'),
  ('3c5e9287-746e-4fff-879b-6aae7b7814a3', '6700347d-a33c-484b-860e-2da1a965315b', 'square', 'sandbox', 'ML5K1T6F5Y8EP', '[REDACTED]', '[REDACTED]', '2026-03-13T18:45:21+00:00', '[]'::jsonb, '{"merchant_id": "ML5K1T6F5Y8EP"}'::jsonb, false, '2026-02-11T18:45:21.675652+00:00', '2026-02-11T18:45:21.675652+00:00'),
  ('9548bb48-f916-4b17-8822-b404272c77f4', '17ee01cf-6992-43ea-89a1-2b625d5d7f27', 'square', 'production', 'MLFNFYK92DF47', '[REDACTED]', '[REDACTED]', '2026-03-13T23:33:16+00:00', '[]'::jsonb, '{"merchant_id": "MLFNFYK92DF47"}'::jsonb, false, '2026-02-11T23:33:16.659464+00:00', '2026-02-11T23:33:16.659464+00:00'),
  ('35193021-74fb-4d17-aefc-62bc0aad373e', '83f16ee6-d6f5-4392-a450-d8f9b0d3b126', 'square', 'production', 'JOSEPHINE_MERCHANT', '[REDACTED]', '[REDACTED]', NULL, '[]'::jsonb, '{"location_id": "L0EE0YG11ZYMT", "merchant_id": "JOSEPHINE_MERCHANT"}'::jsonb, false, '2026-02-11T19:46:11.194039+00:00', '2026-02-11T19:46:11.194039+00:00'),
  ('6df318e8-b321-45f2-a68c-1baf625cf25c', '81e36b72-72f8-46cf-8bc7-d4539b4c86a8', 'square', 'production', 'MLFNFYK92DF47', '[REDACTED]', '[REDACTED]', '2026-03-13T23:48:05+00:00', '[]'::jsonb, '{"merchant_id": "MLFNFYK92DF47"}'::jsonb, false, '2026-02-11T23:48:05.722893+00:00', '2026-02-11T23:48:05.722893+00:00'),
  ('9510dc35-9bdc-4586-a5cd-5db45e252db5', '177da0a9-aadf-41b2-b03e-ca19522a9873', 'square', 'production', 'production-merchant', '[REDACTED]', '[REDACTED]', NULL, '[]'::jsonb, '{"setup": "direct", "merchant_id": "production-merchant"}'::jsonb, false, '2026-02-11T23:22:46.955925+00:00', '2026-02-11T23:22:46.955925+00:00'),
  ('a87748f1-26c0-45a6-bce1-c7bd55743d7a', 'b1ae8da3-f4d6-49b1-a636-00494a8f7819', 'square', 'sandbox', 'sandbox-merchant', '[REDACTED]', '[REDACTED]', NULL, '[]'::jsonb, '{"merchant_id": "sandbox-merchant"}'::jsonb, false, '2026-02-10T21:39:20.758383+00:00', '2026-02-10T21:39:20.758383+00:00'),
  ('9a1adfe8-c24b-4fac-adfa-3cfdba9ad830', '6172ac7c-11ad-42d8-bbc2-7a1b54cb26e1', 'square', 'sandbox', 'ML5K1T6F5Y8EP', '[REDACTED]', '[REDACTED]', '2026-03-12T22:22:19+00:00', '[]'::jsonb, '{"merchant_id": "ML5K1T6F5Y8EP"}'::jsonb, false, '2026-02-10T22:22:19.304594+00:00', '2026-02-10T22:22:19.304594+00:00'),
  ('c7d38ecb-3bd2-4164-b2c5-8916d117519c', '101e8787-0f55-4e85-8ad8-990d32fa251a', 'square', 'sandbox', 'ML5K1T6F5Y8EP', '[REDACTED]', '[REDACTED]', '2026-03-13T14:47:08+00:00', '[]'::jsonb, '{"merchant_id": "ML5K1T6F5Y8EP"}'::jsonb, false, '2026-02-11T14:47:08.976672+00:00', '2026-02-11T14:47:08.976672+00:00'),
  ('3b0afe62-d167-45b6-92ea-81d06d42e393', 'e2f98f58-978c-4f32-9e1a-b8ff4c522131', 'square', 'sandbox', 'ML5K1T6F5Y8EP', '[REDACTED]', '[REDACTED]', '2026-03-13T17:27:50+00:00', '[]'::jsonb, '{"merchant_id": "ML5K1T6F5Y8EP"}'::jsonb, false, '2026-02-11T17:27:50.795688+00:00', '2026-02-11T17:27:50.795688+00:00'),
  ('bb4b9f8b-d5c8-4c8b-ac58-7702d2ef8cde', 'dd3603c3-2edc-4541-b31b-7b65541d6a93', 'square', 'production', 'MLFNFYK92DF47', '[REDACTED]', '[REDACTED]', '2026-03-13T23:55:36+00:00', '[]'::jsonb, '{"merchant_id": "MLFNFYK92DF47"}'::jsonb, false, '2026-02-11T23:55:36.628556+00:00', '2026-02-11T23:55:36.628556+00:00'),
  ('3cd65bf8-4ec4-4b31-a5b3-bef2d1333fdb', '91573b94-39da-47aa-bc17-96cc1ad94e12', 'square', 'production', 'MLFNFYK92DF47', '[REDACTED]', '[REDACTED]', '2026-03-14T00:33:12+00:00', '[]'::jsonb, '{"merchant_id": "MLFNFYK92DF47"}'::jsonb, false, '2026-02-12T00:33:12.873588+00:00', '2026-02-12T00:33:12.873588+00:00'),
  ('dee52065-62fb-4846-9148-5e46091d4333', '21b6967c-5262-4002-a3fe-5772c5b2e555', 'square', 'production', 'MLFNFYK92DF47', '[REDACTED]', '[REDACTED]', '2026-03-14T00:20:03+00:00', '[]'::jsonb, '{"merchant_id": "MLFNFYK92DF47"}'::jsonb, false, '2026-02-12T00:20:04.320516+00:00', '2026-02-12T00:20:04.320516+00:00'),
  ('7e973e96-6f34-47b4-a15d-a4559d926ecc', 'ac48a3c1-3965-4930-941c-b8c5282f60ac', 'square', 'production', 'MLFNFYK92DF47', '[REDACTED]', '[REDACTED]', '2026-03-13T23:48:29+00:00', '[]'::jsonb, '{"merchant_id": "MLFNFYK92DF47"}'::jsonb, false, '2026-02-11T23:48:29.823068+00:00', '2026-02-11T23:48:29.823068+00:00'),
  ('c04de26b-37e1-4bcc-8adb-dff241c4e63d', 'c0f7844a-92b6-4c44-b6fe-bdf77e15d4bd', 'square', 'production', 'MLFNFYK92DF47', '[REDACTED]', '[REDACTED]', '2026-03-14T00:03:32+00:00', '[]'::jsonb, '{"merchant_id": "MLFNFYK92DF47"}'::jsonb, false, '2026-02-12T00:03:32.866609+00:00', '2026-02-12T00:03:32.866609+00:00'),
  ('50853dac-1306-42e4-b4e8-3775663b7d7b', '82eea701-090c-451c-8f29-c7cb47c4f6e2', 'square', 'production', 'MLFNFYK92DF47', '[REDACTED]', '[REDACTED]', '2026-03-14T01:31:11+00:00', '[]'::jsonb, '{"merchant_id": "MLFNFYK92DF47"}'::jsonb, false, '2026-02-12T01:31:11.846468+00:00', '2026-02-12T01:31:11.846468+00:00'),
  ('c0abd7f8-c9ee-4743-8fe8-0a93a0b0d017', 'd8eee51f-eba8-4f94-a002-1ae54cefea14', 'square', 'production', 'MLFNFYK92DF47', '[REDACTED]', '[REDACTED]', '2026-03-14T00:49:26+00:00', '[]'::jsonb, '{"merchant_id": "MLFNFYK92DF47"}'::jsonb, false, '2026-02-12T00:49:26.620958+00:00', '2026-02-12T00:49:26.620958+00:00'),
  ('07497f50-2fd8-4bb1-96d9-e8b97fa858db', 'e4e73c09-2a10-4d3e-9aee-e7a38539282d', 'square', 'production', 'MLFNFYK92DF47', '[REDACTED]', '[REDACTED]', '2026-03-14T01:05:00+00:00', '[]'::jsonb, '{"merchant_id": "MLFNFYK92DF47"}'::jsonb, false, '2026-02-12T01:05:00.822826+00:00', '2026-02-12T01:05:00.822826+00:00'),
  ('01eba65b-4183-436a-80cc-99b814a93aa4', '9e930d05-81b4-49b0-8313-06d5c94ec423', 'square', 'production', 'MLFNFYK92DF47', '[REDACTED]', '[REDACTED]', '2026-03-14T12:01:13+00:00', '[]'::jsonb, '{"merchant_id": "MLFNFYK92DF47"}'::jsonb, false, '2026-02-12T12:01:13.642763+00:00', '2026-02-12T12:01:13.642763+00:00'),
  ('d78cbeb1-e90e-4f9a-bfd7-bf1e8e8b2f40', '266cb94d-e16c-45a5-aca4-585c794f3e29', 'square', 'production', 'MLFNFYK92DF47', '[REDACTED]', '[REDACTED]', '2026-03-14T19:58:52+00:00', '[]'::jsonb, '{"merchant_id": "MLFNFYK92DF47"}'::jsonb, false, '2026-02-12T19:58:52.672075+00:00', '2026-02-12T19:58:52.672075+00:00'),
  ('eda1f508-e640-4063-bb9e-21bf953ddaf3', '931fb172-5a82-4b8c-8dff-eae88d232daf', 'square', 'production', 'MLFNFYK92DF47', '[REDACTED]', '[REDACTED]', '2026-03-14T22:19:58+00:00', '[]'::jsonb, '{"merchant_id": "MLFNFYK92DF47"}'::jsonb, false, '2026-02-12T22:19:58.790275+00:00', '2026-02-12T22:19:58.790275+00:00'),
  ('65aff37e-ed57-4a71-bd51-89c4a86a9291', 'ebf1864d-27cc-47d3-8f72-e8ca95b72f78', 'square', 'production', 'MLFNFYK92DF47', '[REDACTED]', '[REDACTED]', '2026-03-15T18:46:54+00:00', '[]'::jsonb, '{"merchant_id": "MLFNFYK92DF47"}'::jsonb, false, '2026-02-13T18:46:54.838631+00:00', '2026-02-13T18:46:54.838631+00:00');


-- =======================================================
-- EMPLOYEES (first 50 of 110)
-- =======================================================
-- Row count: 50
INSERT INTO employees (id, location_id, external_id, full_name, role_name, hourly_cost, active, created_at, user_id) VALUES
  ('9a916936-db48-494a-85ab-cacfcd015f49', '513b91a7-48bc-4a36-abe9-7d1765082ff4', NULL, 'Carlos García', 'Chef', 18.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('c41e1f09-bf46-4ef5-9657-0d37ee9e5fda', '57f62bae-4d5b-44b0-8055-fdde12ee5a96', NULL, 'Jefe de Cocina La', 'Jefe de Cocina', 15.72, true, '2026-02-12T16:33:29.584457+00:00', NULL),
  ('290951dd-70d0-44cf-844b-0b167747c555', '57f62bae-4d5b-44b0-8055-fdde12ee5a96', NULL, 'Camarero La', 'Camarero', 16.81, true, '2026-02-12T16:33:29.692699+00:00', NULL),
  ('47e30093-62f1-40cf-92cd-e4829816fb0e', '513b91a7-48bc-4a36-abe9-7d1765082ff4', NULL, 'María López', 'Chef', 18.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('ea1d3f17-3f6a-4232-9060-e2749a3030f6', '513b91a7-48bc-4a36-abe9-7d1765082ff4', NULL, 'Juan Martínez', 'Chef', 18.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('6b6b081f-9db2-4089-b640-2abc3c4387ec', '513b91a7-48bc-4a36-abe9-7d1765082ff4', NULL, 'Ana Torres', 'Chef', 18.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('96a95387-7a40-429a-9562-b5aabd900bf8', '513b91a7-48bc-4a36-abe9-7d1765082ff4', NULL, 'Pedro Sánchez', 'Chef', 18.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('9258af0b-de7c-4a8f-a780-84d741eec61e', '513b91a7-48bc-4a36-abe9-7d1765082ff4', NULL, 'Laura Fernández', 'Chef', 18.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('e1337d9e-05c9-40d5-a975-a3c02f9e13d5', '57f62bae-4d5b-44b0-8055-fdde12ee5a96', NULL, 'Ayudante Cocina La', 'Ayudante Cocina', 15.06, true, '2026-02-12T16:33:29.794178+00:00', NULL),
  ('42ae3496-ef5d-4960-8e33-c326244683a3', '513b91a7-48bc-4a36-abe9-7d1765082ff4', NULL, 'Miguel Ruiz', 'Chef', 18.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('932f62c3-30e5-429e-88e7-5468613a3310', '513b91a7-48bc-4a36-abe9-7d1765082ff4', NULL, 'Carmen Díaz', 'Chef', 18.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('9e767290-d078-4a4d-b077-e05fcc1536d7', '513b91a7-48bc-4a36-abe9-7d1765082ff4', NULL, 'David Rodríguez', 'Server', 12.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('58f70c5b-575e-42a1-a6b0-6bfbc6044a9e', '513b91a7-48bc-4a36-abe9-7d1765082ff4', NULL, 'Sara Gómez', 'Server', 12.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('c9cb950e-1f21-4526-a4db-eaf1f67f8eed', '513b91a7-48bc-4a36-abe9-7d1765082ff4', NULL, 'Pablo Jiménez', 'Server', 12.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('ff88998f-d272-4a35-9bfc-d25ff469ee2f', '513b91a7-48bc-4a36-abe9-7d1765082ff4', NULL, 'Elena Moreno', 'Server', 12.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('ab7d2cc2-6bc6-4650-91e5-c0588340caf4', '513b91a7-48bc-4a36-abe9-7d1765082ff4', NULL, 'Jorge Álvarez', 'Server', 12.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('adfaee0d-fe25-4f61-8647-925f3d2d5d69', '513b91a7-48bc-4a36-abe9-7d1765082ff4', NULL, 'Lucía Romero', 'Server', 12.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('6f877e54-6454-440b-bdc7-9f6a6af68d49', '513b91a7-48bc-4a36-abe9-7d1765082ff4', NULL, 'Alberto Navarro', 'Server', 12.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('cf882915-620a-457e-9767-0d4cb49b5189', '513b91a7-48bc-4a36-abe9-7d1765082ff4', NULL, 'Isabel Gil', 'Server', 12.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('2c3086e7-d6d3-4109-af89-7d7ecbd0f4ec', '513b91a7-48bc-4a36-abe9-7d1765082ff4', NULL, 'Francisco Serrano', 'Server', 12.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('a1697fe3-2645-4f39-be26-28560a0c7730', '513b91a7-48bc-4a36-abe9-7d1765082ff4', NULL, 'Patricia Molina', 'Server', 12.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('09431459-47b3-463d-9b96-78fc8465fce5', '513b91a7-48bc-4a36-abe9-7d1765082ff4', NULL, 'Antonio Castro', 'Server', 12.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('cfd7fbf5-1d3c-4dcc-8e90-52e3f12b6308', '513b91a7-48bc-4a36-abe9-7d1765082ff4', NULL, 'Rosa Ortiz', 'Server', 12.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('d49ff761-8a9c-4cd3-9480-1a8226f7cfce', '513b91a7-48bc-4a36-abe9-7d1765082ff4', NULL, 'Manuel Rubio', 'Bartender', 14.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('c753a264-498b-415c-aa1a-24372be14237', '513b91a7-48bc-4a36-abe9-7d1765082ff4', NULL, 'Teresa Vega', 'Bartender', 14.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('d4f4905a-bdf6-4188-a3ff-d065ea31a29a', '513b91a7-48bc-4a36-abe9-7d1765082ff4', NULL, 'Luis Ramos', 'Bartender', 14.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('48b5c53b-080d-46a9-9698-b4213df1c5a4', '513b91a7-48bc-4a36-abe9-7d1765082ff4', NULL, 'Cristina Herrera', 'Bartender', 14.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('968ea221-ace0-4dac-be94-683f64816423', '9c501324-66e4-40e8-bfcb-7cc855f3754e', NULL, 'Jefe de Cocina Salamanca', 'Jefe de Cocina', 18.22, true, '2026-02-12T16:33:29.902784+00:00', NULL),
  ('567ec1e3-cf3b-44ed-b3b7-62c3a485beb3', '9c501324-66e4-40e8-bfcb-7cc855f3754e', NULL, 'Camarero Salamanca', 'Camarero', 13.67, true, '2026-02-12T16:33:30.013895+00:00', NULL),
  ('6218549b-b3ac-4900-8b40-0f064614ffba', '9c501324-66e4-40e8-bfcb-7cc855f3754e', NULL, 'Ayudante Cocina Salamanca', 'Ayudante Cocina', 16.9, true, '2026-02-12T16:33:30.108816+00:00', NULL),
  ('28fdd49a-4596-4b71-b15b-c2c6bfc4273f', '9469ef7a-c1b1-4314-8349-d0ea253ba483', NULL, 'Jefe de Cocina Chamberí', 'Jefe de Cocina', 19.55, true, '2026-02-12T16:33:30.208174+00:00', NULL),
  ('da9b6933-3f61-4a31-88a5-7b954bbc2fd6', '9469ef7a-c1b1-4314-8349-d0ea253ba483', NULL, 'Camarero Chamberí', 'Camarero', 12.07, true, '2026-02-12T16:33:30.303036+00:00', NULL),
  ('ff242bf1-139a-44d6-80f9-f3a8021b3dc3', '9469ef7a-c1b1-4314-8349-d0ea253ba483', NULL, 'Ayudante Cocina Chamberí', 'Ayudante Cocina', 19.29, true, '2026-02-12T16:33:30.402141+00:00', NULL),
  ('f0c5d68d-a772-4b3a-b367-89b6407617f8', 'fe0717f7-6fa7-4e5e-8467-6c9585b03022', NULL, 'Jefe de Cocina Malasaña', 'Jefe de Cocina', 18.04, true, '2026-02-12T16:33:30.502622+00:00', NULL),
  ('51792e46-ef76-4fe0-99d5-24cc151735c5', 'fe0717f7-6fa7-4e5e-8467-6c9585b03022', NULL, 'Camarero Malasaña', 'Camarero', 15.56, true, '2026-02-12T16:33:30.614647+00:00', NULL),
  ('68df1473-80bf-44df-8dc4-efc64dc21d1c', 'fe0717f7-6fa7-4e5e-8467-6c9585b03022', NULL, 'Ayudante Cocina Malasaña', 'Ayudante Cocina', 16.8, true, '2026-02-12T16:33:30.713353+00:00', NULL),
  ('7f54115a-daa4-4e91-b2e9-6c1418ea797e', '513b91a7-48bc-4a36-abe9-7d1765082ff4', NULL, 'Javier Mendoza', 'Bartender', 14.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('f098e7cd-5d4d-4112-91dc-f35441b149d2', '513b91a7-48bc-4a36-abe9-7d1765082ff4', NULL, 'Beatriz Cruz', 'Host', 11.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('c188c0d2-d50d-4342-93b4-c093283f3134', '513b91a7-48bc-4a36-abe9-7d1765082ff4', NULL, 'Raúl Delgado', 'Host', 11.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('58de59c8-470c-4c8a-a633-6995d6bb51ba', '513b91a7-48bc-4a36-abe9-7d1765082ff4', NULL, 'Sofía Vargas', 'Host', 11.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('90f1f1f4-5031-45b4-8720-d9f9ca2b28ca', '513b91a7-48bc-4a36-abe9-7d1765082ff4', NULL, 'Fernando Iglesias', 'Manager', 25.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('f95d281e-6651-44ac-a102-7558294242b3', '513b91a7-48bc-4a36-abe9-7d1765082ff4', NULL, 'Marta Cortés', 'Manager', 25.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('67a90286-e175-4fca-80ae-823250443035', '29a8c774-f155-4f22-a485-e721ad7a9347', NULL, 'Carlos García (CH)', 'Chef', 18.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('b51c3656-147f-4bbf-a8d4-b2f26c82c4ee', '29a8c774-f155-4f22-a485-e721ad7a9347', NULL, 'María López (CH)', 'Chef', 18.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('2cdd56dd-1bbb-45aa-8495-4806f22aeee7', '29a8c774-f155-4f22-a485-e721ad7a9347', NULL, 'Juan Martínez (CH)', 'Chef', 18.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('860659c5-2851-4331-9fca-df053f37dda2', '29a8c774-f155-4f22-a485-e721ad7a9347', NULL, 'Ana Torres (CH)', 'Chef', 18.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('6bd70b2b-dad8-4cb5-82fe-1d821731ac89', '29a8c774-f155-4f22-a485-e721ad7a9347', NULL, 'Pedro Sánchez (CH)', 'Chef', 18.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('c879b676-45a8-4d8d-b1f4-5999f6bddc3d', '29a8c774-f155-4f22-a485-e721ad7a9347', NULL, 'Laura Fernández (CH)', 'Chef', 18.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('e658240f-4d2c-4b6c-a5dd-93847137d372', '29a8c774-f155-4f22-a485-e721ad7a9347', NULL, 'Miguel Ruiz (CH)', 'Chef', 18.0, true, '2026-02-12T16:13:20.29777+00:00', NULL),
  ('4cb45800-e4ec-40d9-b151-3ce75643e2ed', '29a8c774-f155-4f22-a485-e721ad7a9347', NULL, 'Carmen Díaz (CH)', 'Chef', 18.0, true, '2026-02-12T16:13:20.29777+00:00', NULL);


-- =======================================================
-- SUPPLIERS
-- =======================================================
-- suppliers: EMPTY (0 rows)


-- =======================================================
-- INVENTORY_ITEMS (38 items)
-- =======================================================
-- Row count: 38
INSERT INTO inventory_items (id, group_id, name, unit, par_level, current_stock, last_cost, created_at, category) VALUES
  ('57b8690f-32b4-40c2-9a69-751221b2014a', 'e54e12d7-018e-434e-a166-d041a97854c2', 'Arroz Bomba', 'kg', 20.0, 18.8, 3.5, '2026-02-07T19:54:21.808406+00:00', 'food'),
  ('c610159b-b2c7-4824-a2af-45d6bf534d5e', 'e54e12d7-018e-434e-a166-d041a97854c2', 'Aceite de Oliva Virgen', 'L', 15.0, 4.9, 8.0, '2026-02-07T19:54:21.808406+00:00', 'food'),
  ('fe827364-313d-47bd-a34f-9484d93c18b7', 'e54e12d7-018e-434e-a166-d041a97854c2', 'Cebolla', 'kg', 25.0, 14.4, 1.5, '2026-02-07T19:54:21.808406+00:00', 'food'),
  ('2b8affb6-c359-4c30-8574-2cdf3dcf12b2', 'e54e12d7-018e-434e-a166-d041a97854c2', 'Tomate', 'kg', 20.0, 10.5, 2.5, '2026-02-07T19:54:21.808406+00:00', 'food'),
  ('df334d1b-899c-4f4d-8ed7-72c5b64b8604', 'e54e12d7-018e-434e-a166-d041a97854c2', 'Pimiento Rojo', 'kg', 10.0, 10.4, 3.0, '2026-02-07T19:54:21.808406+00:00', 'food'),
  ('f146ec4a-a0cb-4384-a064-c7f7fa1496b8', 'e54e12d7-018e-434e-a166-d041a97854c2', 'Patata', 'kg', 30.0, 29.3, 1.2, '2026-02-07T19:54:21.808406+00:00', 'food'),
  ('3e3c4fd4-56ce-4eca-aa69-6d066939f042', 'e54e12d7-018e-434e-a166-d041a97854c2', 'Ajo', 'kg', 3.0, 3.6, 8.0, '2026-02-07T19:54:21.808406+00:00', 'food'),
  ('36136165-56f0-4922-b860-efe23837f316', 'e54e12d7-018e-434e-a166-d041a97854c2', 'Perejil', 'kg', 2.0, 0.8, 4.0, '2026-02-07T19:54:21.808406+00:00', 'food'),
  ('503c2215-4f07-4583-a92d-e6abf9c94080', 'e54e12d7-018e-434e-a166-d041a97854c2', 'Lechuga', 'ud', 15.0, 10.8, 1.8, '2026-02-07T19:54:21.808406+00:00', 'food'),
  ('508c5042-9685-403e-834d-1fadea0681fd', 'e54e12d7-018e-434e-a166-d041a97854c2', 'Pollo', 'kg', 15.0, 4.9, 8.5, '2026-02-07T19:54:21.808406+00:00', 'food'),
  ('a0c89ca2-2575-4013-97c6-0549e33a9c7e', 'e54e12d7-018e-434e-a166-d041a97854c2', 'Ternera', 'kg', 8.0, 4.1, 22.0, '2026-02-07T19:54:21.808406+00:00', 'food'),
  ('927a81e2-846e-4867-a343-dd347d7c3568', 'e54e12d7-018e-434e-a166-d041a97854c2', 'Cerdo (Jamon)', 'kg', 3.0, 2.4, 65.0, '2026-02-07T19:54:21.808406+00:00', 'food'),
  ('9b073fc9-8283-40d8-99c6-abc11f84ccb6', 'e54e12d7-018e-434e-a166-d041a97854c2', 'Pulpo', 'kg', 5.0, 1.6, 28.0, '2026-02-07T19:54:21.808406+00:00', 'food'),
  ('2be5750e-969f-47fc-8153-ffbf4e79b7c2', 'e54e12d7-018e-434e-a166-d041a97854c2', 'Bacalao', 'kg', 5.0, 2.5, 18.0, '2026-02-07T19:54:21.808406+00:00', 'food'),
  ('ac763ad9-df10-48d7-9c16-ccb7fc03b685', 'e54e12d7-018e-434e-a166-d041a97854c2', 'Gambas', 'kg', 4.0, 3.8, 25.0, '2026-02-07T19:54:21.808406+00:00', 'food'),
  ('5b06dfd8-975d-41bf-a2bf-a6440ac1926e', 'e54e12d7-018e-434e-a166-d041a97854c2', 'Huevos', 'doc', 20.0, 16.9, 3.0, '2026-02-07T19:54:21.808406+00:00', 'food'),
  ('be81b1f4-4bcf-4f22-bb55-80ff203594da', 'e54e12d7-018e-434e-a166-d041a97854c2', 'Leche', 'L', 20.0, 10.4, 1.2, '2026-02-07T19:54:21.808406+00:00', 'dairy'),
  ('44cfbbb3-3db7-4d0b-8e7b-bdf59c9e167c', 'e54e12d7-018e-434e-a166-d041a97854c2', 'Nata', 'L', 8.0, 7.1, 3.5, '2026-02-07T19:54:21.808406+00:00', 'dairy'),
  ('4a765393-2056-47be-822c-1e644f179a17', 'e54e12d7-018e-434e-a166-d041a97854c2', 'Queso Manchego', 'kg', 5.0, 5.5, 14.0, '2026-02-07T19:54:21.808406+00:00', 'dairy'),
  ('3186998d-955f-4b49-9f70-bc627d5d2843', 'e54e12d7-018e-434e-a166-d041a97854c2', 'Harina', 'kg', 15.0, 4.6, 1.0, '2026-02-07T19:54:21.808406+00:00', 'food'),
  ('2cbc816d-ea32-4ffb-b924-fd1443a46725', 'e54e12d7-018e-434e-a166-d041a97854c2', 'Azucar', 'kg', 10.0, 11.1, 1.5, '2026-02-07T19:54:21.808406+00:00', 'food'),
  ('ef6f4198-24ec-43c5-9938-3e0843514fbf', 'e54e12d7-018e-434e-a166-d041a97854c2', 'Pan', 'kg', 15.0, 15.0, 2.0, '2026-02-07T19:54:21.808406+00:00', 'food'),
  ('518df562-3c40-40af-a7cf-a3c3fc9ef527', 'e54e12d7-018e-434e-a166-d041a97854c2', 'Cerveza Alhambra', 'ud', 200.0, 128.1, 0.8, '2026-02-07T19:54:21.808406+00:00', 'beverage'),
  ('d33b4fe2-6a3f-4c4c-a94d-237515406142', 'e54e12d7-018e-434e-a166-d041a97854c2', 'Vino Rioja (botella)', 'btl', 50.0, 22.8, 6.0, '2026-02-07T19:54:21.808406+00:00', 'beverage'),
  ('5b30745c-9e49-4e2a-887c-c4f7cb8872c2', 'e54e12d7-018e-434e-a166-d041a97854c2', 'Cafe Molido', 'kg', 5.0, 6.3, 12.0, '2026-02-07T19:54:21.808406+00:00', 'beverage'),
  ('64e2ad16-2bd4-4608-86c3-9804e5e49e14', 'e54e12d7-018e-434e-a166-d041a97854c2', 'Agua Mineral', 'ud', 200.0, 127.3, 0.3, '2026-02-07T19:54:21.808406+00:00', 'beverage'),
  ('dd5cb909-de5e-42d0-9019-b567863d9e35', 'e54e12d7-018e-434e-a166-d041a97854c2', 'Limon', 'kg', 8.0, 3.1, 2.5, '2026-02-07T19:54:21.808406+00:00', 'food'),
  ('fd401f9f-28ff-4bc3-8a4f-0b2e06f63adf', 'e54e12d7-018e-434e-a166-d041a97854c2', 'Azafran', 'g', 50.0, 19.8, 0.45, '2026-02-07T19:54:21.808406+00:00', 'food'),
  ('a3c27a75-5464-4b46-b1e1-04c578547109', '747d5c56-6a90-4913-9a7a-a497a3aa02e1', 'Tomate', 'kg', 25.0, 15.0, 2.5, '2026-02-12T16:33:32.595697+00:00', 'Verduras'),
  ('1fa529a5-ef7e-4182-a55a-0b8224b07ea9', '747d5c56-6a90-4913-9a7a-a497a3aa02e1', 'Cebolla', 'kg', 15.0, 8.0, 1.8, '2026-02-12T16:33:32.595697+00:00', 'Verduras'),
  ('23c22f3a-f869-4a31-886b-16be1986f60b', '747d5c56-6a90-4913-9a7a-a497a3aa02e1', 'Aceite de Oliva', 'L', 12.0, 5.0, 8.5, '2026-02-12T16:33:32.595697+00:00', 'Aceites'),
  ('036956ce-5f22-459f-9d32-582b61de9e3c', '747d5c56-6a90-4913-9a7a-a497a3aa02e1', 'Solomillo', 'kg', 10.0, 3.0, 28.0, '2026-02-12T16:33:32.595697+00:00', 'Carnes'),
  ('7cd71a34-7ea3-4003-ae44-2b8f9007659a', '747d5c56-6a90-4913-9a7a-a497a3aa02e1', 'Gambas', 'kg', 8.0, 2.0, 22.0, '2026-02-12T16:33:32.595697+00:00', 'Mariscos'),
  ('60413407-7463-45ac-bf03-15956b5cac87', '747d5c56-6a90-4913-9a7a-a497a3aa02e1', 'Vino Rioja', 'botellas', 24.0, 12.0, 9.5, '2026-02-12T16:33:32.595697+00:00', 'Bebidas'),
  ('6259d282-4526-4c42-8b0d-1ecc50833f8a', '747d5c56-6a90-4913-9a7a-a497a3aa02e1', 'Jamón Ibérico', 'kg', 5.0, 1.5, 85.0, '2026-02-12T16:33:32.595697+00:00', 'Embutidos'),
  ('a2aa9530-27bb-4c13-84cb-ab7943c46300', '747d5c56-6a90-4913-9a7a-a497a3aa02e1', 'Queso Manchego', 'kg', 8.0, 3.0, 18.0, '2026-02-12T16:33:32.595697+00:00', 'Lácteos'),
  ('86bfb974-73f7-4a84-87aa-c948f3c08fdb', '747d5c56-6a90-4913-9a7a-a497a3aa02e1', 'Patatas', 'kg', 30.0, 20.0, 1.2, '2026-02-12T16:33:32.595697+00:00', 'Verduras'),
  ('31da5881-5e15-4036-925e-ac60845e795c', '747d5c56-6a90-4913-9a7a-a497a3aa02e1', 'Pimiento Rojo', 'kg', 10.0, 4.0, 3.5, '2026-02-12T16:33:32.595697+00:00', 'Verduras');


-- =======================================================
-- LEGAL_ENTITIES (payroll)
-- =======================================================
-- Row count: 2
INSERT INTO legal_entities (id, group_id, razon_social, nif, domicilio_fiscal, cnae, created_at) VALUES
  ('8d3d6997-38c5-40c4-9698-8657a0fde48c', 'e54e12d7-018e-434e-a166-d041a97854c2', 'fardon', 'B12345678', 'calle corona austral 9, majadahobda', '5610 - restaurantes', '2026-02-09T22:26:02.491351+00:00'),
  ('6437620d-01e1-4592-862d-9ced49bded7b', '747d5c56-6a90-4913-9a7a-a497a3aa02e1', 'La Taberna Madrid SL', 'B87654321', 'Calle Gran Vía 28, 28013 Madrid', '5610 - Restaurantes y puestos de comidas', '2026-02-13T20:51:27.607037+00:00');


-- =======================================================
-- CDM_LOCATIONS (POS→CDM mapping)
-- =======================================================
-- Row count: 2
INSERT INTO cdm_locations (id, org_id, name, address, timezone, external_provider, external_id, metadata, created_at, updated_at) VALUES
  ('1da34343-7c32-45bc-8847-dae6fa79d2ee', '5a4ad6ad-e9f4-4fa3-a0be-17e08c9d23a3', 'Default Test Account', 'Av. Puerta de Hierro', 'UTC', 'square', 'LKYEHJZ5Z2BES', '{"country": "ES", "currency": "EUR", "business_name": "Default Test Account"}'::jsonb, '2026-02-10T21:39:54.777012+00:00', '2026-02-10T21:39:54.777012+00:00'),
  ('919fb3a9-c0fb-4759-ad38-6258c43199c0', '5a4ad6ad-e9f4-4fa3-a0be-17e08c9d23a3', 'Josephine', NULL, 'Africa/Lagos', 'square', 'L0EE0YG11ZYMT', '{"country": "ES", "currency": "EUR", "business_name": "Josephine"}'::jsonb, '2026-02-11T19:46:22.543224+00:00', '2026-02-11T19:46:22.543224+00:00');


-- =======================================================
-- PRODUCTS (first 50 of 1087)
-- =======================================================
-- Row count: 50
INSERT INTO products (id, location_id, name, category, is_active, group_id, created_at, kds_destination, target_prep_time, price, image_url, description) VALUES
  ('35c55796-f58d-4c29-a975-b79e3ab5f218', NULL, 'Hamburguesa Clasica', 'Food', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-09T14:40:30.364371+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('c87b1a20-006f-4fa8-acba-09a1f674f6f7', NULL, 'Hamburguesa Gourmet', 'Food', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-09T14:40:30.364371+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('2fca390c-e4b1-4722-9ecb-1faf0132d976', NULL, 'Pizza Margherita', 'Food', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-09T14:40:30.364371+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('e0b83f4c-0cd6-4459-835d-297c33930b34', NULL, 'Pizza Pepperoni', 'Food', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-09T14:40:30.364371+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('df9ebf31-4a91-4730-b549-bbbd70ddaf5a', NULL, 'Ensalada Caesar', 'Food', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-09T14:40:30.364371+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('34d0f0e8-d4ba-4d25-8b61-69aea2729725', NULL, 'Ensalada Mediterranea', 'Food', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-09T14:40:30.364371+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('1318c414-7f8c-4612-8295-26764c7ee309', NULL, 'Pasta Carbonara', 'Food', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-09T14:40:30.364371+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('96412f4e-0fcd-4be6-aab4-cc68e5e188ac', NULL, 'Pasta Bolognesa', 'Food', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-09T14:40:30.364371+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('0a24af75-c334-4e87-b63e-ed6393ec44fd', NULL, 'Salmon a la Plancha', 'Food', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-09T14:40:30.364371+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('1984c574-e5e3-4f11-a478-6056ae76cd58', NULL, 'Pollo al Horno', 'Food', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-09T14:40:30.364371+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('ed03be55-124e-4699-bd07-f4fc20990c35', NULL, 'Tacos de Ternera', 'Food', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-09T14:40:30.364371+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('cd3386b4-a667-441f-804c-a828c3045505', NULL, 'Nachos con Guacamole', 'Food', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-09T14:40:30.364371+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('48724d63-7556-49ea-b800-d67d4d528e59', NULL, 'Wrap de Pollo', 'Food', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-09T14:40:30.364371+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('81db80a4-e3dc-4683-928e-1b302846d811', NULL, 'Bowl de Poke', 'Food', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-09T14:40:30.364371+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('07df27af-6ccc-4766-950f-37bd368ef110', NULL, 'Patatas Bravas', 'Food', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-09T14:40:30.364371+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('99a98c99-6f1d-434e-a0e9-a0608e01e43d', NULL, 'Croquetas Jamon', 'Food', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-09T14:40:30.364371+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('795ab63d-1768-4dba-a36d-ec55442c7e4f', NULL, 'Coca-Cola', 'Beverage', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-09T14:40:30.364371+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('bccd06ab-037c-4a82-9b08-5ba9d5171a12', NULL, 'Agua Mineral', 'Beverage', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-09T14:40:30.364371+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('79d5676c-5773-4058-b95c-3d128fcf6676', NULL, 'Cerveza Artesana', 'Beverage', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-09T14:40:30.364371+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('eb62f1bc-fbe1-4cfa-8159-f9f7e1f5743b', NULL, 'Vino Tinto Copa', 'Beverage', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-09T14:40:30.364371+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('be787b6f-ef38-4cde-99bf-3806c14cc85e', NULL, 'Limonada Natural', 'Beverage', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-09T14:40:30.364371+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('e7371ed2-b93d-43ae-81be-7a119bf41725', NULL, 'Cafe Espresso', 'Beverage', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-09T14:40:30.364371+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('5d04e5c8-3015-45d4-978e-0567c1e59163', NULL, 'Zumo de Naranja', 'Beverage', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-09T14:40:30.364371+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('941ca318-349f-4892-ad4e-ba3bdf3b38fe', NULL, 'Tarta de Queso', 'Dessert', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-09T14:40:30.364371+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('74344bdb-4734-4457-90e3-c360e377162b', NULL, 'Brownie con Helado', 'Dessert', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-09T14:40:30.364371+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('88e92bca-be21-46a6-90b0-0f4091a8dab4', NULL, 'Helado Artesano', 'Dessert', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-09T14:40:30.364371+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('0a03009e-d6d4-4707-a746-0e2013df4a10', NULL, 'Café Espresso', 'Other', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-11T19:54:29.31435+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('bc427836-4be6-4bc6-83fa-506e714808c5', NULL, 'Café Latte', 'Other', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-11T19:54:29.31435+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('1ef2fedf-29b9-4f11-af05-94da673152e9', NULL, 'Copa de Vino Tinto', 'Other', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-11T19:54:29.31435+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('268d7a1d-6412-4689-ba91-525cc93cbdd5', NULL, 'Croquetas de Jamón (6 uds)', 'Other', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-11T19:54:29.31435+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('56ca834f-b87c-4d30-a4a8-23e93cce303e', NULL, 'Ensalada César', 'Other', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-11T19:54:29.31435+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('e4676c5b-b508-4ca3-8356-b65c006e4d65', NULL, 'Huevos Rotos con Jamón', 'Other', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-11T19:54:29.31435+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('e0d22bbc-1a84-4085-9540-a34f89ca1acb', NULL, 'Lubina a la Plancha', 'Other', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-11T19:54:29.31435+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('36d832e5-7fb4-4f79-b66a-b90d9adacd30', NULL, 'Risotto de Setas', 'Other', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-11T19:54:29.31435+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('c923194f-9a9b-4af4-93a4-6a249c25a0a2', NULL, 'Solomillo de Ternera', 'Other', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-11T19:54:29.31435+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('a8e3eecd-f830-441a-9136-b11ba742426b', NULL, 'Tiramisú', 'Other', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-11T19:54:29.31435+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('ff787ab7-b1dd-4f78-818f-d78b4cd1c782', NULL, 'Tostada de Aguacate', 'Other', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-11T19:54:29.31435+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('6968c939-8d0a-4e39-a22c-46dcb7b45432', NULL, 'Zumo de Naranja Natural', 'Other', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-11T19:54:29.31435+00:00', 'kitchen', NULL, 10.0, NULL, NULL),
  ('a0928c64-b962-4b80-9197-69e4abdbafe9', NULL, 'Paella Valenciana', 'Food', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-07T19:54:21.364859+00:00', 'kitchen', NULL, 24.5, NULL, NULL),
  ('c8cbee04-641c-4881-87df-3e8370294e84', NULL, 'Jamon Iberico', 'Food', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-07T19:54:21.364859+00:00', 'kitchen', NULL, 18.9, NULL, NULL),
  ('75418dd6-07ef-4ae2-84c2-c2a37fc6f4d7', NULL, 'Chuleton de Buey', 'Food', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-07T19:54:21.364859+00:00', 'kitchen', NULL, 38.5, NULL, NULL),
  ('6a138a44-ce99-4141-adfa-267cde057f64', NULL, 'Pulpo a la Gallega', 'Food', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-07T19:54:21.364859+00:00', 'kitchen', NULL, 22.8, NULL, NULL),
  ('8d9adf20-83cc-4906-b5bf-4aedff2f116e', NULL, 'Bacalao Pil-Pil', 'Food', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-07T19:54:21.364859+00:00', 'kitchen', NULL, 26.5, NULL, NULL),
  ('ffce5152-eb1b-4822-87a0-90d29457f228', NULL, 'Tortilla Espanola', 'Food', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-07T19:54:21.364859+00:00', 'kitchen', NULL, 12.5, NULL, NULL),
  ('d965696d-ecb6-483c-ac5a-3974abbb3cf5', NULL, 'Croquetas de Jamon', 'Food', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-07T19:54:21.364859+00:00', 'kitchen', NULL, 9.8, NULL, NULL),
  ('8a9d02a6-17a3-498c-95de-95cfb0ff5cc6', NULL, 'Ensalada Mixta', 'Food', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-07T19:54:21.364859+00:00', 'kitchen', NULL, 11.5, NULL, NULL),
  ('2fbc0c75-1c8a-401e-8379-2ab850a71dbe', NULL, 'Patatas Bravas', 'Food', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-07T19:54:21.364859+00:00', 'kitchen', NULL, 8.5, NULL, NULL),
  ('36ce5611-da98-41bc-9aa5-97755fb4717d', NULL, 'Gazpacho Andaluz', 'Food', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-07T19:54:21.364859+00:00', 'kitchen', NULL, 9.0, NULL, NULL),
  ('e39038ee-8c09-4b3f-a43a-d673922cc574', NULL, 'Rioja Reserva', 'Beverage', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-07T19:54:21.364859+00:00', 'kitchen', NULL, 28.0, NULL, NULL),
  ('688d4c65-fe19-4062-873d-d9e7b785b5bb', NULL, 'Cerveza Alhambra', 'Beverage', true, 'e54e12d7-018e-434e-a166-d041a97854c2', '2026-02-07T19:54:21.364859+00:00', 'kitchen', NULL, 4.5, NULL, NULL);


-- =======================================================
-- KPI_ALERT_THRESHOLDS
-- =======================================================
-- kpi_alert_thresholds: EMPTY (0 rows)


-- =======================================================
-- ORG_SETTINGS
-- =======================================================
-- org_settings: EMPTY (0 rows)



-- ============================================================
-- ROW COUNTS & DATE RANGES: high-volume tables
-- ============================================================
--
-- ai_forecasts                          0 rows
-- ai_recommendations                    0 rows
-- budgets_daily                         0 rows
-- cash_counts_daily                     8 rows (2026-02-13 → 2026-02-14)
-- cdm_items                            41 rows
-- cdm_location_items                    0 rows
-- cdm_order_lines                    2512 rows
-- cdm_orders                         1018 rows (2026-02-10 → 2026-02-13)
-- cdm_payments                          0 rows
-- cogs_daily                            8 rows (2026-02-13 → 2026-02-14)
-- employee_clock_records                0 rows
-- facts_inventory_daily                 0 rows
-- facts_item_mix_daily                  0 rows
-- facts_labor_daily                    87 rows (2026-01-13 → 2026-02-10)
-- facts_sales_15m                    4872 rows (2026-01-13 → 2026-02-10)
-- forecast_daily_metrics             1460 rows (2026-02-14 → 2027-02-13)
-- forecast_hourly_metrics               0 rows
-- integration_sync_runs               116 rows (2026-02-10 → 2026-02-13)
-- labour_daily                          8 rows (2026-02-13 → 2026-02-14)
-- payments                              0 rows
-- planned_shifts                      503 rows (2026-01-14 → 2026-02-12)
-- pos_daily_finance                    12 rows (2026-02-10 → 2026-02-14)
-- product_sales_daily               16875 rows (2026-01-13 → 2026-02-13)
-- raw_events                            0 rows
-- sales_daily_unified                  12 rows (2026-02-10 → 2026-02-14)
-- stock_movements                       0 rows
-- ticket_lines                          0 rows
-- tickets                            5380 rows (2026-01-14 → 2026-02-12)
-- timesheets                          471 rows (2026-01-14 → 2026-02-12)
-- waste_events                          1 rows (2026-02-13 → 2026-02-13)


-- ============================================================
-- DIAGNOSTIC SUMMARY
-- ============================================================
--
-- EMPTY TABLES (0 rows) — potential gaps:
--   location_settings        → No per-location config (target GP, hours, SPLH)
--   user_locations            → No user↔location mapping (RBAC scoping broken?)
--   suppliers                 → No suppliers (procurement features non-functional)
--   kpi_alert_thresholds      → No alert thresholds configured
--   report_subscriptions      → No report subscriptions
--   org_settings              → No org-level settings
--   budgets_daily             → No daily budgets
--   ai_forecasts              → No AI forecast records
--   ai_recommendations        → No AI recommendations
--   cdm_payments              → CDM payments not populated
--   cdm_location_items        → CDM location items not linked
--   facts_item_mix_daily      → Item mix aggregation empty
--   facts_inventory_daily     → Inventory aggregation empty
--   forecast_hourly_metrics   → Hourly forecasts empty
--   employee_clock_records    → No clock-in/out records
--   payments                  → POS payments table empty
--   raw_events                → No raw webhook events stored
--   stock_movements           → No stock movement history
--
-- DATE GAP ISSUES:
--   facts_sales_15m:    ends 2026-02-10 (4 days stale!)
--   facts_labor_daily:  ends 2026-02-10 (4 days stale!)
--   tickets:            ends 2026-02-12 (2 days stale)
--   planned_shifts:     ends 2026-02-12 (2 days stale)
--   timesheets:         ends 2026-02-12 (2 days stale)
--   product_sales_daily: ends 2026-02-13 (1 day stale)
--   cdm_orders:         ends 2026-02-13 (1 day stale)
--   sync_runs:          ends 2026-02-13 (1 day stale, sync may have stopped)
--
-- SQUARE INTEGRATION:
--   22 integrations found, 22 integration_accounts
--   cdm_locations: only 2 mapped
--   cdm_orders: 1018 orders (Feb 10-13 only)
--   CDM pipeline appears partially working but stalled
