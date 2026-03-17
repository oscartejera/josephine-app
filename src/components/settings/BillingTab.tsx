/**
 * BillingTab — shows current plan, subscription status, and manage-subscription link
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, Sparkles, Zap, ExternalLink, CreditCard } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const PLAN_META: Record<string, { label: string; icon: typeof Zap; color: string }> = {
  free: { label: 'Starter', icon: Zap, color: 'text-gray-500' },
  pro: { label: 'Pro', icon: Sparkles, color: 'text-violet-600' },
  enterprise: { label: 'Enterprise', icon: Crown, color: 'text-amber-600' },
};

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Activa', variant: 'default' },
  trialing: { label: 'Prueba gratis', variant: 'secondary' },
  past_due: { label: 'Pago pendiente', variant: 'destructive' },
  canceled: { label: 'Cancelada', variant: 'destructive' },
  incomplete: { label: 'Incompleta', variant: 'outline' },
  none: { label: 'Sin suscripción', variant: 'outline' },
};

export function BillingTab() {
  const { t } = useTranslation();
  const { group } = useApp();
  const navigate = useNavigate();
  const [portalLoading, setPortalLoading] = useState(false);

  const plan = group?.plan || 'free';
  const subscriptionStatus = group?.subscription_status || 'none';
  const meta = PLAN_META[plan] || PLAN_META.free;
  const statusInfo = STATUS_LABELS[subscriptionStatus] || STATUS_LABELS.none;
  const Icon = meta.icon;

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create_portal_session', {
        body: { returnUrl: window.location.href },
      });

      if (error || data?.error) {
        toast.error(data?.error || error?.message || 'No se pudo abrir el portal de facturación');
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error al conectar con Stripe');
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${meta.color}`} />
            Plan {meta.label}
          </CardTitle>
          <CardDescription>Tu plan actual y estado de suscripción</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Estado:</span>
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>

          <div className="flex flex-wrap gap-3">
            {plan === 'free' ? (
              <Button onClick={() => navigate('/pricing')} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Upgrade a Pro
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  className="gap-2"
                >
                  {portalLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}
                  Gestionar suscripción
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => navigate('/pricing')}
                  className="gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Ver planes
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Billing Portal Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Facturación y pagos</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Los pagos se procesan de forma segura a través de Stripe.
            Desde el portal de facturación puedes:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Actualizar tu método de pago</li>
            <li>{t("billing.downloadPreviousInvoices")}</li>
            <li>Cambiar o cancelar tu suscripción</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
