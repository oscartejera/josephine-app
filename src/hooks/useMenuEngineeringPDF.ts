import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import type { MenuEngineeringItem, MenuEngineeringStats } from '@/hooks/useMenuEngineeringData';

const CLASS_LABEL: Record<string, string> = {
  star: '⭐ Star',
  plow_horse: '🐴 Plow Horse',
  puzzle: '💎 Puzzle',
  dog: '🔍 Dog',
};

const CLASS_ACTION: Record<string, string> = {
  star: 'Protect — keep recipe consistent, maintain visibility',
  plow_horse: 'Improve margins — review cost or raise price slightly',
  puzzle: 'Promote more — better placement, train staff to recommend',
  dog: 'Rethink — redesign, replace, or remove',
};

const CLASS_COLOR: Record<string, [number, number, number]> = {
  star: [16, 185, 129],      // emerald
  plow_horse: [59, 130, 246], // blue
  puzzle: [245, 158, 11],     // amber
  dog: [239, 68, 68],         // red
};

function formatCurrency(value: number): string {
  return `€${value.toFixed(2)}`;
}

interface PDFOptions {
  items: MenuEngineeringItem[];
  stats: MenuEngineeringStats | null;
  locationName: string;
  categoryName: string | null;
  dateFrom: Date;
  dateTo: Date;
}

/**
 * Generate a professional Menu Engineering PDF report.
 *
 * Sections:
 * 1. Header with title, location, date range
 * 2. KPI Summary (Stars/PH/Puzzles/Dogs + financial metrics)
 * 3. Classification table (all items with key metrics)
 * 4. Action Plan (grouped recommendations by quadrant)
 * 5. Footer with methodology reference
 */
export function generateMenuEngineeringPDF({
  items,
  stats,
  locationName,
  categoryName,
  dateFrom,
  dateTo,
}: PDFOptions): void {
  if (!stats || items.length === 0) return;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = margin;

  // ── Colors ──
  const primary: [number, number, number] = [109, 40, 217]; // violet-600
  const textDark: [number, number, number] = [30, 30, 30];
  const textMuted: [number, number, number] = [120, 120, 120];

  // ── Helper: add page footer ──
  const addFooter = () => {
    doc.setFontSize(7);
    doc.setTextColor(...textMuted);
    doc.text(
      `Josephine Menu Engineering Report · ${format(new Date(), 'dd/MM/yyyy HH:mm')} · Kasavana & Smith (1982)`,
      margin,
      pageHeight - 6,
    );
    doc.text(
      `Page ${(doc as any).internal.getNumberOfPages()}`,
      pageWidth - margin,
      pageHeight - 6,
      { align: 'right' },
    );
  };

  // ═══════════════════════════════════════════════════════════
  // SECTION 1: HEADER
  // ═══════════════════════════════════════════════════════════
  // Purple header bar
  doc.setFillColor(...primary);
  doc.rect(0, 0, pageWidth, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Menu Profitability Report', margin, 14);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const subtitle = [
    locationName,
    categoryName ? `Category: ${categoryName}` : 'All categories',
    `${format(dateFrom, 'dd MMM yyyy')} — ${format(dateTo, 'dd MMM yyyy')}`,
  ].join(' · ');
  doc.text(subtitle, margin, 20);

  y = 30;

  // ═══════════════════════════════════════════════════════════
  // SECTION 2: KPI CARDS
  // ═══════════════════════════════════════════════════════════
  doc.setTextColor(...textDark);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary', margin, y);
  y += 5;

  const kpiData = [
    { label: 'Stars', value: String(stats.stars), color: CLASS_COLOR.star },
    { label: 'Plow Horses', value: String(stats.plowHorses), color: CLASS_COLOR.plow_horse },
    { label: 'Puzzles', value: String(stats.puzzles), color: CLASS_COLOR.puzzle },
    { label: 'Dogs', value: String(stats.dogs), color: CLASS_COLOR.dog },
  ];

  const kpiWidth = (pageWidth - margin * 2 - 3 * 6) / 4;
  kpiData.forEach((kpi, idx) => {
    const x = margin + idx * (kpiWidth + 6);
    doc.setFillColor(245, 245, 250);
    doc.roundedRect(x, y, kpiWidth, 16, 2, 2, 'F');
    doc.setFillColor(...kpi.color);
    doc.rect(x, y, 3, 16, 'F');

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...kpi.color);
    doc.text(kpi.value, x + kpiWidth / 2, y + 8, { align: 'center' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textMuted);
    doc.text(kpi.label, x + kpiWidth / 2, y + 13, { align: 'center' });
  });

  y += 22;

  // Financial summary row
  const totalRevenue = items.reduce((s, i) => s + i.selling_price_ex_vat * i.units_sold, 0);
  const totalGP = stats.totalGrossProfit;
  const totalUnits = stats.totalUnits;
  const avgFcPct = totalRevenue > 0
    ? (items.reduce((s, i) => s + i.unit_food_cost * i.units_sold, 0) / totalRevenue) * 100
    : 0;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textDark);
  doc.text(
    `${items.length} products · ${totalUnits.toLocaleString()} plates sold · Revenue: ${formatCurrency(totalRevenue)} · Gross Profit: ${formatCurrency(totalGP)} · Avg FC: ${avgFcPct.toFixed(1)}% · Avg profit/plate: ${formatCurrency(stats.marginThreshold)}`,
    margin,
    y,
  );
  y += 8;

  // ═══════════════════════════════════════════════════════════
  // SECTION 3: CLASSIFICATION TABLE
  // ═══════════════════════════════════════════════════════════
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textDark);
  doc.text('Product Classification', margin, y);
  y += 3;

  // Sort: Stars first, then Plow Horses, Puzzles, Dogs — within each by total GP desc
  const classOrder: Record<string, number> = { star: 0, plow_horse: 1, puzzle: 2, dog: 3 };
  const sortedItems = [...items].sort((a, b) => {
    const orderDiff = (classOrder[a.classification] ?? 4) - (classOrder[b.classification] ?? 4);
    if (orderDiff !== 0) return orderDiff;
    return b.total_gross_profit - a.total_gross_profit;
  });

  autoTable(doc, {
    startY: y,
    head: [['Product', 'Category', 'Price', 'Food Cost', 'FC%', 'Sold', 'GP/plate', 'Total GP', 'Type']],
    body: sortedItems.map(item => {
      const fcPct = item.selling_price_ex_vat > 0
        ? ((item.unit_food_cost / item.selling_price_ex_vat) * 100).toFixed(0) + '%'
        : '—';
      return [
        item.name,
        item.category,
        formatCurrency(item.selling_price_ex_vat),
        formatCurrency(item.unit_food_cost),
        fcPct,
        item.units_sold.toLocaleString(),
        formatCurrency(item.unit_gross_profit),
        formatCurrency(item.total_gross_profit),
        CLASS_LABEL[item.classification] || item.classification,
      ];
    }),
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.5,
      textColor: textDark,
      lineColor: [220, 220, 225],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: primary,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 45 },  // Product name — wider
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
    },
    willDrawCell: (data: any) => {
      // Color the Type column background
      if (data.section === 'body' && data.column.index === 8) {
        const classification = sortedItems[data.row.index]?.classification;
        if (classification && CLASS_COLOR[classification]) {
          const [r, g, b] = CLASS_COLOR[classification];
          doc.setFillColor(r, g, b, 0.15);
        }
      }
    },
    didDrawPage: () => addFooter(),
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // ═══════════════════════════════════════════════════════════
  // SECTION 4: ACTION PLAN
  // ═══════════════════════════════════════════════════════════
  // Check if we need a new page
  if (y > pageHeight - 60) {
    doc.addPage();
    y = margin;
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textDark);
  doc.text('Action Plan', margin, y);
  y += 6;

  const classifications: Array<{ key: string; label: string }> = [
    { key: 'star', label: '⭐ Stars — Keep & Protect' },
    { key: 'plow_horse', label: '🐴 Plow Horses — Improve Margins' },
    { key: 'puzzle', label: '💎 Puzzles — Promote More' },
    { key: 'dog', label: '🔍 Dogs — Rethink or Remove' },
  ];

  for (const cls of classifications) {
    const classItems = sortedItems.filter(i => i.classification === cls.key);
    if (classItems.length === 0) continue;

    if (y > pageHeight - 25) {
      doc.addPage();
      y = margin;
    }

    doc.setFillColor(...CLASS_COLOR[cls.key]);
    doc.rect(margin, y - 3, 2, 14, 'F');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...CLASS_COLOR[cls.key]);
    doc.text(`${cls.label} (${classItems.length})`, margin + 5, y);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textMuted);
    doc.text(CLASS_ACTION[cls.key], margin + 5, y + 4);

    doc.setTextColor(...textDark);
    const itemNames = classItems.map(i => i.name).join(', ');
    const lines = doc.splitTextToSize(itemNames, pageWidth - margin * 2 - 10);
    doc.text(lines.slice(0, 2), margin + 5, y + 8);

    y += 18 + (lines.length > 1 ? 4 : 0);
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 5: METHODOLOGY FOOTER
  // ═══════════════════════════════════════════════════════════
  if (y > pageHeight - 20) {
    doc.addPage();
    y = margin;
  }

  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  doc.setFontSize(7);
  doc.setTextColor(...textMuted);
  doc.text(
    'Methodology: Kasavana & Smith (1982) — per-category analysis. Popularity: 70% rule threshold. Profitability: weighted average GP.',
    margin, y,
  );
  doc.text(
    'Generated by Josephine · For restaurant use only · All prices ex-VAT (10%)',
    margin, y + 4,
  );

  addFooter();

  // ── Save ──
  const fileName = [
    'menu-engineering',
    locationName.toLowerCase().replace(/\s+/g, '-'),
    format(dateFrom, 'yyyy-MM-dd'),
  ].join('_');
  doc.save(`${fileName}.pdf`);
}
