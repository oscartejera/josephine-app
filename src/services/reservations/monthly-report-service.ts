/**
 * Monthly Report Service
 * Genera y envía reportes mensuales automáticos
 */

import type { ReservationsDataLayer } from './repository-interface';
import type { MonthlyReport } from '@/types/reservations';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';

export interface ReportEmailProvider {
  sendReport(to: string, subject: string, htmlBody: string, pdfAttachment?: Buffer): Promise<void>;
}

class MockReportEmailProvider implements ReportEmailProvider {
  async sendReport(to: string, subject: string, htmlBody: string, pdfAttachment?: Buffer): Promise<void> {
    console.log('[MOCK EMAIL REPORT]');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body length: ${htmlBody.length} chars`);
    console.log(`Has PDF: ${!!pdfAttachment}`);
    console.log('---');
  }
}

export class MonthlyReportService {
  private emailProvider: ReportEmailProvider;

  constructor(
    private dataLayer: ReservationsDataLayer,
    emailProvider?: ReportEmailProvider
  ) {
    this.emailProvider = emailProvider || new MockReportEmailProvider();
  }

  /**
   * Generate monthly report data
   */
  async generateMonthlyReport(
    locationId: string,
    month: string // YYYY-MM
  ): Promise<MonthlyReport> {
    const [year, monthNum] = month.split('-').map(Number);
    const date = new Date(year, monthNum - 1, 1);
    const startDate = format(startOfMonth(date), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(date), 'yyyy-MM-dd');

    // Fetch all reservations for the month
    const reservations = await this.dataLayer.reservations.findByDateRange(
      locationId,
      startDate,
      endDate
    );

    // Calculate metrics
    const totalReservations = reservations.length;
    const totalCovers = reservations.reduce((sum, r) => sum + r.party_size, 0);
    const noShows = reservations.filter(r => r.status === 'no_show').length;
    const cancellations = reservations.filter(r => r.status === 'cancelled').length;

    // Calculate revenue (deposits)
    const deposits = await this.dataLayer.deposits.findAll();
    const monthDeposits = deposits.filter(d => {
      const reservation = reservations.find(r => r.id === d.reservation_id);
      return reservation && d.status === 'charged';
    });
    const depositRevenue = monthDeposits.reduce((sum, d) => sum + d.amount, 0);

    // Top performing days
    const dayGroups: Record<string, number> = {};
    reservations.forEach(r => {
      dayGroups[r.reservation_date] = (dayGroups[r.reservation_date] || 0) + 1;
    });

    const topPerformingDays = Object.entries(dayGroups)
      .map(([date, count]) => ({ date, reservations: count }))
      .sort((a, b) => b.reservations - a.reservations)
      .slice(0, 5);

    // Top customers
    const customerCounts: Record<string, { name: string; visits: number; spent: number }> = {};
    
    for (const reservation of reservations) {
      if (reservation.customer_profile_id) {
        const customer = await this.dataLayer.customers.findById(reservation.customer_profile_id);
        if (customer) {
          if (!customerCounts[customer.id]) {
            customerCounts[customer.id] = {
              name: customer.name,
              visits: 0,
              spent: 0,
            };
          }
          customerCounts[customer.id].visits++;
          // In production, would sum actual spend from POS
          customerCounts[customer.id].spent += 50; // Mock average
        }
      }
    }

    const topCustomers = Object.values(customerCounts)
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10);

    const report: MonthlyReport = {
      location_id: locationId,
      month,
      total_reservations: totalReservations,
      total_covers: totalCovers,
      total_revenue: totalCovers * 45, // Mock: 45 EUR average ticket
      deposit_revenue: depositRevenue,
      no_shows: noShows,
      cancellations,
      top_performing_days: topPerformingDays,
      top_customers: topCustomers,
      created_at: new Date().toISOString(),
    };

    return report;
  }

  /**
   * Generate and send monthly report
   */
  async sendMonthlyReport(
    locationId: string,
    month: string,
    recipients: string[]
  ): Promise<void> {
    const report = await this.generateMonthlyReport(locationId, month);

    // Format HTML email
    const htmlBody = this.formatReportAsHTML(report);

    // Send to each recipient
    for (const email of recipients) {
      await this.emailProvider.sendReport(
        email,
        `Reporte Mensual de Reservas - ${month}`,
        htmlBody
      );
    }

    console.log(`[Monthly Report] Sent report for ${month} to ${recipients.length} recipients`);
  }

  /**
   * Schedule monthly reports (called by cron)
   */
  async scheduleMonthlyReports(): Promise<void> {
    console.log('[Monthly Report] Scheduler running...');
    
    // Get all locations
    const zones = await this.dataLayer.zones.findAll();
    const uniqueLocationIds = [...new Set(zones.map(z => z.location_id))];

    const lastMonth = format(subMonths(new Date(), 1), 'yyyy-MM');

    // In production, would get manager emails from location settings
    const managerEmails = ['manager@josephine.app'];

    for (const locationId of uniqueLocationIds) {
      await this.sendMonthlyReport(locationId, lastMonth, managerEmails);
    }
  }

  /**
   * Format report as HTML
   */
  private formatReportAsHTML(report: MonthlyReport): string {
    const noShowRate = report.total_reservations > 0 
      ? ((report.no_shows / report.total_reservations) * 100).toFixed(1)
      : '0.0';

    const cancellationRate = report.total_reservations > 0
      ? ((report.cancellations / report.total_reservations) * 100).toFixed(1)
      : '0.0';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Reporte Mensual - ${report.month}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
    .metric { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 15px; }
    .metric-value { font-size: 32px; font-weight: bold; color: #667eea; }
    .metric-label { color: #6c757d; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6; }
    th { background: #f8f9fa; font-weight: 600; }
    .alert { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Reporte Mensual de Reservas</h1>
    <p>${report.month}</p>
  </div>

  <div class="metric">
    <div class="metric-label">Total Reservas</div>
    <div class="metric-value">${report.total_reservations}</div>
  </div>

  <div class="metric">
    <div class="metric-label">Total Cubiertos</div>
    <div class="metric-value">${report.total_covers}</div>
  </div>

  <div class="metric">
    <div class="metric-label">Ingresos Estimados</div>
    <div class="metric-value">€${report.total_revenue.toFixed(2)}</div>
  </div>

  <div class="metric">
    <div class="metric-label">Ingresos por Depósitos</div>
    <div class="metric-value">€${report.deposit_revenue.toFixed(2)}</div>
  </div>

  ${report.no_shows > 0 || report.cancellations > 0 ? `
  <div class="alert">
    <strong>⚠️ Atención:</strong>
    <ul>
      <li>No-shows: ${report.no_shows} (${noShowRate}%)</li>
      <li>Cancelaciones: ${report.cancellations} (${cancellationRate}%)</li>
    </ul>
  </div>
  ` : ''}

  <h2>Top 5 Días con Más Reservas</h2>
  <table>
    <thead>
      <tr>
        <th>Fecha</th>
        <th>Reservas</th>
      </tr>
    </thead>
    <tbody>
      ${report.top_performing_days.map(day => `
        <tr>
          <td>${day.date}</td>
          <td>${day.reservations}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <h2>Top 10 Clientes</h2>
  <table>
    <thead>
      <tr>
        <th>Cliente</th>
        <th>Visitas</th>
        <th>Gastado</th>
      </tr>
    </thead>
    <tbody>
      ${report.top_customers.map(customer => `
        <tr>
          <td>${customer.name}</td>
          <td>${customer.visits}</td>
          <td>€${customer.spent.toFixed(2)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <p style="color: #6c757d; font-size: 12px; margin-top: 40px;">
    Este reporte ha sido generado automáticamente por Josephine.
  </p>
</body>
</html>
    `;
  }
}
