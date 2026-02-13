/**
 * Debug Data Coherence Page
 * Calls audit_data_coherence RPC and displays pass/fail per check.
 * Route: /debug/data-coherence
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { DataSourceBadge } from '@/components/ui/DataSourceBadge';

interface AuditCheck {
  name: string;
  pass: boolean;
  [key: string]: unknown;
}

interface AuditResult {
  audit_ts: string;
  org_id: string;
  location_ids: string[];
  date_range: { from: string; to: string };
  resolved_source: { data_source: string; mode: string; reason: string };
  all_pass: boolean;
  checks: AuditCheck[];
}

export default function DebugDataCoherence() {
  const { profile } = useAuth();
  const { locations } = useApp();
  const [days, setDays] = useState(30);

  const orgId = profile?.group_id;
  const locationIds = locations.map(l => l.id);

  const { data, isLoading, isError, refetch } = useQuery<AuditResult | null>({
    queryKey: ['audit-data-coherence', orgId, locationIds, days],
    queryFn: async () => {
      if (!orgId || locationIds.length === 0) return null;

      const { data, error } = await supabase.rpc('audit_data_coherence', {
        p_org_id: orgId,
        p_location_ids: locationIds,
        p_days: days,
      });

      if (error) {
        console.error('audit_data_coherence error:', error.message);
        throw error;
      }

      return data as unknown as AuditResult;
    },
    enabled: !!orgId && locationIds.length > 0,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Data Coherence Audit</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Verifica integridad de datos entre tablas unificadas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DataSourceBadge />
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value={7}>7 días</option>
            <option value={14}>14 días</option>
            <option value={30}>30 días</option>
            <option value={60}>60 días</option>
          </select>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Auditar
          </Button>
        </div>
      </div>

      {isError && (
        <Card className="border-destructive">
          <CardContent className="pt-4">
            <p className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Error ejecutando audit. Verifica que las migraciones estén aplicadas.
            </p>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Resultado Global</CardTitle>
                <Badge variant={data.all_pass ? 'default' : 'destructive'} className="text-sm">
                  {data.all_pass ? (
                    <><CheckCircle className="h-4 w-4 mr-1" /> ALL PASS</>
                  ) : (
                    <><XCircle className="h-4 w-4 mr-1" /> FAIL</>
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Data source:</span>{' '}
                  <strong>{data.resolved_source.data_source}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Modo:</span>{' '}
                  <strong>{data.resolved_source.mode}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Razón:</span>{' '}
                  <strong>{data.resolved_source.reason}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Rango:</span>{' '}
                  <strong>{data.date_range.from} → {data.date_range.to}</strong>
                </div>
              </div>
            </CardContent>
          </Card>

          {data.checks.map((check, i) => (
            <Card key={i} className={!check.pass ? 'border-amber-500' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-mono">{check.name}</CardTitle>
                  <Badge variant={check.pass ? 'outline' : 'destructive'}>
                    {check.pass ? (
                      <><CheckCircle className="h-3.5 w-3.5 mr-1 text-green-600" /> PASS</>
                    ) : (
                      <><XCircle className="h-3.5 w-3.5 mr-1" /> FAIL</>
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-48">
                  {JSON.stringify(check, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ))}
        </>
      )}

      {!data && !isLoading && !isError && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Haz clic en "Auditar" para ejecutar la verificación de coherencia.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
