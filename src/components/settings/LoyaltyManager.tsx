import { useState } from 'react';
import { useLoyaltyData, LoyaltyMember, LoyaltyReward } from '@/hooks/useLoyaltyData';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Gift,
  Users,
  Trophy,
  Star,
  Plus,
  Trash2,
  Edit,
  Crown,
  Medal,
  Award,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const TIER_CONFIG = {
  bronze: { icon: Medal, color: 'text-amber-700 bg-amber-100', label: 'Bronce' },
  silver: { icon: Award, color: 'text-gray-500 bg-gray-100', label: 'Plata' },
  gold: { icon: Trophy, color: 'text-yellow-600 bg-yellow-100', label: 'Oro' },
  platinum: { icon: Crown, color: 'text-purple-600 bg-purple-100', label: 'Platino' },
};

const REWARD_TYPES = [
  { value: 'discount', label: 'Descuento (€)' },
  { value: 'percentage', label: 'Descuento (%)' },
  { value: 'free_item', label: 'Producto gratis' },
  { value: 'experience', label: 'Experiencia' },
];

export function LoyaltyManager() {
  const {
    settings,
    members,
    rewards,
    loading,
    updateSettings,
    createMember,
    updateMember,
    deleteMember,
    addPoints,
    createReward,
    updateReward,
    deleteReward,
    getStats,
  } = useLoyaltyData();
  const { toast } = useToast();

  const [showMemberDialog, setShowMemberDialog] = useState(false);
  const [showRewardDialog, setShowRewardDialog] = useState(false);
  const [showPointsDialog, setShowPointsDialog] = useState(false);
  const [editingMember, setEditingMember] = useState<LoyaltyMember | null>(null);
  const [editingReward, setEditingReward] = useState<LoyaltyReward | null>(null);
  const [selectedMember, setSelectedMember] = useState<LoyaltyMember | null>(null);
  const [saving, setSaving] = useState(false);

  const [memberForm, setMemberForm] = useState({
    name: '',
    email: '',
    phone: '',
    notes: '',
  });

  const [rewardForm, setRewardForm] = useState({
    name: '',
    description: '',
    points_cost: 100,
    reward_type: 'discount' as LoyaltyReward['reward_type'],
    value: 5,
    is_active: true,
  });

  const [pointsForm, setPointsForm] = useState({
    points: 0,
    type: 'bonus' as 'bonus' | 'adjustment',
    description: '',
  });

  const stats = getStats();

  const handleToggleEnabled = async (enabled: boolean) => {
    try {
      await updateSettings({ is_enabled: enabled });
      toast({ title: enabled ? 'Programa activado' : 'Programa desactivado' });
    } catch (err) {
      toast({ title: 'Error', description: 'No se pudo actualizar', variant: 'destructive' });
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await updateSettings({
        points_per_euro: settings.points_per_euro,
        welcome_bonus: settings.welcome_bonus,
      });
      toast({ title: 'Configuración guardada' });
    } catch (err) {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMember = async () => {
    if (!memberForm.name || (!memberForm.email && !memberForm.phone)) {
      toast({ title: 'Completa nombre y email o teléfono', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (editingMember) {
        await updateMember(editingMember.id, memberForm);
        toast({ title: 'Miembro actualizado' });
      } else {
        await createMember(memberForm);
        toast({ title: 'Miembro creado', description: `+${settings?.welcome_bonus || 50} puntos de bienvenida` });
      }
      setShowMemberDialog(false);
      setEditingMember(null);
      setMemberForm({ name: '', email: '', phone: '', notes: '' });
    } catch (err) {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveReward = async () => {
    if (!rewardForm.name || rewardForm.points_cost <= 0) {
      toast({ title: 'Completa nombre y coste en puntos', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const rewardData = {
        name: rewardForm.name,
        description: rewardForm.description || null,
        points_cost: rewardForm.points_cost,
        reward_type: rewardForm.reward_type,
        value: rewardForm.value || null,
        is_active: rewardForm.is_active,
        product_id: null,
        max_redemptions: null,
        valid_from: null,
        valid_until: null,
      };
      
      if (editingReward) {
        await updateReward(editingReward.id, rewardData);
        toast({ title: 'Recompensa actualizada' });
      } else {
        await createReward(rewardData);
        toast({ title: 'Recompensa creada' });
      }
      setShowRewardDialog(false);
      setEditingReward(null);
      setRewardForm({ name: '', description: '', points_cost: 100, reward_type: 'discount', value: 5, is_active: true });
    } catch (err) {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddPoints = async () => {
    if (!selectedMember || pointsForm.points === 0) return;

    setSaving(true);
    try {
      await addPoints(selectedMember.id, pointsForm.points, pointsForm.type, pointsForm.description);
      toast({ title: `${pointsForm.points > 0 ? '+' : ''}${pointsForm.points} puntos añadidos` });
      setShowPointsDialog(false);
      setSelectedMember(null);
      setPointsForm({ points: 0, type: 'bonus', description: '' });
    } catch (err) {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openEditMember = (member: LoyaltyMember) => {
    setEditingMember(member);
    setMemberForm({
      name: member.name,
      email: member.email || '',
      phone: member.phone || '',
      notes: member.notes || '',
    });
    setShowMemberDialog(true);
  };

  const openEditReward = (reward: LoyaltyReward) => {
    setEditingReward(reward);
    setRewardForm({
      name: reward.name,
      description: reward.description || '',
      points_cost: reward.points_cost,
      reward_type: reward.reward_type,
      value: reward.value || 0,
      is_active: reward.is_active,
    });
    setShowRewardDialog(true);
  };

  const openAddPoints = (member: LoyaltyMember) => {
    setSelectedMember(member);
    setPointsForm({ points: 0, type: 'bonus', description: '' });
    setShowPointsDialog(true);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Toggle */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Gift className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Programa de Fidelización</CardTitle>
                <CardDescription>Gestiona clientes frecuentes y recompensas</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label>Activo</Label>
              <Switch
                checked={settings?.is_enabled || false}
                onCheckedChange={handleToggleEnabled}
              />
            </div>
          </div>
        </CardHeader>

        {settings?.is_enabled && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl font-bold">{stats.totalMembers}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Miembros</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500" />
                    <span className="text-2xl font-bold">{stats.totalPoints.toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Puntos en circulación</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Gift className="h-5 w-5 text-primary" />
                    <span className="text-2xl font-bold">{stats.activeRewards}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Recompensas activas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex gap-1 flex-wrap">
                    {Object.entries(stats.tierCounts).map(([tier, count]) => {
                      const config = TIER_CONFIG[tier as keyof typeof TIER_CONFIG];
                      return (
                        <Badge key={tier} variant="outline" className={config.color}>
                          {count}
                        </Badge>
                      );
                    })}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Por nivel</p>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        )}
      </Card>

      {settings?.is_enabled && (
        <Tabs defaultValue="members">
          <TabsList>
            <TabsTrigger value="members">Miembros</TabsTrigger>
            <TabsTrigger value="rewards">Recompensas</TabsTrigger>
            <TabsTrigger value="settings">Configuración</TabsTrigger>
          </TabsList>

          {/* Members Tab */}
          <TabsContent value="members" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Clientes Frecuentes</h3>
              <Button onClick={() => { setEditingMember(null); setMemberForm({ name: '', email: '', phone: '', notes: '' }); setShowMemberDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Añadir Miembro
              </Button>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Nivel</TableHead>
                    <TableHead className="text-right">Puntos</TableHead>
                    <TableHead className="text-right">Acumulados</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No hay miembros registrados
                      </TableCell>
                    </TableRow>
                  ) : (
                    members.map((member) => {
                      const tierConfig = TIER_CONFIG[member.tier];
                      const TierIcon = tierConfig.icon;
                      return (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">{member.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {member.email || member.phone}
                          </TableCell>
                          <TableCell>
                            <Badge className={tierConfig.color}>
                              <TierIcon className="h-3 w-3 mr-1" />
                              {tierConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {member.points_balance.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {member.lifetime_points.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="ghost" onClick={() => openAddPoints(member)}>
                                <Star className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => openEditMember(member)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => deleteMember(member.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Rewards Tab */}
          <TabsContent value="rewards" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Catálogo de Recompensas</h3>
              <Button onClick={() => { setEditingReward(null); setRewardForm({ name: '', description: '', points_cost: 100, reward_type: 'discount', value: 5, is_active: true }); setShowRewardDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Añadir Recompensa
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {rewards.length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No hay recompensas configuradas
                  </CardContent>
                </Card>
              ) : (
                rewards.map((reward) => (
                  <Card key={reward.id} className={!reward.is_active ? 'opacity-50' : ''}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-base">{reward.name}</CardTitle>
                        <Badge variant={reward.is_active ? 'default' : 'secondary'}>
                          {reward.points_cost} pts
                        </Badge>
                      </div>
                      {reward.description && (
                        <CardDescription>{reward.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          {reward.reward_type === 'discount' && `${reward.value}€ descuento`}
                          {reward.reward_type === 'percentage' && `${reward.value}% descuento`}
                          {reward.reward_type === 'free_item' && 'Producto gratis'}
                          {reward.reward_type === 'experience' && 'Experiencia'}
                        </span>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEditReward(reward)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteReward(reward.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      {reward.current_redemptions > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Canjeado {reward.current_redemptions} veces
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Configuración del Programa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Puntos por Euro gastado</Label>
                    <Input
                      type="number"
                      defaultValue={settings?.points_per_euro || 1}
                      onBlur={(e) => updateSettings({ points_per_euro: Number(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Ejemplo: 1 punto por cada €1 gastado
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Bono de Bienvenida (puntos)</Label>
                    <Input
                      type="number"
                      defaultValue={settings?.welcome_bonus || 50}
                      onBlur={(e) => updateSettings({ welcome_bonus: Number(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Puntos que recibe un nuevo miembro al registrarse
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-3">Niveles de Fidelización</h4>
                  <div className="grid gap-2 md:grid-cols-4">
                    {Object.entries(TIER_CONFIG).map(([tier, config]) => {
                      const TierIcon = config.icon;
                      const tierRules = settings?.tier_rules?.[tier as keyof typeof TIER_CONFIG];
                      return (
                        <div key={tier} className={`p-3 rounded-lg ${config.color}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <TierIcon className="h-4 w-4" />
                            <span className="font-medium">{config.label}</span>
                          </div>
                          <p className="text-xs">
                            Desde {tierRules?.min_points || 0} pts
                          </p>
                          <p className="text-xs">
                            Multiplicador x{tierRules?.multiplier || 1}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Button onClick={handleSaveSettings} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Guardar Configuración
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Member Dialog */}
      <Dialog open={showMemberDialog} onOpenChange={setShowMemberDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMember ? 'Editar Miembro' : 'Nuevo Miembro'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={memberForm.name}
                onChange={(e) => setMemberForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Nombre completo"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={memberForm.email}
                  onChange={(e) => setMemberForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="cliente@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  type="tel"
                  value={memberForm.phone}
                  onChange={(e) => setMemberForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+34 600 000 000"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={memberForm.notes}
                onChange={(e) => setMemberForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Preferencias, alergias, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMemberDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveMember} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editingMember ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reward Dialog */}
      <Dialog open={showRewardDialog} onOpenChange={setShowRewardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingReward ? 'Editar Recompensa' : 'Nueva Recompensa'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={rewardForm.name}
                onChange={(e) => setRewardForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Café gratis, 10% descuento..."
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={rewardForm.description}
                onChange={(e) => setRewardForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Detalles de la recompensa"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Coste en Puntos *</Label>
                <Input
                  type="number"
                  value={rewardForm.points_cost}
                  onChange={(e) => setRewardForm((p) => ({ ...p, points_cost: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={rewardForm.reward_type}
                  onValueChange={(v) => setRewardForm((p) => ({ ...p, reward_type: v as LoyaltyReward['reward_type'] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REWARD_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(rewardForm.reward_type === 'discount' || rewardForm.reward_type === 'percentage') && (
              <div className="space-y-2">
                <Label>Valor {rewardForm.reward_type === 'discount' ? '(€)' : '(%)'}</Label>
                <Input
                  type="number"
                  value={rewardForm.value}
                  onChange={(e) => setRewardForm((p) => ({ ...p, value: Number(e.target.value) }))}
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch
                checked={rewardForm.is_active}
                onCheckedChange={(v) => setRewardForm((p) => ({ ...p, is_active: v }))}
              />
              <Label>Activa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRewardDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveReward} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editingReward ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Points Dialog */}
      <Dialog open={showPointsDialog} onOpenChange={setShowPointsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir Puntos a {selectedMember?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Puntos</Label>
              <Input
                type="number"
                value={pointsForm.points}
                onChange={(e) => setPointsForm((p) => ({ ...p, points: Number(e.target.value) }))}
                placeholder="Usa negativos para restar"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={pointsForm.type}
                onValueChange={(v) => setPointsForm((p) => ({ ...p, type: v as 'bonus' | 'adjustment' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bonus">Bono</SelectItem>
                  <SelectItem value="adjustment">Ajuste</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input
                value={pointsForm.description}
                onChange={(e) => setPointsForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Motivo del ajuste"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPointsDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddPoints} disabled={saving || pointsForm.points === 0}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
