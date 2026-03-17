import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { toast } from 'sonner';
import {
    UserPlus, Shield, MapPin, Loader2,
    Mail, Copy, CheckCircle, Users, Trash2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ManagerEntry {
    id: string;
    email: string;
    full_name: string;
    location_name: string | null;
    location_id: string | null;
    created_at: string;
}

export function TeamManagersTab() {
  const { t } = useTranslation();
    const { user, profile } = useAuth();
    const { locations } = useApp();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [locationId, setLocationId] = useState('');
    const [sending, setSending] = useState(false);
    const [managers, setManagers] = useState<ManagerEntry[]>([]);
    const [loadingManagers, setLoadingManagers] = useState(true);
    const [lastCreated, setLastCreated] = useState<{ email: string; password: string } | null>(null);

    // Generate email preview
    const sanitize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    const emailPreview = firstName && lastName
        ? `${sanitize(firstName)}.${sanitize(lastName)}@josephine.com`
        : '';

    // Load existing managers
    useEffect(() => {
        loadManagers();
    }, []);

    const loadManagers = async () => {
        if (!profile?.group_id) return;
        setLoadingManagers(true);

        try {
            const managerRoleId = '00000000-0000-0000-0000-000000000002';
            const { data, error } = await supabase
                .from('user_roles')
                .select(`
          id,
          user_id,
          location_id,
          created_at,
          profiles!inner(full_name, group_id),
          locations(name)
        `)
                .eq('role_id', managerRoleId);

            if (data) {
                const mapped: ManagerEntry[] = data
                    .filter((d: any) => d.profiles?.group_id === profile.group_id)
                    .map((d: any) => ({
                        id: d.id,
                        email: '', // Will fill from auth if needed
                        full_name: d.profiles?.full_name || 'Sin nombre',
                        location_name: d.locations?.name || null,
                        location_id: d.location_id,
                        created_at: d.created_at,
                    }));
                setManagers(mapped);
            }
        } catch (err) {
            console.error('Error loading managers:', err);
        }
        setLoadingManagers(false);
    };

    const handleInvite = async () => {
        if (!firstName.trim() || !lastName.trim() || !locationId) {
            toast.error(t('teamManagers.toastCompleteFields'));
            return;
        }

        setSending(true);
        try {
            const { data, error } = await supabase.functions.invoke('invite_manager', {
                body: { firstName: firstName.trim(), lastName: lastName.trim(), locationId },
            });

            if (error) throw error;

            toast.success(`Manager invitado: ${data.email}`);
            setLastCreated({ email: data.email, password: '(enviada por email)' });
            setFirstName('');
            setLastName('');
            setLocationId('');
            await loadManagers();
        } catch (err: any) {
            console.error('Invite error:', err);
            toast.error(err.message || 'Error al invitar manager');
        }
        setSending(false);
    };

    const copyEmail = () => {
        if (lastCreated) {
            navigator.clipboard.writeText(lastCreated.email);
            toast.success(t('teamManagers.toastEmailCopied'));
        }
    };

    return (
        <div className="space-y-6">
            {/* Invite Form */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-indigo-500" />
                        Invitar Manager
                    </CardTitle>
                    <CardDescription>
                        Crea una cuenta de manager con acceso limitado a una ubicación específica.
                        Recibirá un email con sus credenciales.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="firstName">Nombre</Label>
                            <Input
                                id="firstName"
                                placeholder={t('settings.firstName')}
                                value={firstName}
                                onChange={e => setFirstName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="lastName">Apellido</Label>
                            <Input
                                id="lastName"
                                placeholder={t('settings.lastName')}
                                value={lastName}
                                onChange={e => setLastName(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="location">Ubicación</Label>
                        <select
                            id="location"
                            value={locationId}
                            onChange={e => setLocationId(e.target.value)}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                            <option value="">Selecciona una ubicación</option>
                            {locations?.map(loc => (
                                <option key={loc.id} value={loc.id}>{loc.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Email preview */}
                    {emailPreview && (
                        <div className="flex items-center gap-2 p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg">
                            <Mail className="h-4 w-4 text-indigo-500 shrink-0" />
                            <span className="text-sm text-indigo-700 dark:text-indigo-300">
                                Email: <strong>{emailPreview}</strong>
                            </span>
                        </div>
                    )}

                    <Button
                        onClick={handleInvite}
                        disabled={sending || !firstName.trim() || !lastName.trim() || !locationId}
                        className="w-full sm:w-auto"
                    >
                        {sending ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
                        ) : (
                            <><UserPlus className="h-4 w-4 mr-2" /> Enviar invitación</>
                        )}
                    </Button>

                    {/* Success Card */}
                    {lastCreated && (
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle className="h-4 w-4 text-emerald-500" />
                                <span className="font-medium text-emerald-700 dark:text-emerald-300 text-sm">
                                    Manager invitado correctamente
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <code className="text-sm bg-white dark:bg-slate-800 px-2 py-1 rounded">
                                    {lastCreated.email}
                                </code>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyEmail}>
                                    <Copy className="h-3 w-3" />
                                </Button>
                            </div>
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                                Las credenciales se han enviado por email.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Manager Permissions Info */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-amber-500" />
                        Permisos del Manager
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-emerald-600">Tiene acceso</p>
                            {['Dashboard (su local)', 'Scheduling', 'Inventory / Waste', 'Procurement', 'Reviews', 'Equipo (solo ver)'].map(item => (
                                <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <CheckCircle className="h-3 w-3 text-emerald-500" />
                                    {item}
                                </div>
                            ))}
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-red-500">Sin acceso</p>
                            {['Insights (Sales/Labour)', 'P&L', 'Payroll', 'Menu Engineering', 'Settings / Billing', 'Otros locales'].map(item => (
                                <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span className="h-3 w-3 rounded-full bg-red-200 dark:bg-red-800 inline-flex items-center justify-center text-[8px] text-red-600">✕</span>
                                    {item}
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Existing Managers */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-slate-500" />
                        Managers activos
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loadingManagers ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                            <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
                        </div>
                    ) : managers.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4">
                            No hay managers invitados aún. Usa el formulario de arriba para invitar al primero.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {managers.map(m => (
                                <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border">
                                    <div className="flex items-center gap-3">
                                        <div className="h-9 w-9 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                                            <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                                                {m.full_name.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">{m.full_name}</p>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary" className="text-xs">Manager</Badge>
                                                {m.location_name && (
                                                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                        <MapPin className="h-3 w-3" /> {m.location_name}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        {new Date(m.created_at).toLocaleDateString('es-ES')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
