import type { DashboardKpis, KpiResult } from '@/hooks/useDashboardMetrics';
import type { HonestProduct } from '@/hooks/useTopProductsHonest';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Insight {
  text: string;
  type: 'action' | 'risk' | 'info';
}

export interface DashboardInsights {
  actions: Insight[];
  risks: Insight[];
  missing: string[];
}

export interface LowStockItem {
  name: string;
  percentOfPar: number | null;
}

// ---------------------------------------------------------------------------
// Thresholds (configurable per-restaurant via location_settings later)
// ---------------------------------------------------------------------------

const COL_HIGH = 30;       // COL% above this = staffing concern
const COL_VERY_HIGH = 35;
const GP_LOW = 60;         // GP% below this = margin concern
const GP_CRITICAL = 50;
const AVG_TICKET_LOW = 10; // €10 avg ticket is low for a restaurant
const SALES_CONCENTRATION = 15; // Single product > 15% = risk

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function val(kpi: KpiResult): number | null {
  return kpi.available ? kpi.value : null;
}

function fmtEur(v: number): string {
  return `€${v.toLocaleString('es-ES', { maximumFractionDigits: 0 })}`;
}

function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export function buildDashboardInsights(
  kpis: DashboardKpis | null,
  previousKpis: DashboardKpis | null,
  topProducts: HonestProduct[] | null,
  lowStockItems: LowStockItem[] | null,
): DashboardInsights {
  const actions: Insight[] = [];
  const risks: Insight[] = [];
  const missing: string[] = [];

  if (!kpis) {
    return { actions, risks, missing: ['No hay datos de KPIs disponibles para generar insights.'] };
  }

  const sales = val(kpis.sales);
  const labor = val(kpis.labor);
  const colPct = val(kpis.colPercent);
  const gpPct = val(kpis.gpPercent);
  const cogs = val(kpis.cogs);
  const covers = val(kpis.covers);
  const avgTicket = val(kpis.avgTicket);

  const prevSales = previousKpis ? val(previousKpis.sales) : null;
  const prevColPct = previousKpis ? val(previousKpis.colPercent) : null;
  const prevGpPct = previousKpis ? val(previousKpis.gpPercent) : null;

  // ---- Track what data is missing ----
  if (sales === null) missing.push('ventas');
  if (labor === null) missing.push('coste laboral');
  if (cogs === null) missing.push('COGS (recetas/costes no configurados)');
  if (covers === null) missing.push('covers');

  // ---- COL% rules ----
  if (colPct !== null && sales !== null) {
    if (colPct >= COL_VERY_HIGH) {
      risks.push({
        text: `COL% en ${fmtPct(colPct)} — muy alto. Revisa turnos: posible sobre-staffing o ventas bajas.`,
        type: 'risk',
      });
    } else if (colPct >= COL_HIGH) {
      if (sales !== null && prevSales !== null && sales < prevSales * 0.9) {
        actions.push({
          text: `COL% en ${fmtPct(colPct)} con ventas cayendo. Considera ajustar plantilla para el próximo turno.`,
          type: 'action',
        });
      } else {
        actions.push({
          text: `COL% en ${fmtPct(colPct)} — por encima del objetivo. Monitoriza la evolución en el turno actual.`,
          type: 'action',
        });
      }
    } else if (colPct < 20 && labor !== null && labor > 0) {
      actions.push({
        text: `COL% en ${fmtPct(colPct)} — muy bajo. ¿Suficiente personal para mantener la calidad de servicio?`,
        type: 'action',
      });
    }
  }

  // ---- GP% rules ----
  if (gpPct !== null) {
    if (gpPct < GP_CRITICAL) {
      risks.push({
        text: `GP% en ${fmtPct(gpPct)} — por debajo del umbral crítico. Revisa costes de ingredientes y mermas.`,
        type: 'risk',
      });
    } else if (gpPct < GP_LOW) {
      const trending = prevGpPct !== null && gpPct < prevGpPct
        ? ' y bajando vs periodo anterior'
        : '';
      actions.push({
        text: `GP% en ${fmtPct(gpPct)}${trending}. Revisa productos con peor margen y valora ajustes de precio o receta.`,
        type: 'action',
      });
    }
  }

  // ---- Covers + Avg Ticket rules ----
  if (covers !== null && avgTicket !== null && sales !== null) {
    if (covers > 0 && avgTicket < AVG_TICKET_LOW) {
      actions.push({
        text: `Ticket medio en €${avgTicket.toFixed(2)} con ${covers} covers. Oportunidad de upsell: sugiere combos, postres o bebidas.`,
        type: 'action',
      });
    }
  }

  // ---- Sales trend ----
  if (sales !== null && prevSales !== null && prevSales > 0) {
    const delta = ((sales - prevSales) / prevSales) * 100;
    if (delta < -15) {
      risks.push({
        text: `Ventas caen ${Math.abs(delta).toFixed(0)}% vs periodo anterior (${fmtEur(sales)} vs ${fmtEur(prevSales)}).`,
        type: 'risk',
      });
    } else if (delta > 15) {
      actions.push({
        text: `Ventas suben ${delta.toFixed(0)}% vs periodo anterior. Asegura stock y personal suficiente.`,
        type: 'action',
      });
    }
  }

  // ---- Top Products concentration ----
  if (topProducts && topProducts.length > 0) {
    const concentrated = topProducts.filter(p => p.pctSales >= SALES_CONCENTRATION);
    if (concentrated.length > 0) {
      const names = concentrated.map(p => p.name).join(', ');
      risks.push({
        text: `Alta dependencia de ${concentrated.length === 1 ? 'un producto' : `${concentrated.length} productos`}: ${names} (>${SALES_CONCENTRATION}% ventas). Riesgo si hay rotura de stock.`,
        type: 'risk',
      });
    }

    // Products with bad GP
    const badGp = topProducts.filter(p => p.gpPct !== null && p.gpPct < 40);
    if (badGp.length > 0) {
      const names = badGp.slice(0, 3).map(p => `${p.name} (${fmtPct(p.gpPct!)})`).join(', ');
      actions.push({
        text: `Productos top con margen bajo: ${names}. Revisa receta o precio de venta.`,
        type: 'action',
      });
    }
  }

  // ---- Low stock alerts ----
  if (lowStockItems && lowStockItems.length > 0) {
    const withPar = lowStockItems.filter(i => i.percentOfPar !== null);
    const critical = withPar.filter(i => i.percentOfPar! <= 25);
    if (critical.length > 0) {
      const names = critical.slice(0, 3).map(i => i.name).join(', ');
      risks.push({
        text: `Stock crítico: ${names}. Riesgo de rotura inminente — genera pedido urgente.`,
        type: 'risk',
      });
    } else {
      const names = lowStockItems.slice(0, 3).map(i => i.name).join(', ');
      actions.push({
        text: `Stock bajo en ${lowStockItems.length} items (${names}). Revisa necesidades de compra.`,
        type: 'action',
      });
    }
  }

  // ---- Positive reinforcement (only if we have enough data) ----
  if (
    colPct !== null && colPct <= 25 &&
    gpPct !== null && gpPct >= 65 &&
    sales !== null && sales > 0
  ) {
    actions.push({
      text: `Buen balance: GP% ${fmtPct(gpPct)} y COL% ${fmtPct(colPct)} dentro de objetivo. Mantén la operación.`,
      type: 'info',
    });
  }

  return { actions, risks, missing };
}
