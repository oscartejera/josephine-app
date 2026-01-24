import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { 
  Search, Star, Gift, User, X, Check, Loader2, 
  Crown, Award, Medal, Trophy, Sparkles, History,
  TrendingUp, TrendingDown, Zap, Settings, UserPlus, Phone, Mail
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

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

export interface LoyaltyTransaction {
  id: string;
  member_id: string;
  points: number;
  type: 'earned' | 'redeemed' | 'bonus' | 'adjustment' | 'expired';
  description: string | null;
  created_at: string;
}

interface POSLoyaltyPanelProps {
  groupId: string;
  locationId: string;
  ticketTotal: number;
  pointsPerEuro: number;
  welcomeBonus: number;
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
  welcomeBonus,
  selectedMember,
  selectedReward,
  onMemberSelect,
  onRewardSelect,
}: POSLoyaltyPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LoyaltyMember[]>([]);
  const [availableRewards, setAvailableRewards] = useState<LoyaltyReward[]>([]);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingRewards, setLoadingRewards] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [activeTab, setActiveTab] = useState<'rewards' | 'history'>('rewards');
  
  // Quick registration state
  const [showQuickRegister, setShowQuickRegister] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', phone: '' });
  const [registering, setRegistering] = useState(false);

  // Calculate points to earn
  const pointsToEarn = Math.floor(ticketTotal * pointsPerEuro);

  const TRANSACTION_CONFIG = {
    earned: { icon: TrendingUp, color: 'text-emerald-600', sign: '+', label: 'Ganados' },
    redeemed: { icon: Gift, color: 'text-primary', sign: '-', label: 'Canjeados' },
    bonus: { icon: Zap, color: 'text-amber-600', sign: '+', label: 'Bonus' },
    adjustment: { icon: Settings, color: 'text-muted-foreground', sign: '', label: 'Ajuste' },
    expired: { icon: TrendingDown, color: 'text-destructive', sign: '-', label: 'Expirados' },
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.length < 3) return;
    
    setSearching(true);
    setHasSearched(true);
    setShowQuickRegister(false);
    
    try {
      const { data } = await supabase
        .from('loyalty_members')
        .select('*')
        .eq('group_id', groupId)
        .or(`email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`)
        .limit(5);

      const results = (data || []) as unknown as LoyaltyMember[];
      setSearchResults(results);
      
      // If no results, pre-fill register form with search query
      if (results.length === 0) {
        const isEmail = searchQuery.includes('@');
        const isPhone = /^[+\d\s-]+$/.test(searchQuery);
        setRegisterForm({
          name: (!isEmail && !isPhone) ? searchQuery : '',
          email: isEmail ? searchQuery : '',
          phone: isPhone ? searchQuery : '',
        });
      }
    } catch (error) {
      console.error('Error searching members:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleQuickRegister = async () => {
    if (!registerForm.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    if (!registerForm.email.trim() && !registerForm.phone.trim()) {
      toast.error('Se requiere email o teléfono');
      return;
    }

    setRegistering(true);
    try {
      const { data: newMember, error } = await supabase
        .from('loyalty_members')
        .insert({
          group_id: groupId,
          name: registerForm.name.trim(),
          email: registerForm.email.trim() || null,
          phone: registerForm.phone.trim() || null,
          points_balance: welcomeBonus,
          lifetime_points: welcomeBonus,
        } as never)
        .select()
        .single();

      if (error) throw error;

      // Create welcome bonus transaction if applicable
      if (welcomeBonus > 0) {
        await supabase.from('loyalty_transactions').insert({
          member_id: newMember.id,
          points: welcomeBonus,
          type: 'bonus',
          description: 'Bono de bienvenida',
        } as never);
      }

      toast.success(`¡${registerForm.name} registrado con ${welcomeBonus} puntos de bienvenida!`);
      
      // Select the new member
      handleMemberSelect(newMember as unknown as LoyaltyMember);
      setShowQuickRegister(false);
      setRegisterForm({ name: '', email: '', phone: '' });
      setHasSearched(false);
    } catch (error) {
      console.error('Error registering member:', error);
      toast.error('Error al registrar el cliente');
    } finally {
      setRegistering(false);
    }
  };

  const handleMemberSelect = async (member: LoyaltyMember) => {
    onMemberSelect(member);
    setSearchResults([]);
    setSearchQuery('');
    
    // Load rewards and transactions in parallel
    setLoadingRewards(true);
    setLoadingTransactions(true);
    
    try {
      const [rewardsResult, transactionsResult] = await Promise.all([
        supabase
          .from('loyalty_rewards')
          .select('*')
          .eq('group_id', groupId)
          .eq('is_active', true)
          .lte('points_cost', member.points_balance)
          .order('points_cost', { ascending: true }),
        supabase
          .from('loyalty_transactions')
          .select('*')
          .eq('member_id', member.id)
          .order('created_at', { ascending: false })
          .limit(20)
      ]);

      setAvailableRewards((rewardsResult.data || []) as unknown as LoyaltyReward[]);
      setTransactions((transactionsResult.data || []) as unknown as LoyaltyTransaction[]);
    } catch (error) {
      console.error('Error loading member data:', error);
    } finally {
      setLoadingRewards(false);
      setLoadingTransactions(false);
    }
  };

  const clearMember = () => {
    onMemberSelect(null);
    onRewardSelect(null);
    setAvailableRewards([]);
    setTransactions([]);
    setActiveTab('rewards');
    setHasSearched(false);
    setShowQuickRegister(false);
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

          {searchResults.length === 0 && hasSearched && !searching && !showQuickRegister && (
            <div className="border rounded-lg bg-background p-3 space-y-2">
              <p className="text-xs text-muted-foreground text-center">
                No se encontraron clientes
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full gap-2"
                onClick={() => setShowQuickRegister(true)}
              >
                <UserPlus className="h-4 w-4" />
                Registrar nuevo cliente
              </Button>
            </div>
          )}

          {/* Quick Registration Form */}
          {showQuickRegister && (
            <div className="border rounded-lg bg-background p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Nuevo cliente</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6"
                  onClick={() => setShowQuickRegister(false)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Nombre *</Label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Nombre completo"
                      value={registerForm.name}
                      onChange={(e) => setRegisterForm(prev => ({ ...prev, name: e.target.value }))}
                      className="h-8 pl-8 text-sm"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="email@ejemplo.com"
                        value={registerForm.email}
                        onChange={(e) => setRegisterForm(prev => ({ ...prev, email: e.target.value }))}
                        className="h-8 pl-8 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Teléfono</Label>
                    <div className="relative">
                      <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        type="tel"
                        placeholder="+34 600..."
                        value={registerForm.phone}
                        onChange={(e) => setRegisterForm(prev => ({ ...prev, phone: e.target.value }))}
                        className="h-8 pl-8 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-muted-foreground">
                  Bono: <span className="font-medium text-primary">+{welcomeBonus} pts</span>
                </p>
                <Button 
                  size="sm" 
                  onClick={handleQuickRegister}
                  disabled={registering}
                  className="gap-1"
                >
                  {registering ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                  Registrar
                </Button>
              </div>
            </div>
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

          {/* Tabs for Rewards and History */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'rewards' | 'history')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-8">
              <TabsTrigger value="rewards" className="text-xs gap-1">
                <Gift className="h-3 w-3" />
                Recompensas
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs gap-1">
                <History className="h-3 w-3" />
                Historial
              </TabsTrigger>
            </TabsList>

            {/* Rewards Tab */}
            <TabsContent value="rewards" className="mt-2">
              {loadingRewards ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : availableRewards.length > 0 ? (
                <ScrollArea className="h-32">
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
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No hay recompensas disponibles con los puntos actuales
                </p>
              )}
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="mt-2">
              {loadingTransactions ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : transactions.length > 0 ? (
                <ScrollArea className="h-32">
                  <div className="space-y-1">
                    {transactions.map((tx) => {
                      const config = TRANSACTION_CONFIG[tx.type];
                      const TxIcon = config.icon;
                      return (
                        <div
                          key={tx.id}
                          className="flex items-center gap-2 p-1.5 rounded-md bg-background border"
                        >
                          <div className={cn("p-1 rounded-full bg-muted", config.color)}>
                            <TxIcon className="h-3 w-3" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">
                              {tx.description || config.label}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {format(new Date(tx.created_at), "d MMM, HH:mm", { locale: es })}
                            </p>
                          </div>
                          <p className={cn("text-sm font-bold", config.color)}>
                            {config.sign}{Math.abs(tx.points)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Sin transacciones registradas
                </p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
