import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, ArrowLeft, CheckCircle, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { PayrollContextData } from '@/pages/Payroll';

export default function PayrollPay({
  currentRun,
  refreshData,
  isPayrollAdmin,
}: PayrollContextData) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);

  const handleGenerateSEPA = async () => {
    setGenerating(true);
    // Simulate SEPA file generation
    await new Promise(r => setTimeout(r, 1000));
    toast({ title: 'Fichero SEPA generado', description: 'Descarga iniciada' });
    setGenerating(false);
  };

  const handleMarkPaid = async () => {
    if (!currentRun) return;
    await supabase.from('payroll_runs').update({ status: 'paid' }).eq('id', currentRun.id);
    await refreshData();
    toast({ title: 'Nóminas marcadas como pagadas' });
  };

  const isPaid = currentRun?.status === 'paid';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Pago de Nóminas</h2>
        <p className="text-sm text-muted-foreground">Genera fichero SEPA y marca como pagado</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Fichero SEPA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" onClick={handleGenerateSEPA} disabled={generating}>
            <Download className="h-4 w-4 mr-2" />
            Generar y Descargar SEPA
          </Button>
          
          {!isPaid && isPayrollAdmin && (
            <Button onClick={handleMarkPaid} className="w-full">
              <CheckCircle className="h-4 w-4 mr-2" />
              Marcar como Pagado
            </Button>
          )}
          
          {isPaid && (
            <Badge className="bg-success text-lg py-2 px-4">
              <CheckCircle className="h-5 w-5 mr-2" />
              Nóminas Pagadas
            </Badge>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate('/payroll/submit')}>
          <ArrowLeft className="h-4 w-4 mr-2" />Presentar
        </Button>
        <Button onClick={() => navigate('/payroll')} variant="default">
          Finalizar
        </Button>
      </div>
    </div>
  );
}
