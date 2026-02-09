import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Send, ArrowRight, ArrowLeft, CheckCircle, XCircle, Clock, RefreshCw, Shield
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import type { PayrollContextData } from '@/pages/Payroll';

export default function PayrollSubmit({
  selectedLegalEntity,
  currentPeriod,
  currentRun,
  refreshData,
  isPayrollAdmin,
  isSandboxMode,
}: PayrollContextData) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentRun) fetchSubmissions();
  }, [currentRun]);

  const fetchSubmissions = async () => {
    const { data } = await supabase
      .from('compliance_submissions')
      .select('*')
      .eq('payroll_run_id', currentRun?.id);
    setSubmissions(data || []);
  };

  const handleSubmit = async (agency: string, _type: string) => {
    if (!currentRun) return;
    setLoading(true);
    
    try {
      const { payrollApi } = await import('@/lib/payroll-api');
      await payrollApi.createSubmission(currentRun.id, agency, isSandboxMode);
      toast({ title: isSandboxMode ? 'Simulación completada' : 'Enviado', description: `${agency} presentado correctamente` });
      fetchSubmissions();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'Error al presentar' });
    }
    setLoading(false);
  };

  const agencies = [
    { id: 'TGSS', name: 'Seguridad Social (RED/SLD)', types: ['cotizacion', 'bases'] },
    { id: 'AEAT', name: 'Agencia Tributaria', types: ['modelo111'] },
    { id: 'SEPE', name: 'SEPE Certific@2', types: ['certificado_empresa'] },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Presentación Oficial</h2>
        <p className="text-sm text-muted-foreground">
          {isSandboxMode ? 'Modo Sandbox - Las presentaciones se simularán' : 'Envío real a organismos oficiales'}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {agencies.map(agency => {
          const agencySubmissions = submissions.filter(s => s.agency === agency.id);
          const lastSubmission = agencySubmissions[0];
          
          return (
            <Card key={agency.id}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  {agency.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  {lastSubmission?.status === 'accepted' ? (
                    <Badge className="bg-success"><CheckCircle className="h-3 w-3 mr-1" />Aceptado</Badge>
                  ) : lastSubmission?.status === 'rejected' ? (
                    <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rechazado</Badge>
                  ) : lastSubmission?.status === 'sent' ? (
                    <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendiente</Badge>
                  ) : (
                    <Badge variant="outline">Sin presentar</Badge>
                  )}
                </div>
                
                {agency.types.map(type => (
                  <Button 
                    key={type}
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => handleSubmit(agency.id, type)}
                    disabled={loading || !isPayrollAdmin}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {type === 'cotizacion' && 'Cotización'}
                    {type === 'bases' && 'Bases'}
                    {type === 'modelo111' && 'Modelo 111'}
                    {type === 'certificado_empresa' && 'Certificado'}
                  </Button>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate('/payroll/review')}>
          <ArrowLeft className="h-4 w-4 mr-2" />Revisar
        </Button>
        <Button onClick={() => navigate('/payroll/pay')}>
          Siguiente: Pagar<ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
