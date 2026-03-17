/**
 * Integrations Page
 * Lista de integraciones disponibles con POS externos
 */

import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plug2, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const availableIntegrations = [
  {
    id: 'square',
    name: 'Square POS',
    description: t('integrations.sincronizaPedidosCatalogoYPagos'),
    icon: '🔷',
    status: 'available',
    path: '/integrations/square',
  },
  {
    id: 'lightspeed',
    name: 'Lightspeed Restaurant',
    description: t('integrations.sincronizaVentasMenuYEmpleados'),
    icon: '⚡',
    status: 'available',
    path: '/integrations/lightspeed',
  },
  {
    id: 'oracle',
    name: 'Oracle Simphony',
    description: t('integrations.proximamenteIntegracionConOracleSimphony'),
    icon: '🏛️',
    status: 'coming_soon',
    path: null,
  },
  {
    id: 'toast',
    name: 'Toast POS',
    description: t('integrations.proximamenteIntegracionConToast'),
    icon: '🍞',
    status: 'coming_soon',
    path: null,
  },
];

export default function Integrations() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Plug2 className="h-6 w-6" />
          Integraciones
        </h1>
        <p className="text-muted-foreground">
          Conecta Josephine con sistemas POS externos
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {availableIntegrations.map((integration) => (
          <Card
            key={integration.id}
            className={integration.status === 'available' ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}
            onClick={() => integration.path && navigate(integration.path)}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-4xl">{integration.icon}</div>
                  <div>
                    <CardTitle>{integration.name}</CardTitle>
                    <CardDescription>{integration.description}</CardDescription>
                  </div>
                </div>

                {integration.status === 'available' ? (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Badge variant="secondary">{t('integrations.proximamente')}</Badge>
                )}
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('integrations.queSonLasIntegraciones')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Las integraciones permiten a Josephine conectarse con sistemas POS externos
            para sincronizar automáticamente:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>{t("integrations.productCatalog")}</li>
            <li>{t("integrations.ordersAndTickets")}</li>
            <li>{t("integrations.paymentsAndTransactions")}</li>
            <li>{t("integrations.locationInfo")}</li>
          </ul>
          <p>
            Los datos se normalizan a un modelo canónico (CDM) que permite análisis
            unificado independientemente del sistema POS que uses.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
