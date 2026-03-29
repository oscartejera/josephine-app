import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import type { WasteMetrics, WasteByReason, WasteByCategory, WasteItem } from '@/hooks/useWasteData';
import type { ShiftData, WastePattern } from '@/hooks/useWasteShiftAnalysis';

// ── Branding ──
const PRIMARY: [number, number, number] = [99, 91, 255]; // Josephine purple
const TEXT_DARK: [number, number, number] = [30, 30, 40];
const EMERALD: [number, number, number] = [16, 185, 129];
const RED: [number, number, number] = [239, 68, 68];
const AMBER: [number, number, number] = [245, 158, 11];
const MUTED: [number, number, number] = [120, 120, 140];

function fmt(value: number): string {
  return `€${value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(value: number): string {
  return `${value.toFixed(2)}%`;
}

// ── Severity colors ──
const SEVERITY_COLORS: Record<string, [number, number, number]> = {
  high: RED,
  medium: AMBER,
  low: [59, 130, 246], // blue
};

export interface WastePDFOptions {
  metrics: WasteMetrics;
  wasteTarget: number;
  items: WasteItem[];
  byReason: WasteByReason[];
  byCategory: WasteByCategory[];
  shiftData: ShiftData[];
  patterns: WastePattern[];
  dateFrom: Date;
  dateTo: Date;
  locationName: string;
}

/**
 * Generate a comprehensive Waste Management PDF report.
 *
 * Sections:
 * 1. Header — title, location, period
 * 2. KPI Summary — key metrics + target comparison
 * 3. P&L Impact — financial impact on food cost and margins
 * 4. Top Waste Items — ranked table
 * 5. Waste by Reason — breakdown table
 * 6. Waste by Category — breakdown table
 * 7. Shift Analysis — morning/afternoon/night
 * 8. Detected Patterns — auto-detected anomalies
 * 9. Footer
 */
export function generateWastePDF(options: WastePDFOptions) {
  const {
    metrics, wasteTarget, items, byReason, byCategory,
    shiftData, patterns, dateFrom, dateTo, locationName,
  } = options;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // ─── Section 1: Header ───
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageWidth, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Informe de Merma', 14, 14);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${locationName} · ${format(dateFrom, 'dd MMM yyyy')} – ${format(dateTo, 'dd MMM yyyy')}`, 14, 22);
  doc.setFontSize(8);
  doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);
  y = 40;

  // ─── Section 2: KPI Summary ───
  doc.setTextColor(...TEXT_DARK);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen de KPIs', 14, y);
  y += 8;

  const targetDiff = wasteTarget - metrics.wastePercentOfSales;
  const isOnTarget = metrics.wastePercentOfSales <= wasteTarget;
  const savingsVsTarget = (wasteTarget / 100) * metrics.totalSales - metrics.totalAccountedWaste;

  const kpiData = [
    ['Ventas Totales', fmt(metrics.totalSales)],
    ['Merma Total', fmt(metrics.totalAccountedWaste)],
    ['% Merma vs Ventas', fmtPct(metrics.wastePercentOfSales)],
    ['Objetivo', fmtPct(wasteTarget)],
    ['Estado', isOnTarget ? `✓ OK (${targetDiff.toFixed(1)}pp por debajo)` : `✗ Excedido (+${Math.abs(targetDiff).toFixed(1)}pp)`],
    ['Ahorro vs Objetivo', isOnTarget ? `+${fmt(savingsVsTarget)}` : `-${fmt(Math.abs(savingsVsTarget))}`],
  ];

  autoTable(doc, {
    startY: y,
    body: kpiData,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2, textColor: TEXT_DARK },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 55 },
      1: { halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.row.index === 4 && data.column.index === 1) {
        data.cell.styles.textColor = isOnTarget ? EMERALD : RED;
        data.cell.styles.fontStyle = 'bold';
      }
      if (data.row.index === 5 && data.column.index === 1) {
        data.cell.styles.textColor = isOnTarget ? EMERALD : RED;
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ─── Section 3: P&L Impact ───
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Impacto en P&L', 14, y);
  y += 3;

  const foodCostInflation = metrics.totalSales > 0
    ? (metrics.totalAccountedWaste / metrics.totalSales) * 100
    : 0;
  const annualizedWaste = metrics.totalAccountedWaste * 12; // monthly → annual estimate
  const potentialSavings = isOnTarget
    ? 0
    : ((metrics.wastePercentOfSales - wasteTarget) / 100) * metrics.totalSales;

  const pnlData = [
    ['Inflación de Food Cost por merma', fmtPct(foodCostInflation)],
    ['Merma mensual', fmt(metrics.totalAccountedWaste)],
    ['Impacto anualizado (estimado)', fmt(annualizedWaste)],
    ['Ahorro potencial si se alcanza objetivo', fmt(potentialSavings)],
    ['Merma por cada €1.000 de ventas', fmt((metrics.totalAccountedWaste / Math.max(metrics.totalSales, 1)) * 1000)],
  ];

  autoTable(doc, {
    startY: y,
    body: pnlData,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2, textColor: TEXT_DARK },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 80 },
      1: { halign: 'right' },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ─── Section 4: Top Waste Items ───
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Top Ítems con Merma', 14, y);
  y += 3;

  const topItems = items.slice(0, 15);
  autoTable(doc, {
    startY: y,
    head: [['Ítem', 'Cantidad', 'Valor', 'Motivo Top', '% Ventas']],
    body: topItems.map(item => [
      item.itemName,
      item.quantity.toFixed(2),
      fmt(item.value),
      item.topReason,
      fmtPct(item.percentOfSales),
    ]),
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.5, textColor: TEXT_DARK, lineColor: [220, 220, 225], lineWidth: 0.2 },
    headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { halign: 'right' },
      2: { halign: 'right' },
      4: { halign: 'right' },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ─── Page break if needed ───
  if (y > 240) { doc.addPage(); y = 15; }

  // ─── Section 5: Waste by Reason ───
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Desglose por Motivo', 14, y);
  y += 3;

  const totalWasteValue = byReason.reduce((s, r) => s + r.value, 0);
  autoTable(doc, {
    startY: y,
    head: [['Motivo', 'Eventos', 'Valor', '% del Total']],
    body: byReason.map(r => [
      r.reason,
      r.count.toString(),
      fmt(r.value),
      totalWasteValue > 0 ? fmtPct((r.value / totalWasteValue) * 100) : '0%',
    ]),
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.5, textColor: TEXT_DARK, lineColor: [220, 220, 225], lineWidth: 0.2 },
    headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ─── Section 6: Waste by Category ───
  if (byCategory.length > 0) {
    if (y > 240) { doc.addPage(); y = 15; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Desglose por Categoría', 14, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [['Categoría', '% del Total', 'Valor']],
      body: byCategory.map(c => [
        c.category,
        fmtPct(c.percentOfTotal),
        fmt(c.value),
      ]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.5, textColor: TEXT_DARK, lineColor: [220, 220, 225], lineWidth: 0.2 },
      headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ─── Section 7: Shift Analysis ───
  if (shiftData.length > 0) {
    if (y > 240) { doc.addPage(); y = 15; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Análisis por Turno', 14, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [['Turno', 'Horario', 'Eventos', 'Valor', '% del Total', 'Motivo Top']],
      body: shiftData.map(s => [
        s.label,
        s.timeRange,
        s.totalCount.toString(),
        fmt(s.totalValue),
        fmtPct(s.percentOfTotal),
        s.topReason,
      ]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.5, textColor: TEXT_DARK, lineColor: [220, 220, 225], lineWidth: 0.2 },
      headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ─── Section 8: Detected Patterns ───
  if (patterns.length > 0) {
    if (y > 240) { doc.addPage(); y = 15; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Patrones Detectados', 14, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [['Severidad', 'Patrón', 'Descripción', 'Métrica']],
      body: patterns.map(p => [
        p.severity === 'high' ? 'ALTA' : p.severity === 'medium' ? 'MEDIA' : 'BAJA',
        p.title,
        p.description,
        p.metric,
      ]),
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 1.5, textColor: TEXT_DARK, lineColor: [220, 220, 225], lineWidth: 0.2 },
      headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 35 },
        3: { cellWidth: 30, halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 0) {
          const sev = data.cell.raw as string;
          if (sev === 'ALTA') data.cell.styles.textColor = RED;
          else if (sev === 'MEDIA') data.cell.styles.textColor = AMBER;
          else data.cell.styles.textColor = [59, 130, 246];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ─── Footer ───
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(
      `Josephine · Informe de Merma · Página ${i}/${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: 'center' }
    );
  }

  // ─── Save ───
  const fileName = `waste-report-${format(dateFrom, 'yyyyMMdd')}-${format(dateTo, 'yyyyMMdd')}.pdf`;
  doc.save(fileName);
}
