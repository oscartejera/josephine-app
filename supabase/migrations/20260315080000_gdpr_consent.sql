-- GDPR Consent & Data Privacy
-- Tracks user consent preferences and deletion requests

-- ─── consent_records ─────────────────────────────────────────────────────────
create table if not exists public.consent_records (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  -- anonymous consent (before login) identified by fingerprint
  anonymous_id text,
  consent_type text not null check (consent_type in ('essential','analytics','marketing')),
  granted     boolean not null default false,
  granted_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index idx_consent_user on public.consent_records(user_id) where user_id is not null;
create index idx_consent_anon on public.consent_records(anonymous_id) where anonymous_id is not null;

alter table public.consent_records enable row level security;

create policy "Users can view own consent"
  on public.consent_records for select
  using (auth.uid() = user_id);

create policy "Users can manage own consent"
  on public.consent_records for insert
  with check (auth.uid() = user_id or user_id is null);

create policy "Users can update own consent"
  on public.consent_records for update
  using (auth.uid() = user_id);

-- ─── deletion_requests ───────────────────────────────────────────────────────
create table if not exists public.deletion_requests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  requested_at   timestamptz not null default now(),
  scheduled_for  timestamptz not null default (now() + interval '30 days'),
  status         text not null default 'pending'
                   check (status in ('pending','confirmed','processing','completed','cancelled')),
  reason         text,
  completed_at   timestamptz,
  created_at     timestamptz not null default now()
);

create unique index idx_deletion_active on public.deletion_requests(user_id)
  where status in ('pending','confirmed','processing');

alter table public.deletion_requests enable row level security;

create policy "Users can view own deletion requests"
  on public.deletion_requests for select
  using (auth.uid() = user_id);

create policy "Users can create deletion requests"
  on public.deletion_requests for insert
  with check (auth.uid() = user_id);

create policy "Users can cancel own deletion requests"
  on public.deletion_requests for update
  using (auth.uid() = user_id and status = 'pending');
