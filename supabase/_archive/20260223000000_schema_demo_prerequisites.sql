-- ============================================================
-- Schema: Demo Prerequisites
-- Creates tables needed for full demo data seeding that
-- don't yet exist in the production schema.
-- All CREATE TABLE IF NOT EXISTS — purely additive.
-- ============================================================

-- ============================================================
-- 1. reviews (does NOT exist yet)
-- ============================================================

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  location_id uuid NOT NULL,
  platform text NOT NULL DEFAULT 'google',
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text text,
  reviewer_name text,
  sentiment text,
  review_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_loc_date
  ON reviews (location_id, review_date);

GRANT SELECT ON reviews TO anon, authenticated;
GRANT ALL ON reviews TO service_role;

-- ============================================================
-- 2. announcements (does NOT exist yet)
-- ============================================================

CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  location_id uuid,
  title text NOT NULL,
  body text,
  type text NOT NULL DEFAULT 'info',
  pinned boolean NOT NULL DEFAULT false,
  author_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON announcements TO anon, authenticated;
GRANT ALL ON announcements TO service_role;

-- ============================================================
-- 3. payslip_lines (does NOT exist yet)
-- ============================================================

CREATE TABLE IF NOT EXISTS payslip_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payslip_id uuid NOT NULL REFERENCES payslips(id),
  concept_code text NOT NULL,
  description text,
  amount numeric NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'earning'
);

GRANT SELECT ON payslip_lines TO anon, authenticated;
GRANT ALL ON payslip_lines TO service_role;
