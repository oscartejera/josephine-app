import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';

export interface LoyaltySettings {
  id: string;
  group_id: string;
  is_enabled: boolean;
  points_per_euro: number;
  welcome_bonus: number;
  tier_rules: {
    bronze: { min_points: number; multiplier: number };
    silver: { min_points: number; multiplier: number };
    gold: { min_points: number; multiplier: number };
    platinum: { min_points: number; multiplier: number };
  };
}

export interface LoyaltyMember {
  id: string;
  group_id: string;
  email: string | null;
  phone: string | null;
  name: string;
  points_balance: number;
  lifetime_points: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  notes: string | null;
  created_at: string;
}

export interface LoyaltyReward {
  id: string;
  group_id: string;
  name: string;
  description: string | null;
  points_cost: number;
  reward_type: 'discount' | 'free_item' | 'percentage' | 'experience';
  value: number | null;
  product_id: string | null;
  is_active: boolean;
  max_redemptions: number | null;
  current_redemptions: number;
  valid_from: string | null;
  valid_until: string | null;
}

export interface LoyaltyTransaction {
  id: string;
  member_id: string;
  location_id: string | null;
  ticket_id: string | null;
  points: number;
  type: 'earned' | 'redeemed' | 'bonus' | 'adjustment' | 'expired';
  description: string | null;
  created_at: string;
}

export interface LoyaltyRedemption {
  id: string;
  member_id: string;
  reward_id: string;
  location_id: string | null;
  points_used: number;
  status: 'pending' | 'applied' | 'cancelled';
  code: string | null;
  redeemed_at: string;
}

export function useLoyaltyData() {
  const { group } = useApp();
  const [settings, setSettings] = useState<LoyaltySettings | null>(null);
  const [members, setMembers] = useState<LoyaltyMember[]>([]);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!group?.id) return;

    const { data } = await supabase
      .from('loyalty_settings')
      .select('*')
      .eq('group_id', group.id)
      .single();

    if (data) {
      setSettings(data as unknown as LoyaltySettings);
    }
  }, [group?.id]);

  const fetchMembers = useCallback(async () => {
    if (!group?.id) return;

    const { data } = await supabase
      .from('loyalty_members')
      .select('*')
      .eq('group_id', group.id)
      .order('lifetime_points', { ascending: false });

    setMembers((data || []) as unknown as LoyaltyMember[]);
  }, [group?.id]);

  const fetchRewards = useCallback(async () => {
    if (!group?.id) return;

    const { data } = await supabase
      .from('loyalty_rewards')
      .select('*')
      .eq('group_id', group.id)
      .order('points_cost', { ascending: true });

    setRewards((data || []) as unknown as LoyaltyReward[]);
  }, [group?.id]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchSettings(), fetchMembers(), fetchRewards()]);
    setLoading(false);
  }, [fetchSettings, fetchMembers, fetchRewards]);

  useEffect(() => {
    if (group?.id) {
      fetchAll();
    }
  }, [group?.id, fetchAll]);

  // Settings mutations
  const updateSettings = async (updates: Partial<LoyaltySettings>) => {
    if (!group?.id) throw new Error('No group');

    // Upsert settings
    const { data, error } = await supabase
      .from('loyalty_settings')
      .upsert({
        group_id: group.id,
        ...updates,
      } as never)
      .select()
      .single();

    if (error) throw error;
    setSettings(data as unknown as LoyaltySettings);
    return data;
  };

  // Member mutations
  const createMember = async (
    data: Pick<LoyaltyMember, 'name' | 'email' | 'phone' | 'notes'>
  ) => {
    if (!group?.id) throw new Error('No group');

    const welcomeBonus = settings?.welcome_bonus || 50;

    const { data: newMember, error } = await supabase
      .from('loyalty_members')
      .insert({
        group_id: group.id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        notes: data.notes,
        points_balance: welcomeBonus,
        lifetime_points: welcomeBonus,
      } as never)
      .select()
      .single();

    if (error) throw error;

    // Create welcome bonus transaction
    if (welcomeBonus > 0) {
      await supabase.from('loyalty_transactions').insert({
        member_id: newMember.id,
        points: welcomeBonus,
        type: 'bonus',
        description: 'Bono de bienvenida',
      } as never);
    }

    await fetchMembers();
    return newMember;
  };

  const updateMember = async (id: string, updates: Partial<LoyaltyMember>) => {
    const { error } = await supabase
      .from('loyalty_members')
      .update(updates as never)
      .eq('id', id);

    if (error) throw error;
    await fetchMembers();
  };

  const deleteMember = async (id: string) => {
    const { error } = await supabase.from('loyalty_members').delete().eq('id', id);

    if (error) throw error;
    await fetchMembers();
  };

  const addPoints = async (
    memberId: string,
    points: number,
    type: 'earned' | 'bonus' | 'adjustment',
    description?: string,
    locationId?: string,
    ticketId?: string
  ) => {
    const { data, error } = await supabase.rpc('add_loyalty_points', {
      p_member_id: memberId,
      p_points: points,
      p_type: type,
      p_description: description,
      p_location_id: locationId,
      p_ticket_id: ticketId,
    });

    if (error) throw error;
    await fetchMembers();
    return data;
  };

  // Reward mutations
  const createReward = async (data: Omit<LoyaltyReward, 'id' | 'group_id' | 'current_redemptions'>) => {
    if (!group?.id) throw new Error('No group');

    const { data: newReward, error } = await supabase
      .from('loyalty_rewards')
      .insert({
        group_id: group.id,
        ...data,
      } as never)
      .select()
      .single();

    if (error) throw error;
    await fetchRewards();
    return newReward;
  };

  const updateReward = async (id: string, updates: Partial<LoyaltyReward>) => {
    const { error } = await supabase
      .from('loyalty_rewards')
      .update(updates as never)
      .eq('id', id);

    if (error) throw error;
    await fetchRewards();
  };

  const deleteReward = async (id: string) => {
    const { error } = await supabase.from('loyalty_rewards').delete().eq('id', id);

    if (error) throw error;
    await fetchRewards();
  };

  const redeemReward = async (memberId: string, rewardId: string, locationId?: string) => {
    const { data, error } = await supabase.rpc('redeem_loyalty_reward', {
      p_member_id: memberId,
      p_reward_id: rewardId,
      p_location_id: locationId,
    });

    if (error) throw error;
    await Promise.all([fetchMembers(), fetchRewards()]);
    return data;
  };

  // Search member by email or phone
  const searchMember = async (query: string): Promise<LoyaltyMember | null> => {
    if (!group?.id) return null;

    const { data } = await supabase
      .from('loyalty_members')
      .select('*')
      .eq('group_id', group.id)
      .or(`email.ilike.%${query}%,phone.ilike.%${query}%`)
      .limit(1)
      .single();

    return data as unknown as LoyaltyMember | null;
  };

  // Get member transactions
  const getMemberTransactions = async (memberId: string): Promise<LoyaltyTransaction[]> => {
    const { data } = await supabase
      .from('loyalty_transactions')
      .select('*')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .limit(50);

    return (data || []) as unknown as LoyaltyTransaction[];
  };

  // Stats
  const getStats = () => {
    const totalMembers = members.length;
    const totalPoints = members.reduce((sum, m) => sum + m.points_balance, 0);
    const tierCounts = {
      bronze: members.filter((m) => m.tier === 'bronze').length,
      silver: members.filter((m) => m.tier === 'silver').length,
      gold: members.filter((m) => m.tier === 'gold').length,
      platinum: members.filter((m) => m.tier === 'platinum').length,
    };
    const activeRewards = rewards.filter((r) => r.is_active).length;

    return { totalMembers, totalPoints, tierCounts, activeRewards };
  };

  return {
    settings,
    members,
    rewards,
    loading,
    refetch: fetchAll,
    updateSettings,
    createMember,
    updateMember,
    deleteMember,
    addPoints,
    createReward,
    updateReward,
    deleteReward,
    redeemReward,
    searchMember,
    getMemberTransactions,
    getStats,
  };
}
