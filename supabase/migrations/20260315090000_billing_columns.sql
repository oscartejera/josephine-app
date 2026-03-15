-- Migration: Add billing columns to the underlying orgs table
-- and update the groups view to expose them.
-- groups is a VIEW (SELECT id, name FROM orgs), not a base table.

-- Add columns (IF NOT EXISTS prevents errors if already present)
alter table orgs
  add column if not exists plan text not null default 'free',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text not null default 'none';

-- Constraints (drop first to avoid duplicate errors)
alter table orgs drop constraint if exists orgs_plan_check;
alter table orgs add constraint orgs_plan_check
  check (plan in ('free', 'pro', 'enterprise'));

alter table orgs drop constraint if exists orgs_subscription_status_check;
alter table orgs add constraint orgs_subscription_status_check
  check (subscription_status in ('none','active','past_due','canceled','trialing','incomplete','paused'));

-- Index on stripe_customer_id for webhook lookups
create index if not exists idx_orgs_stripe_customer
  on orgs (stripe_customer_id)
  where stripe_customer_id is not null;

-- Recreate the groups view to include billing columns
create or replace view groups as
select id, name, plan, stripe_customer_id, stripe_subscription_id, subscription_status
from orgs;

-- Column comments on the base table
comment on column orgs.plan is 'Current billing plan: free | pro | enterprise';
comment on column orgs.stripe_customer_id is 'Stripe customer ID (cus_xxx)';
comment on column orgs.stripe_subscription_id is 'Stripe subscription ID (sub_xxx)';
comment on column orgs.subscription_status is 'Stripe subscription status mirror';
