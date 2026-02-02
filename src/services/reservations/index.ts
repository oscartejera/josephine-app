/**
 * Reservations Services - Main exports
 */

export * from './repository-interface';
export * from './in-memory-repository';
export { getAllSeedData, generateTodayReservations } from './seed-data';

export { AvailabilityService } from './availability-service';
export { SeatingService } from './seating-service';
export { MessagingService } from './messaging-service';
export type { MessageProvider } from './messaging-service';
export { DepositService } from './deposit-service';
export type { PaymentProvider } from './deposit-service';

// Re-export types
export type * from '@/types/reservations';
