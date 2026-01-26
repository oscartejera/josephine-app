import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { format, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';

export interface FiscalPeriod {
  year: number;
  quarter: number;
  label: string;
}

export interface IVABreakdown {
  rate: number;
  base: number;
  iva: number;
}

export interface FiscalMetrics {
  ivaRepercutido: number;
  ivaSoportado: number;
  ivaAPagar: number;
  baseImponibleVentas: number;
  baseImponibleCompras: number;
  totalVentas: number;
  totalCompras: number;
  ventasByRate: IVABreakdown[];
  comprasByRate: IVABreakdown[];
}

export interface FiscalMonthlyData {
  month: string;
  ivaRepercutido: number;
  ivaSoportado: number;
  ivaAPagar: number;
}

export interface FiscalInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  type: 'issued' | 'received';
  supplier_name: string | null;
  customer_name: string | null;
  base_amount: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  status: 'pending' | 'accounted' | 'paid';
  location_id: string | null;
}

const defaultMetrics: FiscalMetrics = {
  ivaRepercutido: 0,
  ivaSoportado: 0,
  ivaAPagar: 0,
  baseImponibleVentas: 0,
  baseImponibleCompras: 0,
  totalVentas: 0,
  totalCompras: 0,
  ventasByRate: [],
  comprasByRate: [],
};

export function getCurrentQuarter(): FiscalPeriod {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  return {
    year: now.getFullYear(),
    quarter,
    label: `Q${quarter} ${now.getFullYear()}`,
  };
}

export function getQuarterDateRange(year: number, quarter: number) {
  const startMonth = (quarter - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end = endOfQuarter(start);
  return { from: start, to: end };
}

export function getQuarterDeadline(year: number, quarter: number): Date {
  // Spanish deadlines: 20th of month after quarter ends
  const deadlineMonth = quarter * 3; // April (3), July (6), October (9), January (0)
  const deadlineYear = quarter === 4 ? year + 1 : year;
  return new Date(deadlineYear, deadlineMonth % 12, 20);
}

export function useFiscalData(
  selectedYear: number,
  selectedQuarter: number,
  selectedLocations: string[] = []
) {
  const { locations, loading: appLoading } = useApp();
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState<FiscalMetrics>(defaultMetrics);
  const [monthlyData, setMonthlyData] = useState<FiscalMonthlyData[]>([]);
  const [invoices, setInvoices] = useState<FiscalInvoice[]>([]);
  const [hasData, setHasData] = useState(false);

  const effectiveLocationIds = useMemo(() => {
    if (selectedLocations.length > 0) return selectedLocations;
    return locations.map(l => l.id);
  }, [selectedLocations, locations]);

  const dateRange = useMemo(() => 
    getQuarterDateRange(selectedYear, selectedQuarter),
    [selectedYear, selectedQuarter]
  );

  const fetchData = useCallback(async () => {
    if (appLoading || effectiveLocationIds.length === 0) return;

    setIsLoading(true);

    try {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      // Fetch IVA from ticket_lines (IVA Repercutido - Sales)
      const { data: ticketLines } = await supabase
        .from('ticket_lines')
        .select(`
          tax_rate,
          gross_line_total,
          discount_line_total,
          tickets!inner (
            status,
            closed_at,
            location_id
          )
        `)
        .gte('tickets.closed_at', `${fromDate}T00:00:00`)
        .lte('tickets.closed_at', `${toDate}T23:59:59`)
        .eq('tickets.status', 'closed')
        .in('tickets.location_id', effectiveLocationIds);

      // Fetch IVA from purchase_order_lines (IVA Soportado - Purchases)
      const { data: purchaseLines } = await supabase
        .from('purchase_order_lines')
        .select(`
          tax_rate,
          quantity,
          unit_cost,
          purchase_orders!inner (
            status,
            created_at,
            location_id
          )
        `)
        .gte('purchase_orders.created_at', `${fromDate}T00:00:00`)
        .lte('purchase_orders.created_at', `${toDate}T23:59:59`)
        .in('purchase_orders.status', ['sent', 'received'])
        .in('purchase_orders.location_id', effectiveLocationIds);

      // Fetch fiscal invoices
      const { data: invoicesData } = await supabase
        .from('fiscal_invoices')
        .select('*')
        .gte('invoice_date', fromDate)
        .lte('invoice_date', toDate)
        .order('invoice_date', { ascending: false });

      // Process IVA Repercutido (Sales)
      const ventasMap = new Map<number, { base: number; iva: number }>();
      let totalIvaRepercutido = 0;
      let totalBaseVentas = 0;

      (ticketLines || []).forEach(line => {
        const rate = line.tax_rate ?? 10;
        const base = (line.gross_line_total || 0) - (line.discount_line_total || 0);
        const iva = base * rate / 100;

        const existing = ventasMap.get(rate) || { base: 0, iva: 0 };
        ventasMap.set(rate, {
          base: existing.base + base,
          iva: existing.iva + iva,
        });

        totalIvaRepercutido += iva;
        totalBaseVentas += base;
      });

      // Process IVA Soportado (Purchases)
      const comprasMap = new Map<number, { base: number; iva: number }>();
      let totalIvaSoportado = 0;
      let totalBaseCompras = 0;

      (purchaseLines || []).forEach(line => {
        const rate = line.tax_rate ?? 10;
        const base = (line.quantity || 0) * (line.unit_cost || 0);
        const iva = base * rate / 100;

        const existing = comprasMap.get(rate) || { base: 0, iva: 0 };
        comprasMap.set(rate, {
          base: existing.base + base,
          iva: existing.iva + iva,
        });

        totalIvaSoportado += iva;
        totalBaseCompras += base;
      });

      // Convert maps to arrays
      const ventasByRate: IVABreakdown[] = Array.from(ventasMap.entries())
        .map(([rate, data]) => ({ rate, ...data }))
        .sort((a, b) => b.rate - a.rate);

      const comprasByRate: IVABreakdown[] = Array.from(comprasMap.entries())
        .map(([rate, data]) => ({ rate, ...data }))
        .sort((a, b) => b.rate - a.rate);

      setMetrics({
        ivaRepercutido: totalIvaRepercutido,
        ivaSoportado: totalIvaSoportado,
        ivaAPagar: totalIvaRepercutido - totalIvaSoportado,
        baseImponibleVentas: totalBaseVentas,
        baseImponibleCompras: totalBaseCompras,
        totalVentas: totalBaseVentas + totalIvaRepercutido,
        totalCompras: totalBaseCompras + totalIvaSoportado,
        ventasByRate,
        comprasByRate,
      });

      setInvoices((invoicesData || []) as FiscalInvoice[]);
      setHasData((ticketLines?.length || 0) > 0 || (purchaseLines?.length || 0) > 0);

      // Generate monthly breakdown for chart
      const monthlyMap = new Map<string, { rep: number; sop: number }>();
      
      (ticketLines || []).forEach(line => {
        const closedAt = (line.tickets as any)?.closed_at;
        if (!closedAt) return;
        const monthKey = format(new Date(closedAt), 'yyyy-MM');
        const rate = line.tax_rate ?? 10;
        const base = (line.gross_line_total || 0) - (line.discount_line_total || 0);
        const iva = base * rate / 100;
        
        const existing = monthlyMap.get(monthKey) || { rep: 0, sop: 0 };
        monthlyMap.set(monthKey, { ...existing, rep: existing.rep + iva });
      });

      (purchaseLines || []).forEach(line => {
        const createdAt = (line.purchase_orders as any)?.created_at;
        if (!createdAt) return;
        const monthKey = format(new Date(createdAt), 'yyyy-MM');
        const rate = line.tax_rate ?? 10;
        const base = (line.quantity || 0) * (line.unit_cost || 0);
        const iva = base * rate / 100;
        
        const existing = monthlyMap.get(monthKey) || { rep: 0, sop: 0 };
        monthlyMap.set(monthKey, { ...existing, sop: existing.sop + iva });
      });

      const monthly: FiscalMonthlyData[] = Array.from(monthlyMap.entries())
        .map(([month, data]) => ({
          month,
          ivaRepercutido: data.rep,
          ivaSoportado: data.sop,
          ivaAPagar: data.rep - data.sop,
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      setMonthlyData(monthly);

    } catch (error) {
      console.error('Error fetching fiscal data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [appLoading, effectiveLocationIds, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    isLoading,
    metrics,
    monthlyData,
    invoices,
    hasData,
    dateRange,
    refetch: fetchData,
  };
}
