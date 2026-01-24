import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, Star, Gift, User, X, Check, Loader2, 
  Crown, Award, Medal, Trophy, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

export interface LoyaltyMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  points_balance: number;
  lifetime_points: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
}

export interface LoyaltyReward {
  id: string;
  name: string;
  description: string | null;
  points_cost: number;
  reward_type: 'discount' | 'free_item' | 'percentage' | 'experience';
  value: number | null;
  is_active: boolean;
}

interface POSLoyaltyPanelProps {
  groupId: string;
  locationId: string;
  ticketTotal: number;
  pointsPerEuro: number;
  selectedMember: LoyaltyMember | null;
  selectedReward: LoyaltyReward | null;
  onMemberSelect: (member: LoyaltyMember | null) => void;
  onRewardSelect: (reward: LoyaltyReward | null) => void;
}

const TIER_CONFIG = {
  bronze: { icon: Medal, color: 'text-orange-600 bg-orange-500/20', label: 'Bronce' },
  silver: { icon: Award, color: 'text-slate-400 bg-slate-400/20', label: 'Plata' },
  gold: { icon: Crown, color: 'text-yellow-500 bg-yellow-500/20', label: 'Oro' },
  platinum: { icon: Trophy, color: 'text-purple-400 bg-purple-400/20', label: 'Platino' },
};

export function POSLoyaltyPanel({
  groupId,
  locationId,
  ticketTotal,
  pointsPerEuro,
  selectedMember,
  selectedReward,
  onMemberSelect,
  onRewardSelect,
}: POSLoyaltyPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LoyaltyMember[]>([]);
  const [availableRewards, setAvailableRewards] = useState<LoyaltyReward[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingRewards, setLoadingRewards] = useState(false);

  // Calculate points to earn
  const pointsToEarn = Math.floor(ticketTotal * pointsPerEuro);

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.length < 3) return;
    
    setSearching(true);
    try {
      const { data } = await supabase
        .from('loyalty_members')
        .select('*')
        .eq('group_id', groupId)
        .or(`email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`)
        .limit(5);

      setSearchResults((data || []) as unknown as LoyaltyMember[]);
    } catch (error) {
      console.error('Error searching members:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleMemberSelect = async (member: LoyaltyMember) => {
    onMemberSelect(member);
    setSearchResults([]);
    setSearchQuery('');
    
    // Load available rewards for this member
    setLoadingRewards(true);
    try {
      const { data } = await supabase
        .from('loyalty_rewards')
        .select('*')
        .eq('group_id', groupId)
        .eq('is_active', true)
        .lte('points_cost', member.points_balance)
        .order('points_cost', { ascending: true });

      setAvailableRewards((data || []) as unknown as LoyaltyReward[]);
    } catch (error) {
      console.error('Error loading rewards:', error);
    } finally {
      setLoadingRewards(false);
    }
  };

  const clearMember = () => {
    onMemberSelect(null);
    onRewardSelect(null);
    setAvailableRewards([]);
  };

  const TierIcon = selectedMember ? TIER_CONFIG[selectedMember.tier].icon : Star;

  return (
    <div className="space-y-3 p-3 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border border-primary/20">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="font-medium text-sm">Programa de Fidelización</span>
      </div>

      {/* Member Search or Selected Member */}
      {!selectedMember ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Email, teléfono o nombre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-8 h-9"
              />
            </div>
            <Button 
              size="sm" 
              onClick={handleSearch}
              disabled={searching || searchQuery.length < 3}
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
            </Button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="border rounded-lg bg-background divide-y">
              {searchResults.map((member) => {
                const tierConfig = TIER_CONFIG[member.tier];
                const MemberTierIcon = tierConfig.icon;
                
                return (
                  <button
                    key={member.id}
                    onClick={() => handleMemberSelect(member)}
                    className="w-full p-2 flex items-center gap-3 hover:bg-muted transition-colors text-left"
                  >
                    <div className={cn("p-1.5 rounded-full", tierConfig.color)}>
                      <MemberTierIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{member.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {member.email || member.phone}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-primary">{member.points_balance} pts</p>
                      <p className="text-xs text-muted-foreground">{tierConfig.label}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {searchResults.length === 0 && searchQuery.length >= 3 && !searching && (
            <p className="text-xs text-muted-foreground text-center py-2">
              No se encontraron clientes
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Selected Member Card */}
          <div className="flex items-center gap-3 p-2 bg-background rounded-lg border">
            <div className={cn("p-2 rounded-full", TIER_CONFIG[selectedMember.tier].color)}>
              <TierIcon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold truncate">{selectedMember.name}</p>
                <Badge variant="outline" className="text-xs">
                  {TIER_CONFIG[selectedMember.tier].label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {selectedMember.email || selectedMember.phone}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={clearMember} className="shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Points Display */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-background rounded-lg p-2 text-center border">
              <p className="text-xs text-muted-foreground">Puntos disponibles</p>
              <p className="text-lg font-bold text-primary">{selectedMember.points_balance}</p>
            </div>
            <div className="bg-emerald-500/10 rounded-lg p-2 text-center border border-emerald-500/30">
              <p className="text-xs text-emerald-600">Puntos a ganar</p>
              <p className="text-lg font-bold text-emerald-600">+{pointsToEarn}</p>
            </div>
          </div>

          {/* Available Rewards */}
          {loadingRewards ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : availableRewards.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium flex items-center gap-1">
                <Gift className="h-3 w-3" />
                Recompensas canjeables
              </p>
              <ScrollArea className="h-28">
                <div className="space-y-1.5">
                  {availableRewards.map((reward) => (
                    <button
                      key={reward.id}
                      onClick={() => onRewardSelect(selectedReward?.id === reward.id ? null : reward)}
                      className={cn(
                        "w-full p-2 rounded-lg border text-left transition-all flex items-center gap-2",
                        selectedReward?.id === reward.id
                          ? "bg-primary/10 border-primary ring-1 ring-primary"
                          : "bg-background hover:bg-muted"
                      )}
                    >
                      <Gift className={cn(
                        "h-4 w-4 shrink-0",
                        selectedReward?.id === reward.id ? "text-primary" : "text-muted-foreground"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{reward.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {reward.reward_type === 'discount' && `€${reward.value} descuento`}
                          {reward.reward_type === 'percentage' && `${reward.value}% descuento`}
                          {reward.reward_type === 'free_item' && 'Producto gratis'}
                          {reward.reward_type === 'experience' && 'Experiencia'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-primary">{reward.points_cost}</p>
                        <p className="text-xs text-muted-foreground">pts</p>
                      </div>
                      {selectedReward?.id === reward.id && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">
              No hay recompensas disponibles con los puntos actuales
            </p>
          )}
        </div>
      )}
    </div>
  );
}
