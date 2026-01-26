import { useState, useMemo } from 'react';
import { usePermissions, PERMISSIONS } from '@/hooks/usePermissions';
import { NoAccess } from '@/components/common/NoAccess';
import { useFiscalData, getCurrentQuarter } from '@/hooks/useFiscalData';
import {
  FiscalHeader,
  FiscalKPICards,
  IVABreakdownChart,
  IVATrendChart,
  InvoiceLedgerTable,
  Model303Preview,
  FiscalAlertBanner,
} from '@/components/fiscal';
import { useToast } from '@/hooks/use-toast';

export default function Fiscal() {
  const { hasPermission, loading: permLoading, isOwner } = usePermissions();
  const { toast } = useToast();

  const currentQuarter = useMemo(() => getCurrentQuarter(), []);
  const [selectedYear, setSelectedYear] = useState(currentQuarter.year);
  const [selectedQuarter, setSelectedQuarter] = useState(currentQuarter.quarter);

  const { 
    isLoading, 
    metrics, 
    monthlyData, 
    invoices, 
    hasData 
  } = useFiscalData(selectedYear, selectedQuarter);

  // Check permission
  const canView = isOwner || hasPermission('fiscal.view');

  if (permLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!canView) {
    return <NoAccess />;
  }

  const handleExport = () => {
    toast({
      title: 'Exportación',
      description: 'Función de exportación próximamente disponible.',
    });
  };

  const handleGenerateModel303 = () => {
    toast({
      title: 'Modelo 303',
      description: 'Abriendo vista previa del Modelo 303...',
    });
  };

  const handleAddInvoice = () => {
    toast({
      title: 'Nueva factura',
      description: 'Formulario de factura próximamente disponible.',
    });
  };

  return (
    <div className="space-y-6 p-6">
      <FiscalAlertBanner year={selectedYear} quarter={selectedQuarter} />

      <FiscalHeader
        selectedYear={selectedYear}
        selectedQuarter={selectedQuarter}
        onYearChange={setSelectedYear}
        onQuarterChange={setSelectedQuarter}
        onExport={handleExport}
        onGenerateModel303={handleGenerateModel303}
      />

      <FiscalKPICards
        metrics={metrics}
        selectedYear={selectedYear}
        selectedQuarter={selectedQuarter}
        isLoading={isLoading}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <IVATrendChart data={monthlyData} isLoading={isLoading} />
        </div>
        <div>
          <Model303Preview
            metrics={metrics}
            year={selectedYear}
            quarter={selectedQuarter}
            isLoading={isLoading}
          />
        </div>
      </div>

      <IVABreakdownChart
        ventasByRate={metrics.ventasByRate}
        comprasByRate={metrics.comprasByRate}
        isLoading={isLoading}
      />

      <InvoiceLedgerTable
        invoices={invoices}
        isLoading={isLoading}
        onAddInvoice={handleAddInvoice}
      />
    </div>
  );
}
