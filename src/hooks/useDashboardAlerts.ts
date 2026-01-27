import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useApp } from '@/contexts/AppContext';
import type { Alert } from '@/components/dashboard/AlertsPanel';

interface DashboardAlertsResult {
  alerts: Alert[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Fetches dynamic alerts based on real KPI data from the POS.
 * Alerts are generated based on:
 * - COL% vs target (labour cost)
 * - Sales vs forecast
 * - Waste thresholds
 * - Low stock levels
 */
export function useDashboardAlerts(
  dateFrom: Date,
  dateTo: Date
): DashboardAlertsResult {
  const { selectedLocationId, group } = useApp();

  const query = useQuery({
    queryKey: ['dashboard-alerts', selectedLocationId, dateFrom.toISOString(), dateTo.toISOString()],
    queryFn: async () => {
      const alerts: Alert[] = [];
      const dateFromStr = format(dateFrom, 'yyyy-MM-dd');
      const dateToStr = format(dateTo, 'yyyy-MM-dd');

      // 1. Get labour KPIs via RPC
      try {
        const { data: labourData } = await supabase.rpc('get_labour_kpis', {
          date_from: dateFromStr,
          date_to: dateToStr,
          selected_location_id: selectedLocationId && selectedLocationId !== 'all' ? selectedLocationId : null
        });

        if (labourData && typeof labourData === 'object' && !Array.isArray(labourData)) {
          const data = labourData as Record<string, unknown>;
          const actualCol = Number(data.actual_col_pct) || 0;
          const plannedCol = Number(data.planned_col_pct) || 22;
          
          // Alert if COL% is 10% above target
          if (actualCol > plannedCol * 1.1 && actualCol > 0) {
            alerts.push({
              id: 'col-high',
              type: 'warning',
              title: 'Labor alto',
              description: `COL% ${actualCol.toFixed(1)}% vs objetivo ${plannedCol.toFixed(1)}%`,
              metric: `${actualCol.toFixed(1)}%`,
              trend: 'up'
            });
          }

          // Alert if sales are 10% below forecast
          const actualSales = Number(data.actual_sales) || 0;
          const forecastSales = Number(data.forecast_sales) || 0;
          
          if (forecastSales > 0) {
            const salesDelta = ((actualSales - forecastSales) / forecastSales) * 100;
            if (salesDelta < -10) {
              alerts.push({
                id: 'sales-below-forecast',
                type: 'warning',
                title: 'Ventas bajo forecast',
                description: `Ventas ${Math.abs(salesDelta).toFixed(1)}% por debajo del forecast`,
                metric: `${salesDelta.toFixed(1)}%`,
                trend: 'down'
              });
            }
          }

          // Alert if GP% is dropping significantly
          const gpDelta = Number(data.splh_delta_pct) || 0;
          if (gpDelta < -5) {
            alerts.push({
              id: 'gp-declining',
              type: 'error',
              title: 'Margen cayendo',
              description: `Productividad SPLH bajando vs periodo anterior`,
              metric: `${gpDelta.toFixed(1)}%`,
              trend: 'down'
            });
          }
        }
      } catch {
        // Silently handle - alerts are non-critical
      }

      // 2. Check Waste levels
      try {
        let wasteQuery = supabase
          .from('waste_events')
          .select('waste_value, location_id')
          .gte('created_at', `${dateFromStr}T00:00:00`)
          .lte('created_at', `${dateToStr}T23:59:59`);

        if (selectedLocationId && selectedLocationId !== 'all') {
          wasteQuery = wasteQuery.eq('location_id', selectedLocationId);
        }

        const { data: wasteData } = await wasteQuery;

        const totalWaste = wasteData?.reduce((sum, w) => sum + (w.waste_value || 0), 0) || 0;
        
        // Alert if waste exceeds €100 in the period
        if (totalWaste > 100) {
          alerts.push({
            id: 'waste-high',
            type: 'warning',
            title: 'Waste elevado',
            description: `€${totalWaste.toFixed(0)} de waste en el periodo`,
            metric: `€${totalWaste.toFixed(0)}`
          });
        }
      } catch {
        // Silently handle - alerts are non-critical
      }

      // 3. Check Low Stock Levels
      if (group?.id) {
        try {
          const { data: lowStockItems } = await supabase
            .from('inventory_items')
            .select('name, current_stock, par_level')
            .eq('group_id', group.id)
            .not('par_level', 'is', null);

          const criticalItems = lowStockItems?.filter(
            item => (item.current_stock || 0) < (item.par_level || 0) * 0.3
          ) || [];

          if (criticalItems.length > 0) {
            alerts.push({
              id: 'stock-critical',
              type: 'error',
              title: 'Stock crítico',
              description: `${criticalItems.length} productos por debajo del 30% de par level`,
              metric: `${criticalItems.length}`
            });
          }
        } catch {
          // Silently handle - alerts are non-critical
        }
      }

      // 4. Check for pending voids/comps (from ticket_lines)
      try {
        let ticketQuery = supabase
          .from('tickets')
          .select('id')
          .eq('status', 'closed')
          .gte('closed_at', `${dateFromStr}T00:00:00`)
          .lte('closed_at', `${dateToStr}T23:59:59`);

        if (selectedLocationId && selectedLocationId !== 'all') {
          ticketQuery = ticketQuery.eq('location_id', selectedLocationId);
        }

        const { data: tickets, count: totalTickets } = await ticketQuery;
        
        if (tickets && tickets.length > 0) {
          const ticketIds = tickets.map(t => t.id);
          
          // Count voided lines (assuming voided_at field exists or quantity < 0)
          const { count: voidCount } = await supabase
            .from('ticket_lines')
            .select('id', { count: 'exact', head: true })
            .in('ticket_id', ticketIds.slice(0, 100)) // Limit for performance
            .lt('quantity', 0);

          const voidPercent = totalTickets ? ((voidCount || 0) / (totalTickets || 1)) * 100 : 0;
          
          if (voidPercent > 2) {
            alerts.push({
              id: 'voids-high',
              type: 'info',
              title: 'Comps/Voids',
              description: `${voidPercent.toFixed(1)}% de líneas anuladas`,
              metric: `${voidPercent.toFixed(1)}%`
            });
          }
        }
      } catch (err) {
        console.error('Error fetching voids for alerts:', err);
      }

      // Sort alerts by severity
      const severityOrder = { error: 0, warning: 1, info: 2 };
      alerts.sort((a, b) => severityOrder[a.type] - severityOrder[b.type]);

      return alerts;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false
  });

  return {
    alerts: query.data || [],
    isLoading: query.isLoading,
    error: query.error as Error | null
  };
}
