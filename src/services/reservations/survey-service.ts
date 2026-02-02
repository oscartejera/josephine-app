/**
 * Survey Service
 * Gestiona encuestas post-visita y redirección a reseñas
 */

import type { ReservationsDataLayer } from './repository-interface';
import type { Survey, SurveyResponse, Reservation } from '@/types/reservations';
import { MessagingService } from './messaging-service';

export interface ReviewRoutingConfig {
  high_score_threshold: number; // Ej: 8 - scores >= 8 van a Google/Trip
  google_review_url?: string;
  tripadvisor_url?: string;
  internal_feedback_email?: string;
}

export class SurveyService {
  private reviewConfig: ReviewRoutingConfig = {
    high_score_threshold: 8,
    google_review_url: 'https://g.page/r/YOUR_PLACE/review',
    tripadvisor_url: 'https://www.tripadvisor.com/YOUR_PLACE',
  };

  constructor(
    private dataLayer: ReservationsDataLayer,
    private messagingService: MessagingService
  ) {}

  /**
   * Send post-visit survey
   */
  async sendPostVisitSurvey(reservationId: string): Promise<void> {
    const reservation = await this.dataLayer.reservations.findById(reservationId);
    if (!reservation || reservation.status !== 'completed') {
      return;
    }

    const survey = await this.dataLayer.surveys.findActive(reservation.location_id);
    if (!survey) {
      console.log('[Survey] No active survey for location');
      return;
    }

    // Send survey email with messaging service
    await this.messagingService.sendPostVisitSurvey(reservationId);

    console.log(`[Survey] Sent post-visit survey to ${reservation.guest_name}`);
  }

  /**
   * Submit survey response and route to appropriate action
   */
  async submitSurveyResponse(
    surveyId: string,
    reservationId: string,
    answers: Record<string, any>,
    overallRating: number
  ): Promise<{
    redirectTo: 'google' | 'tripadvisor' | 'thank_you' | 'internal_feedback';
    url?: string;
    message: string;
  }> {
    // Save response
    const response = await this.dataLayer.surveyResponses.submitResponse({
      survey_id: surveyId,
      reservation_id: reservationId,
      customer_profile_id: null,
      answers,
      overall_rating: overallRating,
    });

    const reservation = await this.dataLayer.reservations.findById(reservationId);

    // Route based on score
    if (overallRating >= this.reviewConfig.high_score_threshold) {
      // High score - send to public reviews
      const platform = Math.random() > 0.5 ? 'google' : 'tripadvisor';
      
      return {
        redirectTo: platform,
        url: platform === 'google' 
          ? this.reviewConfig.google_review_url 
          : this.reviewConfig.tripadvisor_url,
        message: '¡Gracias por tu valoración! Nos encantaría que compartas tu experiencia:',
      };
    } else {
      // Low score - keep feedback internal
      // Create internal alert/ticket
      await this.createFeedbackAlert(reservationId, overallRating, answers);

      return {
        redirectTo: 'internal_feedback',
        message: 'Gracias por tu feedback. Lamentamos que tu experiencia no haya sido perfecta. Nos pondremos en contacto contigo pronto.',
      };
    }
  }

  /**
   * Create internal feedback alert for low scores
   */
  private async createFeedbackAlert(
    reservationId: string,
    score: number,
    answers: Record<string, any>
  ): Promise<void> {
    const reservation = await this.dataLayer.reservations.findById(reservationId);
    if (!reservation) return;

    // In production, this would create a ticket/alert in CRM
    console.log('[Survey] LOW SCORE ALERT:', {
      reservation_id: reservationId,
      guest: reservation.guest_name,
      score,
      date: reservation.reservation_date,
      answers,
    });

    // Update reservation notes
    await this.dataLayer.reservations.update(reservationId, {
      notes: `${reservation.notes || ''}\n[Survey Score: ${score}/10 - Requires follow-up]`,
    });
  }

  /**
   * Get survey statistics
   */
  async getSurveyStats(locationId: string, startDate: string, endDate: string) {
    const reservations = await this.dataLayer.reservations.findByDateRange(
      locationId,
      startDate,
      endDate
    );

    const completedReservations = reservations.filter(r => r.status === 'completed');
    
    // Get survey responses for these reservations
    const allResponses = await this.dataLayer.surveyResponses.findAll();
    const responses = allResponses.filter(r =>
      completedReservations.some(res => res.id === r.reservation_id)
    );

    const totalResponses = responses.length;
    const totalCompleted = completedReservations.length;
    const responseRate = totalCompleted > 0 ? (totalResponses / totalCompleted) * 100 : 0;

    const scoresDistribution = {
      excellent: responses.filter(r => r.overall_rating && r.overall_rating >= 9).length,
      good: responses.filter(r => r.overall_rating && r.overall_rating >= 7 && r.overall_rating < 9).length,
      fair: responses.filter(r => r.overall_rating && r.overall_rating >= 5 && r.overall_rating < 7).length,
      poor: responses.filter(r => r.overall_rating && r.overall_rating < 5).length,
    };

    const averageScore = responses.length > 0
      ? responses.reduce((sum, r) => sum + (r.overall_rating || 0), 0) / responses.length
      : 0;

    return {
      total_surveys_sent: totalCompleted,
      total_responses: totalResponses,
      response_rate: responseRate,
      average_score: averageScore,
      scores_distribution: scoresDistribution,
      redirect_to_public_reviews: responses.filter(r => 
        r.overall_rating && r.overall_rating >= this.reviewConfig.high_score_threshold
      ).length,
      redirect_to_internal: responses.filter(r =>
        r.overall_rating && r.overall_rating < this.reviewConfig.high_score_threshold
      ).length,
    };
  }

  /**
   * Configure review routing thresholds
   */
  setReviewRoutingConfig(config: Partial<ReviewRoutingConfig>): void {
    this.reviewConfig = { ...this.reviewConfig, ...config };
  }

  /**
   * Schedule post-visit survey (called after reservation is completed)
   */
  async schedulePostVisitSurvey(reservationId: string): Promise<void> {
    const reservation = await this.dataLayer.reservations.findById(reservationId);
    if (!reservation) return;

    const survey = await this.dataLayer.surveys.findActive(reservation.location_id);
    if (!survey) return;

    // In production, this would queue the email for T+send_after_hours
    console.log(`[Survey] Scheduled survey for ${reservation.guest_name} in ${survey.send_after_hours}h`);

    // For mock, send immediately (in production would be scheduled)
    setTimeout(async () => {
      await this.sendPostVisitSurvey(reservationId);
    }, 1000); // Simulate delay
  }
}
