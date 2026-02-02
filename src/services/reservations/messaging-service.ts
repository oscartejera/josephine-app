/**
 * Messaging Service
 * Maneja envío de emails, SMS y notificaciones
 */

import type {
  ReservationsDataLayer,
} from './repository-interface';
import type {
  MessageType,
  MessageChannel,
  Reservation,
} from '@/types/reservations';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export interface MessageProvider {
  sendEmail(to: string, subject: string, body: string): Promise<void>;
  sendSMS(to: string, body: string): Promise<void>;
}

/**
 * Mock message provider for development
 */
class MockMessageProvider implements MessageProvider {
  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    console.log('[MOCK EMAIL]');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:\n${body}`);
    console.log('---');
  }

  async sendSMS(to: string, body: string): Promise<void> {
    console.log('[MOCK SMS]');
    console.log(`To: ${to}`);
    console.log(`Message: ${body}`);
    console.log('---');
  }
}

export class MessagingService {
  private provider: MessageProvider;

  constructor(
    private dataLayer: ReservationsDataLayer,
    provider?: MessageProvider
  ) {
    this.provider = provider || new MockMessageProvider();
  }

  /**
   * Send confirmation message for a reservation
   */
  async sendConfirmation(reservationId: string): Promise<void> {
    const reservation = await this.dataLayer.reservations.findById(reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }

    if (!reservation.guest_email && !reservation.guest_phone) {
      throw new Error('No contact information available');
    }

    const settings = await this.dataLayer.settings.findByLocation(reservation.location_id);
    if (!settings?.send_confirmation_email) {
      return; // Confirmations disabled
    }

    // Get template
    const template = await this.dataLayer.messageTemplates.findActiveByType(
      'confirmation',
      'email'
    );

    if (!template) {
      console.warn('No confirmation template found');
      return;
    }

    // Prepare message content
    const { subject, body } = await this.prepareMessage(template, reservation);

    // Send via appropriate channel
    if (template.channel === 'email' && reservation.guest_email) {
      await this.sendEmail(reservationId, reservation.guest_email, subject!, body);
    }

    if ((template.channel === 'sms' || template.channel === 'both') && reservation.guest_phone) {
      await this.sendSMS(reservationId, reservation.guest_phone, body);
    }

    // Update reservation
    await this.dataLayer.reservations.update(reservationId, {
      confirmation_sent_at: new Date().toISOString(),
    });
  }

  /**
   * Send reminder for a reservation
   */
  async sendReminder(reservationId: string): Promise<void> {
    const reservation = await this.dataLayer.reservations.findById(reservationId);
    if (!reservation) return;

    const template = await this.dataLayer.messageTemplates.findActiveByType('reminder', 'email');
    if (!template) return;

    const { subject, body } = await this.prepareMessage(template, reservation);

    if (reservation.guest_email) {
      await this.sendEmail(reservationId, reservation.guest_email, subject!, body);
    }
  }

  /**
   * Send reconfirmation request
   */
  async sendReconfirmationRequest(reservationId: string): Promise<void> {
    const reservation = await this.dataLayer.reservations.findById(reservationId);
    if (!reservation) return;

    const template = await this.dataLayer.messageTemplates.findActiveByType(
      'reconfirmation',
      'email'
    );
    if (!template) return;

    const { subject, body } = await this.prepareMessage(template, reservation);

    if (reservation.guest_email) {
      await this.sendEmail(reservationId, reservation.guest_email, subject!, body);
    }

    await this.dataLayer.reservations.update(reservationId, {
      reconfirmation_required: true,
    });
  }

  /**
   * Send cancellation confirmation
   */
  async sendCancellation(reservationId: string): Promise<void> {
    const reservation = await this.dataLayer.reservations.findById(reservationId);
    if (!reservation) return;

    const template = await this.dataLayer.messageTemplates.findActiveByType(
      'cancellation',
      'email'
    );
    if (!template) return;

    const { subject, body } = await this.prepareMessage(template, reservation);

    if (reservation.guest_email) {
      await this.sendEmail(reservationId, reservation.guest_email, subject!, body);
    }
  }

  /**
   * Send post-visit survey
   */
  async sendPostVisitSurvey(reservationId: string): Promise<void> {
    const reservation = await this.dataLayer.reservations.findById(reservationId);
    if (!reservation || reservation.status !== 'completed') return;

    const template = await this.dataLayer.messageTemplates.findActiveByType(
      'post_visit_survey',
      'email'
    );
    if (!template || !reservation.guest_email) return;

    const { subject, body } = await this.prepareMessage(template, reservation);
    await this.sendEmail(reservationId, reservation.guest_email, subject!, body);
  }

  /**
   * Send waitlist notification
   */
  async sendWaitlistNotification(waitlistId: string): Promise<void> {
    const entry = await this.dataLayer.waitlist.findById(waitlistId);
    if (!entry || !entry.guest_phone) return;

    const body = `¡Tu mesa está lista! Por favor acércate a recepción. Tienes 10 minutos para confirmar.`;
    
    await this.dataLayer.messageLogs.logMessage({
      reservation_id: null,
      waitlist_id: waitlistId,
      customer_profile_id: null,
      type: 'waitlist_notification',
      channel: 'sms',
      recipient: entry.guest_phone,
      subject: null,
      body,
      status: 'pending',
      sent_at: null,
      delivered_at: null,
      error: null,
    });

    try {
      await this.provider.sendSMS(entry.guest_phone, body);
      await this.dataLayer.waitlist.markAsNotified(waitlistId);
    } catch (error) {
      console.error('Failed to send waitlist notification:', error);
    }
  }

  /**
   * Send monthly report (mock implementation)
   */
  async sendMonthlyReport(locationId: string, month: string): Promise<void> {
    console.log(`[MOCK] Sending monthly report for location ${locationId}, month ${month}`);
    
    // In real implementation:
    // 1. Generate analytics for the month
    // 2. Create PDF report
    // 3. Send email to restaurant managers
    
    const mockReport = {
      location_id: locationId,
      month,
      total_reservations: 245,
      total_covers: 856,
      no_shows: 12,
      cancellations: 18,
      revenue: 8560.50,
    };

    console.log('Report data:', mockReport);
  }

  /**
   * Prepare message content from template with placeholders
   */
  private async prepareMessage(
    template: any,
    reservation: Reservation
  ): Promise<{ subject: string | null; body: string }> {
    let subject = template.subject || '';
    let body = template.body || '';

    // Get additional data
    const table = reservation.pos_table_id
      ? await this.dataLayer.tables.findById(reservation.pos_table_id)
      : null;

    const settings = await this.dataLayer.settings.findByLocation(reservation.location_id);

    // Format date
    const dateFormatted = format(parseISO(reservation.reservation_date), "EEEE, d 'de' MMMM", {
      locale: es,
    });

    // Replace placeholders
    const replacements: Record<string, string> = {
      '{{guest_name}}': reservation.guest_name,
      '{{date}}': dateFormatted,
      '{{time}}': reservation.reservation_time,
      '{{party_size}}': reservation.party_size.toString(),
      '{{table_name}}': table?.name || 'Por asignar',
      '{{confirmation_message}}': settings?.confirmation_message || '',
      '{{cancellation_policy}}': settings?.cancellation_policy || '',
      '{{confirmation_link}}': `https://app.josephine.com/reservations/${reservation.id}/confirm`,
      '{{survey_link}}': `https://app.josephine.com/survey/${reservation.id}`,
      '{{google_review_link}}': 'https://g.page/r/...', // TODO: Real link
      '{{tripadvisor_review_link}}': 'https://www.tripadvisor.com/...', // TODO: Real link
    };

    for (const [placeholder, value] of Object.entries(replacements)) {
      subject = subject.replace(new RegExp(placeholder, 'g'), value);
      body = body.replace(new RegExp(placeholder, 'g'), value);
    }

    return { subject, body };
  }

  /**
   * Send email and log
   */
  private async sendEmail(
    reservationId: string,
    to: string,
    subject: string,
    body: string
  ): Promise<void> {
    const messageLog = await this.dataLayer.messageLogs.logMessage({
      reservation_id: reservationId,
      waitlist_id: null,
      customer_profile_id: null,
      type: 'confirmation',
      channel: 'email',
      recipient: to,
      subject,
      body,
      status: 'pending',
      sent_at: null,
      delivered_at: null,
      error: null,
    });

    try {
      await this.provider.sendEmail(to, subject, body);
      await this.dataLayer.messageLogs.markAsSent(messageLog.id);
      // In real implementation, we'd mark as delivered when we get webhook confirmation
      await this.dataLayer.messageLogs.markAsDelivered(messageLog.id);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await this.dataLayer.messageLogs.markAsFailed(messageLog.id, errorMsg);
      throw error;
    }
  }

  /**
   * Send SMS and log
   */
  private async sendSMS(
    reservationId: string,
    to: string,
    body: string
  ): Promise<void> {
    const messageLog = await this.dataLayer.messageLogs.logMessage({
      reservation_id: reservationId,
      waitlist_id: null,
      customer_profile_id: null,
      type: 'confirmation',
      channel: 'sms',
      recipient: to,
      subject: null,
      body,
      status: 'pending',
      sent_at: null,
      delivered_at: null,
      error: null,
    });

    try {
      await this.provider.sendSMS(to, body);
      await this.dataLayer.messageLogs.markAsSent(messageLog.id);
      await this.dataLayer.messageLogs.markAsDelivered(messageLog.id);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await this.dataLayer.messageLogs.markAsFailed(messageLog.id, errorMsg);
      throw error;
    }
  }

  /**
   * Process automated messages (to be called by cron/scheduler)
   */
  async processAutomatedMessages(): Promise<void> {
    // This would be called periodically to:
    // 1. Send reminders 24h before
    // 2. Send reconfirmation requests
    // 3. Send post-visit surveys
    // 4. Process monthly reports
    
    console.log('[Messaging] Processing automated messages...');
    
    // Implementation would check settings and send appropriate messages
  }
}
