import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { payrollApi } from '@/lib/payroll-api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { CreditCard, ArrowLeft, CheckCircle, Download, Loader2, FileText, BanknoteIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import type { PayrollContextData } from '@/pages/Payroll';
import { useTranslation } from 'react-i18next';

export default function PayrollPay({
  
  currentPeriod,
  currentRun,
  refreshData,
}: PayrollContextData) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [sepaData, setSepaData] = useState<any>(null);
  const [sepaXml, setSepaXml] = useState<string | null>(null);
  const [sepaFilename, setSepaFilename] = useState<string>('');
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payslipCount, setPayslipCount] = useState(0);
  const [totalNet, setTotalNet] = useState(0);

  useEffect(() => {
    if (currentRun) fetchPaymentInfo();
  }, [currentRun]);

  const fetchPaymentInfo = async () => {
    if (!currentRun) return;
    const { data } = await supabase
      .from('payslips')
      .select('net_pay')
      .eq('payroll_run_id', currentRun.id);
    if (data) {
      setPayslipCount(data.length);
      setTotalNet(data.reduce((s: number, p: any) => s + Number(p.net_pay), 0));
    }
  };

  const handleGenerateSEPA = async () => {
    if (!currentRun) return;
    setGenerating(true);
    try {
      const result = await payrollApi.generateSEPA(currentRun.id);
      setSepaData(result.sepa);
      setSepaXml(result.xml || null);
      setSepaFilename(result.filename || 'SEPA_nominas.xml');
      toast({
        title: t('payroll.sepaGenerated'),
        description: t('payroll.sepaTransfersSummary', { count: result.sepa?.numberOfTransactions || 0, amount: result.sepa?.controlSum?.toLocaleString('es-ES') || '0' })
      });
    } catch (error) {
      toast({ variant: 'destructive', title: t("common.error"), description: error instanceof Error ? error.message : t('payroll.sepaGenerateError') });
    }
    setGenerating(false);
  };

  const handleMarkPaid = async () => {
    if (!currentRun) return;
    setPaying(true);
    try {
      // Try Edge Function first
      await payrollApi.updateStatus(currentRun.id, 'paid');
    } catch {
      // Fallback: direct DB update
      await supabase.from('payroll_runs').update({ status: 'paid' }).eq('id', currentRun.id);
    }
    await refreshData();
    setPaying(false);
    setShowPayDialog(false);
    toast({ title: t('payroll.payrollPaid'), description: t('payroll.payrollPaidDesc', { count: payslipCount }) });
  };

  const isPaid = currentRun?.status === 'paid';
  const fmt = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t('payroll.payrollPayment')}</h2>
        <p className="text-sm text-muted-foreground">
          {format(new Date(currentPeriod.year, currentPeriod.month - 1), 'MMMM yyyy', { locale: es })}
          {' - '}{t('payroll.generateSepaAndConfirm')}
        </p>
      </div>

      {/* Payment Summary */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">{t('payroll.employeesLabel')}</p>
            <p className="text-3xl font-bold">{payslipCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">{t('payroll.totalToPay')}</p>
            <p className="text-3xl font-bold text-primary">€{fmt(totalNet)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">{t('payroll.statusLabel')}</p>
            {isPaid ? (
              <Badge className="bg-success text-lg py-2 px-4 mt-1">
                <CheckCircle className="h-5 w-5 mr-2" />{t('payroll.paid')}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-lg py-2 px-4 mt-1">{t('payroll.pendingPayment')}</Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SEPA Generation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {t('payroll.sepaFile')}
          </CardTitle>
          <CardDescription>
            {t('payroll.sepaDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" onClick={handleGenerateSEPA} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            {sepaData ? t('payroll.regenerateSepa') : t('payroll.generateSepaFile')}
          </Button>

          {sepaData && (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">{t('payroll.fileGenerated')}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">{t('payroll.messageId')}:</span> {sepaData.messageId}</div>
                <div><span className="text-muted-foreground">{t('payroll.transactions')}:</span> {sepaData.numberOfTransactions}</div>
                <div><span className="text-muted-foreground">{t('common.total')}:</span> €{fmt(sepaData.controlSum)}</div>
                <div><span className="text-muted-foreground">{t('payroll.method')}:</span> {sepaData.paymentMethod} ({sepaData.serviceLevel})</div>
                <div><span className="text-muted-foreground">{t('payroll.debtorIban')}:</span> {sepaData.debtorIban ? `${sepaData.debtorIban.slice(0, 4)}****${sepaData.debtorIban.slice(-4)}` : '-'}</div>
                <div><span className="text-muted-foreground">{t('payroll.bic')}:</span> {sepaData.debtorBic || '-'}</div>
              </div>

              {/* Download XML button */}
              {sepaXml && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    const blob = new Blob([sepaXml], { type: 'application/xml' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = sepaFilename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  {t('payroll.downloadSepaXml')}
                </Button>
              )}

              {sepaData.payments && sepaData.payments.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('payroll.employee')}</TableHead>
                      <TableHead className="text-right">{t('payroll.amountLabel')}</TableHead>
                      <TableHead>{t('payroll.concept')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sepaData.payments.slice(0, 10).map((p: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell>{p.employee}</TableCell>
                        <TableCell className="text-right font-medium">€{fmt(p.amount)}</TableCell>
                        <TableCell className="text-muted-foreground">{p.concept}</TableCell>
                      </TableRow>
                    ))}
                    {sepaData.payments.length > 10 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          {t('payroll.andMore', { count: sepaData.payments.length - 10 })}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mark as Paid */}
      {!isPaid && (
        <Card className="border-primary">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BanknoteIcon className="h-8 w-8 text-primary" />
                <div>
                  <h3 className="font-medium">{t('payroll.confirmPayment')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('payroll.confirmPaymentDesc')}
                  </p>
                </div>
              </div>
              <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
                <DialogTrigger asChild>
                  <Button size="lg">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {t('payroll.markAsPaid')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('payroll.confirmPayment')}</DialogTitle>
                    <DialogDescription>
                      {t('payroll.confirmPaymentDialog', { amount: fmt(totalNet), count: payslipCount })}
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowPayDialog(false)}>{t("common.cancel")}</Button>
                    <Button onClick={handleMarkPaid} disabled={paying}>
                      {paying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {t('payroll.confirmPayBtn')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      )}

      {isPaid && (
        <Card className="border-success bg-success/5">
          <CardContent className="py-8 text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-success mb-4" />
            <h3 className="text-xl font-bold text-success mb-2">{t('payroll.payrollCompleted')}</h3>
            <p className="text-muted-foreground">
              {t('payroll.payrollCompletedDesc', { period: format(new Date(currentPeriod.year, currentPeriod.month - 1), 'MMMM yyyy', { locale: es }) })}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate('/payroll/submit')}>
          <ArrowLeft className="h-4 w-4 mr-2" />{t('payroll.submitBack')}
        </Button>
        <Button onClick={() => navigate('/payroll')} variant="default">
          <FileText className="h-4 w-4 mr-2" />
          {t('payroll.backToHome')}
        </Button>
      </div>
    </div>
  );
}
