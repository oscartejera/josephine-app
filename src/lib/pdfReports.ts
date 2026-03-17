/**
 * PDF Report Generator — Professional branded PDFs
 * 
 * Uses jsPDF + jspdf-autotable for client-side generation.
 * Exports: P&L Report, Payroll Summary, Weekly Summary.
 * All data passed in — no hardcoded values.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Josephine brand config ──

const BRAND = {
    primary: [124, 58, 237] as [number, number, number],     // #7c3aed
    primaryDark: [109, 40, 217] as [number, number, number],  // #6d28d9
    text: [17, 24, 39] as [number, number, number],           // #111827
    textLight: [107, 114, 128] as [number, number, number],   // #6b7280
    white: [255, 255, 255] as [number, number, number],
    green: [22, 163, 74] as [number, number, number],         // #16a34a
    red: [220, 38, 38] as [number, number, number],           // #dc2626
    bgLight: [248, 250, 252] as [number, number, number],     // #f8fafc
};

function fmt(n: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function pct(n: number): string {
    return `${n.toFixed(1)}%`;
}

function addHeader(doc: jsPDF, title: string, subtitle: string, orgName: string) {
    // Brand header bar
    doc.setFillColor(...BRAND.primary);
    doc.rect(0, 0, 210, 32, 'F');

    doc.setTextColor(...BRAND.white);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, 15);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, 14, 23);

    doc.setFontSize(10);
    doc.text(orgName, 196, 15, { align: 'right' });
    doc.text('Josephine AI', 196, 23, { align: 'right' });

    doc.setTextColor(...BRAND.text);
}

function addFooter(doc: jsPDF) {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(...BRAND.textLight);
        doc.text(
            `Generado por Josephine AI — ${new Date().toLocaleDateString('es-ES')} — Pagina ${i} de ${pageCount}`,
            105, 290,
            { align: 'center' }
        );
    }
}

// ── P&L Report ──

export interface PLData {
    orgName: string;
    period: string;    // e.g. "Marzo 2026"
    dateRange: string; // e.g. "01/03/2026 - 31/03/2026"
    revenue: {
        netSales: number;
        otherIncome: number;
        totalRevenue: number;
    };
    cogs: {
        food: number;
        beverage: number;
        totalCogs: number;
        cogsPercent: number;
    };
    labour: {
        salaries: number;
        socialSecurity: number;
        totalLabour: number;
        labourPercent: number;
    };
    overheads: {
        rent: number;
        utilities: number;
        marketing: number;
        other: number;
        totalOverheads: number;
    };
    summary: {
        grossProfit: number;
        grossMargin: number;
        primeCost: number;
        primeCostPercent: number;
        ebitda: number;
        ebitdaPercent: number;
    };
}

export function generatePLReport(data: PLData): void {
    const doc = new jsPDF();

    addHeader(doc, 'P&L — Cuenta de Resultados', data.dateRange, data.orgName);

    let y = 42;

    // Period title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND.text);
    doc.text(`Periodo: ${data.period}`, 14, y);
    y += 12;

    // Revenue section
    autoTable(doc, {
        startY: y,
        head: [['INGRESOS', '', '']],
        body: [
            ['Ventas Netas', '', fmt(data.revenue.netSales)],
            ['Otros Ingresos', '', fmt(data.revenue.otherIncome)],
            [{ content: 'TOTAL INGRESOS', styles: { fontStyle: 'bold' } }, '', { content: fmt(data.revenue.totalRevenue), styles: { fontStyle: 'bold' } }],
        ],
        headStyles: { fillColor: BRAND.primary, fontSize: 10 },
        bodyStyles: { fontSize: 10 },
        columnStyles: { 0: { cellWidth: 100 }, 2: { halign: 'right', cellWidth: 50 } },
        margin: { left: 14, right: 14 },
        theme: 'grid',
    });

    y = (doc as any).lastAutoTable.finalY + 8;

    // COGS section
    autoTable(doc, {
        startY: y,
        head: [['COSTE DE VENTAS (COGS)', '%', 'Importe']],
        body: [
            ['Alimentacion', '', fmt(data.cogs.food)],
            ['Bebidas', '', fmt(data.cogs.beverage)],
            [{ content: 'TOTAL COGS', styles: { fontStyle: 'bold' } }, { content: pct(data.cogs.cogsPercent), styles: { fontStyle: 'bold' } }, { content: fmt(data.cogs.totalCogs), styles: { fontStyle: 'bold' } }],
        ],
        headStyles: { fillColor: [71, 85, 105] as any, fontSize: 10 },
        bodyStyles: { fontSize: 10 },
        columnStyles: { 0: { cellWidth: 100 }, 1: { halign: 'center', cellWidth: 30 }, 2: { halign: 'right', cellWidth: 50 } },
        margin: { left: 14, right: 14 },
        theme: 'grid',
    });

    y = (doc as any).lastAutoTable.finalY + 8;

    // Labour section
    autoTable(doc, {
        startY: y,
        head: [['COSTE DE PERSONAL', '%', 'Importe']],
        body: [
            ['Salarios', '', fmt(data.labour.salaries)],
            ['Seguridad Social', '', fmt(data.labour.socialSecurity)],
            [{ content: 'TOTAL LABOR', styles: { fontStyle: 'bold' } }, { content: pct(data.labour.labourPercent), styles: { fontStyle: 'bold' } }, { content: fmt(data.labour.totalLabour), styles: { fontStyle: 'bold' } }],
        ],
        headStyles: { fillColor: [71, 85, 105] as any, fontSize: 10 },
        bodyStyles: { fontSize: 10 },
        columnStyles: { 0: { cellWidth: 100 }, 1: { halign: 'center', cellWidth: 30 }, 2: { halign: 'right', cellWidth: 50 } },
        margin: { left: 14, right: 14 },
        theme: 'grid',
    });

    y = (doc as any).lastAutoTable.finalY + 8;

    // Summary box
    autoTable(doc, {
        startY: y,
        head: [['RESUMEN', '%', 'Importe']],
        body: [
            ['Beneficio Bruto (GP)', pct(data.summary.grossMargin), fmt(data.summary.grossProfit)],
            ['Prime Cost (COGS + Labor)', pct(data.summary.primeCostPercent), fmt(data.summary.primeCost)],
            [{ content: 'EBITDA', styles: { fontStyle: 'bold' } }, { content: pct(data.summary.ebitdaPercent), styles: { fontStyle: 'bold' } }, { content: fmt(data.summary.ebitda), styles: { fontStyle: 'bold', textColor: data.summary.ebitda >= 0 ? BRAND.green : BRAND.red } }],
        ],
        headStyles: { fillColor: BRAND.primary, fontSize: 10 },
        bodyStyles: { fontSize: 10 },
        columnStyles: { 0: { cellWidth: 100 }, 1: { halign: 'center', cellWidth: 30 }, 2: { halign: 'right', cellWidth: 50 } },
        margin: { left: 14, right: 14 },
        theme: 'grid',
    });

    addFooter(doc);
    doc.save(`PL_${data.orgName.replace(/\s+/g, '_')}_${data.period.replace(/\s+/g, '_')}.pdf`);
}

// ── Payroll Report ──

export interface PayrollEmployee {
    name: string;
    role: string;
    hoursWorked: number;
    hourlyRate: number;
    grossPay: number;
    socialSecurity: number;
    netPay: number;
}

export interface PayrollData {
    orgName: string;
    period: string;
    dateRange: string;
    employees: PayrollEmployee[];
    totals: {
        totalHours: number;
        totalGross: number;
        totalSS: number;
        totalNet: number;
    };
}

export function generatePayrollReport(data: PayrollData): void {
    const doc = new jsPDF();

    addHeader(doc, 'Informe de Nomina', data.dateRange, data.orgName);

    let y = 42;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Periodo: ${data.period}`, 14, y);
    y += 12;

    autoTable(doc, {
        startY: y,
        head: [['Empleado', 'Puesto', 'Horas', 'Tarifa/h', 'Bruto', 'SS', 'Neto']],
        body: [
            ...data.employees.map(e => [
                e.name, e.role,
                e.hoursWorked.toString(),
                fmt(e.hourlyRate),
                fmt(e.grossPay),
                fmt(e.socialSecurity),
                fmt(e.netPay),
            ]),
            // Totals row
            [
                { content: 'TOTAL', styles: { fontStyle: 'bold' } },
                '',
                { content: data.totals.totalHours.toString(), styles: { fontStyle: 'bold' } },
                '',
                { content: fmt(data.totals.totalGross), styles: { fontStyle: 'bold' } },
                { content: fmt(data.totals.totalSS), styles: { fontStyle: 'bold' } },
                { content: fmt(data.totals.totalNet), styles: { fontStyle: 'bold' } },
            ],
        ],
        headStyles: { fillColor: BRAND.primary, fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
            0: { cellWidth: 35 },
            1: { cellWidth: 30 },
            2: { halign: 'center', cellWidth: 18 },
            3: { halign: 'right', cellWidth: 22 },
            4: { halign: 'right', cellWidth: 25 },
            5: { halign: 'right', cellWidth: 22 },
            6: { halign: 'right', cellWidth: 25 },
        },
        margin: { left: 14, right: 14 },
        theme: 'grid',
    });

    addFooter(doc);
    doc.save(`Nomina_${data.orgName.replace(/\s+/g, '_')}_${data.period.replace(/\s+/g, '_')}.pdf`);
}

// ── Weekly Summary Report ──

export interface WeeklySummaryDay {
    date: string;
    netSales: number;
    orders: number;
    labourCost: number;
    cogs: number;
}

export interface WeeklySummaryData {
    orgName: string;
    weekStart: string;
    weekEnd: string;
    days: WeeklySummaryDay[];
    totals: {
        totalSales: number;
        totalOrders: number;
        totalLabour: number;
        totalCogs: number;
        avgCheck: number;
        primeCost: number;
        primeCostPercent: number;
    };
}

export function generateWeeklySummaryReport(data: WeeklySummaryData): void {
    const doc = new jsPDF();

    const dateRange = `${new Date(data.weekStart).toLocaleDateString('es-ES')} - ${new Date(data.weekEnd).toLocaleDateString('es-ES')}`;
    addHeader(doc, 'Resumen Semanal', dateRange, data.orgName);

    let y = 42;

    // Summary KPIs
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Indicadores Clave', 14, y);
    y += 8;

    autoTable(doc, {
        startY: y,
        body: [
            ['Ventas Totales', fmt(data.totals.totalSales)],
            ['Pedidos Totales', data.totals.totalOrders.toString()],
            ['Ticket Medio', fmt(data.totals.avgCheck)],
            ['COGS', fmt(data.totals.totalCogs)],
            ['Coste de Personal', fmt(data.totals.totalLabour)],
            ['Prime Cost', `${fmt(data.totals.primeCost)} (${pct(data.totals.primeCostPercent)})`],
        ],
        bodyStyles: { fontSize: 11 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 }, 1: { halign: 'right' } },
        margin: { left: 14, right: 14 },
        theme: 'plain',
        alternateRowStyles: { fillColor: BRAND.bgLight },
    });

    y = (doc as any).lastAutoTable.finalY + 12;

    // Daily breakdown table
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Desglose Diario', 14, y);
    y += 8;

    autoTable(doc, {
        startY: y,
        head: [['Dia', 'Ventas', 'Pedidos', 'Labor', 'COGS', 'Prime%']],
        body: data.days.map(d => {
            const primePct = d.netSales > 0 ? ((d.labourCost + d.cogs) / d.netSales * 100) : 0;
            return [
                new Date(d.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }),
                fmt(d.netSales),
                d.orders.toString(),
                fmt(d.labourCost),
                fmt(d.cogs),
                pct(primePct),
            ];
        }),
        headStyles: { fillColor: BRAND.primary, fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
            0: { cellWidth: 35 },
            1: { halign: 'right', cellWidth: 30 },
            2: { halign: 'center', cellWidth: 22 },
            3: { halign: 'right', cellWidth: 28 },
            4: { halign: 'right', cellWidth: 28 },
            5: { halign: 'center', cellWidth: 22 },
        },
        margin: { left: 14, right: 14 },
        theme: 'grid',
    });

    addFooter(doc);
    doc.save(`Semanal_${data.orgName.replace(/\s+/g, '_')}_${data.weekStart}.pdf`);
}
