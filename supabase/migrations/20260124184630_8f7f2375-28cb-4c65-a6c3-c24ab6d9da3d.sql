-- =============================================
-- LOYALTY PROGRAM SCHEMA (Fixed RLS)
-- =============================================

-- Loyalty program settings per group
CREATE TABLE IF NOT EXISTS public.loyalty_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT false,
  points_per_euro numeric NOT NULL DEFAULT 1,
  welcome_bonus integer NOT NULL DEFAULT 50,
  tier_rules jsonb NOT NULL DEFAULT '{
    "bronze": {"min_points": 0, "multiplier": 1},
    "silver": {"min_points": 500, "multiplier": 1.25},
    "gold": {"min_points": 2000, "multiplier": 1.5},
    "platinum": {"min_points": 5000, "multiplier": 2}
  }'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(group_id)
);

-- Loyalty members (customers)
CREATE TABLE IF NOT EXISTS public.loyalty_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  email text,
  phone text,
  name text NOT NULL,
  points_balance integer NOT NULL DEFAULT 0,
  lifetime_points integer NOT NULL DEFAULT 0,
  tier text NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT loyalty_members_contact_check CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_members_group ON public.loyalty_members(group_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_members_email ON public.loyalty_members(email);
CREATE INDEX IF NOT EXISTS idx_loyalty_members_phone ON public.loyalty_members(phone);

-- Loyalty rewards catalog
CREATE TABLE IF NOT EXISTS public.loyalty_rewards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  points_cost integer NOT NULL CHECK (points_cost > 0),
  reward_type text NOT NULL DEFAULT 'discount' CHECK (reward_type IN ('discount', 'free_item', 'percentage', 'experience')),
  value numeric,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  max_redemptions integer,
  current_redemptions integer NOT NULL DEFAULT 0,
  valid_from date,
  valid_until date,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_group ON public.loyalty_rewards(group_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_active ON public.loyalty_rewards(is_active) WHERE is_active = true;

-- Loyalty transactions
CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid NOT NULL REFERENCES public.loyalty_members(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  points integer NOT NULL,
  type text NOT NULL CHECK (type IN ('earned', 'redeemed', 'bonus', 'adjustment', 'expired')),
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_member ON public.loyalty_transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_created ON public.loyalty_transactions(created_at DESC);

-- Loyalty redemptions
CREATE TABLE IF NOT EXISTS public.loyalty_redemptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid NOT NULL REFERENCES public.loyalty_members(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES public.loyalty_rewards(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  points_used integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'cancelled')),
  code text,
  redeemed_at timestamp with time zone NOT NULL DEFAULT now(),
  applied_at timestamp with time zone
);

CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_member ON public.loyalty_redemptions(member_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_status ON public.loyalty_redemptions(status);

-- Enable RLS
ALTER TABLE public.loyalty_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_redemptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies (using auth.uid() explicitly)
CREATE POLICY "Users can view loyalty settings"
ON public.loyalty_settings FOR SELECT
USING (group_id = get_user_group_id());

CREATE POLICY "Admins can manage loyalty settings"
ON public.loyalty_settings FOR ALL
USING (group_id = get_user_group_id() AND is_owner_or_admin(auth.uid()))
WITH CHECK (group_id = get_user_group_id() AND is_owner_or_admin(auth.uid()));

CREATE POLICY "Users can view loyalty members"
ON public.loyalty_members FOR SELECT
USING (group_id = get_user_group_id());

CREATE POLICY "Admins can manage loyalty members"
ON public.loyalty_members FOR ALL
USING (group_id = get_user_group_id() AND is_admin_or_ops(auth.uid()))
WITH CHECK (group_id = get_user_group_id() AND is_admin_or_ops(auth.uid()));

CREATE POLICY "Users can view loyalty rewards"
ON public.loyalty_rewards FOR SELECT
USING (group_id = get_user_group_id());

CREATE POLICY "Admins can manage loyalty rewards"
ON public.loyalty_rewards FOR ALL
USING (group_id = get_user_group_id() AND is_owner_or_admin(auth.uid()))
WITH CHECK (group_id = get_user_group_id() AND is_owner_or_admin(auth.uid()));

CREATE POLICY "Users can view loyalty transactions"
ON public.loyalty_transactions FOR SELECT
USING (member_id IN (SELECT id FROM loyalty_members WHERE group_id = get_user_group_id()));

CREATE POLICY "Users can insert loyalty transactions"
ON public.loyalty_transactions FOR INSERT
WITH CHECK (member_id IN (SELECT id FROM loyalty_members WHERE group_id = get_user_group_id()));

CREATE POLICY "Users can view loyalty redemptions"
ON public.loyalty_redemptions FOR SELECT
USING (member_id IN (SELECT id FROM loyalty_members WHERE group_id = get_user_group_id()));

CREATE POLICY "Users can manage loyalty redemptions"
ON public.loyalty_redemptions FOR ALL
USING (member_id IN (SELECT id FROM loyalty_members WHERE group_id = get_user_group_id()));

-- Helper functions
CREATE OR REPLACE FUNCTION public.calculate_loyalty_tier(p_lifetime_points integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_lifetime_points >= 5000 THEN 'platinum'
    WHEN p_lifetime_points >= 2000 THEN 'gold'
    WHEN p_lifetime_points >= 500 THEN 'silver'
    ELSE 'bronze'
  END;
$$;

CREATE OR REPLACE FUNCTION public.add_loyalty_points(
  p_member_id uuid,
  p_points integer,
  p_type text,
  p_description text DEFAULT NULL,
  p_location_id uuid DEFAULT NULL,
  p_ticket_id uuid DEFAULT NULL
)
RETURNS public.loyalty_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_member loyalty_members%ROWTYPE;
  v_new_balance integer;
  v_new_lifetime integer;
  v_new_tier text;
BEGIN
  SELECT * INTO v_member FROM loyalty_members WHERE id = p_member_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;
  
  IF p_type IN ('earned', 'bonus', 'adjustment') THEN
    v_new_balance := v_member.points_balance + p_points;
    v_new_lifetime := GREATEST(v_member.lifetime_points, v_member.lifetime_points + GREATEST(p_points, 0));
  ELSIF p_type = 'redeemed' THEN
    v_new_balance := v_member.points_balance - ABS(p_points);
    v_new_lifetime := v_member.lifetime_points;
  ELSE
    v_new_balance := v_member.points_balance + p_points;
    v_new_lifetime := v_member.lifetime_points;
  END IF;
  
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient points balance';
  END IF;
  
  v_new_tier := calculate_loyalty_tier(v_new_lifetime);
  
  INSERT INTO loyalty_transactions (member_id, location_id, ticket_id, points, type, description)
  VALUES (p_member_id, p_location_id, p_ticket_id, 
          CASE WHEN p_type = 'redeemed' THEN -ABS(p_points) ELSE p_points END, 
          p_type, p_description);
  
  UPDATE loyalty_members
  SET points_balance = v_new_balance,
      lifetime_points = v_new_lifetime,
      tier = v_new_tier,
      updated_at = now()
  WHERE id = p_member_id
  RETURNING * INTO v_member;
  
  RETURN v_member;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_loyalty_reward(
  p_member_id uuid,
  p_reward_id uuid,
  p_location_id uuid DEFAULT NULL
)
RETURNS public.loyalty_redemptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reward loyalty_rewards%ROWTYPE;
  v_member loyalty_members%ROWTYPE;
  v_redemption loyalty_redemptions%ROWTYPE;
  v_code text;
BEGIN
  SELECT * INTO v_reward FROM loyalty_rewards WHERE id = p_reward_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reward not found';
  END IF;
  
  IF NOT v_reward.is_active THEN
    RAISE EXCEPTION 'Reward is not active';
  END IF;
  
  IF v_reward.valid_from IS NOT NULL AND CURRENT_DATE < v_reward.valid_from THEN
    RAISE EXCEPTION 'Reward not yet valid';
  END IF;
  IF v_reward.valid_until IS NOT NULL AND CURRENT_DATE > v_reward.valid_until THEN
    RAISE EXCEPTION 'Reward has expired';
  END IF;
  
  IF v_reward.max_redemptions IS NOT NULL AND v_reward.current_redemptions >= v_reward.max_redemptions THEN
    RAISE EXCEPTION 'Reward redemption limit reached';
  END IF;
  
  SELECT * INTO v_member FROM loyalty_members WHERE id = p_member_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;
  
  IF v_member.points_balance < v_reward.points_cost THEN
    RAISE EXCEPTION 'Insufficient points. Need %, have %', v_reward.points_cost, v_member.points_balance;
  END IF;
  
  v_code := upper(substring(md5(random()::text) from 1 for 8));
  
  INSERT INTO loyalty_redemptions (member_id, reward_id, location_id, points_used, code)
  VALUES (p_member_id, p_reward_id, p_location_id, v_reward.points_cost, v_code)
  RETURNING * INTO v_redemption;
  
  PERFORM add_loyalty_points(p_member_id, v_reward.points_cost, 'redeemed', 
                             'Canjeado: ' || v_reward.name, p_location_id);
  
  UPDATE loyalty_rewards SET current_redemptions = current_redemptions + 1
  WHERE id = p_reward_id;
  
  RETURN v_redemption;
END;
$$;