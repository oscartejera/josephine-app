-- Add author_name column to announcements table
-- The Swift app expects author_name as a text field
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS author_name text;

-- Seed announcements for demo/production
-- org_id comes from the groups table (the organization)
INSERT INTO announcements (org_id, title, body, type, pinned, author_name, created_at)
SELECT
  g.id,
  'Bienvenidos a Josephine Team',
  'Ya puedes consultar tus turnos, fichar y ver tu nomina desde la app. Gracias por ser parte del equipo!',
  'celebration',
  true,
  'Oscar Tejera',
  now() - interval '2 hours'
FROM groups g LIMIT 1;

INSERT INTO announcements (org_id, title, body, type, pinned, author_name, created_at)
SELECT
  g.id,
  'Nuevo horario de verano',
  'A partir del 1 de abril, el horario del restaurante sera de 12:00 a 00:00. Consulta tu turno actualizado en la pestana Horario.',
  'schedule',
  false,
  'Oscar Tejera',
  now() - interval '1 hour'
FROM groups g LIMIT 1;

INSERT INTO announcements (org_id, title, body, type, pinned, author_name, created_at)
SELECT
  g.id,
  'Formacion obligatoria: Alergenos',
  'Recordad que el viernes 28 de marzo hay formacion de alergenos de 10:00 a 12:00. Es obligatorio para todo el personal de sala y cocina.',
  'important',
  false,
  'Oscar Tejera',
  now() - interval '30 minutes'
FROM groups g LIMIT 1;
