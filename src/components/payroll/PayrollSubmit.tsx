import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { payrollApi } from '@/lib/payroll-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Send, ArrowRight, ArrowLeft, CheckCircle, XCircle, Clock, Shield, Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { PayrollContextData } from '@/pages/Payroll';

const AGENCIES = [
  { 
    id: 'TGSS', 
    name: 'Seguridad Social', 
    description: 'Liquidación de cuotas a través del Sistema RED (Liquidación Directa)',
    regulation: 'LGSS Art. 22 + Orden ESS/484/2013',
    filings: ['RLC - Liquidación Cotizaciones', 'RNT - Relación Nominal Trabajadores'],
  },
  { 
    id: 'AEAT', 
    name: 'Agencia Tributaria', 
    description: 'Retenciones e ingresos a cuenta del IRPF',
    regulation: 'Modelo 111 - Orden EHA/586/2011',
    filings: ['Modelo 111 - Retenciones IRPF'],
  },
  { 
    id: 'SEPE', 
    name: 'SEPE Certific@2', 
    description: 'Certificados de empresa para prestaciones de desempleo',
    regulation: 'Art. 267 LGSS + RD 625/1985',
    filings: ['Certificado de empresa'],
  },
];

export default function PayrollSubmit({
  currentRun,
  refreshData,
  isSandboxMode,
}: PayrollContextData) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loadingAgency, setLoadingAgency] = useState<string | null>(null);

  useEffect(() => {
    if (currentRun) fetchSubmissions();
  }, [currentRun]);

  const fetchSubmissions = async () => {
    if (!currentRun) return;
    const { data, error } = await supabase
      .from('compliance_submissions')
      .select('*')
      .eq('payroll_run_id', currentRun.id);
    if (!error && data) setSubmissions(data);
  };

  const handleSubmit = async (agencyId: string) => {
    if (!currentRun) return;
    setLoadingAgency(agencyId);
    
    try {
      await payrollApi.createSubmission(currentRun.id, agencyId, isSandboxMode);
      toast({ 
        title: isSandboxMode ? 'Simulación completada' : 'Presentado', 
        description: `${agencyId} - ${isSandboxMode ? 'Simulado OK' : 'Enviado correctamente'}` 
      });
      await fetchSubmissions();
      
      // Check if all 3 agencies are now submitted
      const updatedSubs = [...submissions.filter(s => s.agency !== agencyId), { agency: agencyId, status: 'accepted' }];
      const allSubmitted = AGENCIES.every(a => updatedSubs.some(s => s.agency === a.id));
      
      if (allSubmitted && currentRun.status !== 'submitted' && currentRun.status !== 'paid') {
        // Auto-advance status to 'submitted'
        try {
          await payrollApi.updateStatus(currentRun.id, 'submitted');
        } catch {
          await supabase.from('payroll_runs').update({ status: 'submitted' }).eq('id', currentRun.id);
        }
        await refreshData();
        toast({ title: 'Todas las presentaciones completadas', description: 'Puedes proceder al pago.' });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'Error al presentar' });
    }
    setLoadingAgency(null);
  };

  const handleSubmitAll = async () => {
    for (const agency of AGENCIES) {
      const alreadySubmitted = submissions.some(s => s.agency === agency.id);
      if (!alreadySubmitted) {
        await handleSubmit(agency.id);
      }
    }
  };

  const getAgencyStatus = (agencyId: string) => {
    return submissions.find(s => s.agency === agencyId);
  };

  const allDone = AGENCIES.every(a => getAgencyStatus(a.id)?.status === 'accepted');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Presentación Oficial</h2>
          <p className="text-sm text-muted-foreground">
            {isSandboxMode ? 'Modo Sandbox - Las presentaciones se simularán sin envío real' : 'Envío real a organismos oficiales'}
          </p>
        </div>
        {!allDone && (
          <Button onClick={handleSubmitAll} disabled={!!loadingAgency}>
            {loadingAgency && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Presentar Todo
          </Button>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {AGENCIES.map(agency => {
          const submission = getAgencyStatus(agency.id);
          const isSubmitted = submission?.status === 'accepted' || submission?.status === 'sent';
          
          return (
            <Card key={agency.id} className={isSubmitted ? 'border-success/30' : ''}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  {agency.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{agency.description}</p>
                <p className="text-xs text-muted-foreground italic">{agency.regulation}</p>
                
                <div className="space-y-1">
                  {agency.filings.map(f => (
                    <div key={f} className="text-xs bg-muted/50 p-2 rounded">{f}</div>
                  ))}
                </div>
                
                <div className="flex items-center gap-2">
                  {submission?.status === 'accepted' ? (
                    <Badge className="bg-success"><CheckCircle className="h-3 w-3 mr-1" />Aceptado</Badge>
                  ) : submission?.status === 'rejected' ? (
                    <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rechazado</Badge>
                  ) : submission?.status === 'sent' ? (
                    <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendiente</Badge>
                  ) : (
                    <Badge variant="outline">Sin presentar</Badge>
                  )}
                </div>
                
                {!isSubmitted && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => handleSubmit(agency.id)}
                    disabled={!!loadingAgency}
                  >
                    {loadingAgency === agency.id ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    {isSandboxMode ? 'Simular' : 'Presentar'}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate('/payroll/review')}>
          <ArrowLeft className="h-4 w-4 mr-2" />Revisar
        </Button>
        <Button onClick={() => navigate('/payroll/pay')} disabled={!allDone}>
          Siguiente: Pagar<ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
