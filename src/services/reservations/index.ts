/**
 * Reservations Services - Main exports
 */

export * from './repository-interface';
export * from './in-memory-repository';
export { getAllSeedData, generateTodayReservations, generateMonthReservations } from './seed-data';

// Core Services
export { AvailabilityService } from './availability-service';
export { SeatingService } from './seating-service';
export { MessagingService } from './messaging-service';
export type { MessageProvider } from './messaging-service';
export { DepositService } from './deposit-service';
export type { PaymentProvider } from './deposit-service';

// Advanced Features Services (A-J)
export { ReconfirmationService } from './reconfirmation-service';
export { CancellationPolicyService } from './cancellation-policy-service';
export { SurveyService } from './survey-service';
export { MonthlyReportService } from './monthly-report-service';
export { PacingService } from './pacing-service';
export { OffersService } from './offers-service';
export { CrossSellService } from './cross-sell-service';
export { AnalyticsEventsService } from './analytics-events';
export { StaffAssignmentService } from './staff-assignment-service';

// Adapters
export { PhoneAssistantAdapter } from './adapters/phone-assistant-adapter';
export { MockPosAdapter, PosIntegrationService } from './adapters/pos-adapter';
export type { PosAdapter } from './adapters/pos-adapter';

// Re-export types
export type * from '@/types/reservations';
