/**
 * Repository Interfaces - Data Layer abstraction
 * Permite usar InMemory o Supabase indistintamente
 */

import type {
  Reservation,
  CustomerProfile,
  Deposit,
  Zone,
  Table,
  Service,
  ServiceZoneCapacity,
  ClosureDay,
  WaitlistEntry,
  MessageTemplate,
  MessageLog,
  PromoCode,
  PromoCodeUsage,
  ReservationSettings,
  CustomerTag,
  Survey,
  SurveyResponse,
  GoogleReservationSource,
  PosIntegration,
  CreateReservationInput,
  UpdateReservationInput,
  AddToWaitlistInput,
  CreateCustomerInput,
} from '@/types/reservations';

// ============= Base Repository =============

export interface BaseRepository<T> {
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  create(data: Partial<T>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}

// ============= Reservations Repository =============

export interface ReservationsRepository extends BaseRepository<Reservation> {
  findByLocation(locationId: string): Promise<Reservation[]>;
  findByDate(locationId: string, date: string): Promise<Reservation[]>;
  findByDateRange(locationId: string, startDate: string, endDate: string): Promise<Reservation[]>;
  findByCustomer(customerId: string): Promise<Reservation[]>;
  findByStatus(locationId: string, status: Reservation['status']): Promise<Reservation[]>;
  createReservation(locationId: string, input: CreateReservationInput): Promise<Reservation>;
  updateReservation(id: string, input: UpdateReservationInput): Promise<Reservation>;
  cancelReservation(id: string, reason?: string): Promise<void>;
  confirmReservation(id: string): Promise<void>;
  reconfirmReservation(id: string): Promise<void>;
  markAsSeated(id: string, tableId?: string): Promise<void>;
  markAsCompleted(id: string): Promise<void>;
  markAsNoShow(id: string): Promise<void>;
}

// ============= Customers Repository =============

export interface CustomersRepository extends BaseRepository<CustomerProfile> {
  findByEmail(email: string): Promise<CustomerProfile | null>;
  findByPhone(phone: string): Promise<CustomerProfile | null>;
  findByTag(tag: string): Promise<CustomerProfile[]>;
  createCustomer(input: CreateCustomerInput): Promise<CustomerProfile>;
  addTag(customerId: string, tag: string): Promise<void>;
  removeTag(customerId: string, tag: string): Promise<void>;
  blockCustomer(customerId: string, reason: string): Promise<void>;
  unblockCustomer(customerId: string): Promise<void>;
  incrementVisits(customerId: string): Promise<void>;
  incrementNoShows(customerId: string): Promise<void>;
}

// ============= Deposits Repository =============

export interface DepositsRepository extends BaseRepository<Deposit> {
  findByReservation(reservationId: string): Promise<Deposit | null>;
  createDeposit(reservationId: string, amount: number, perPersonAmount: number): Promise<Deposit>;
  authorizeDeposit(id: string, paymentIntentId: string): Promise<void>;
  chargeDeposit(id: string): Promise<void>;
  refundDeposit(id: string, amount: number, reason: string): Promise<void>;
  findPendingDeposits(locationId: string): Promise<Deposit[]>;
}

// ============= Zones & Tables Repositories =============

export interface ZonesRepository extends BaseRepository<Zone> {
  findByLocation(locationId: string): Promise<Zone[]>;
  findActive(locationId: string): Promise<Zone[]>;
}

export interface TablesRepository extends BaseRepository<Table> {
  findByLocation(locationId: string): Promise<Table[]>;
  findByZone(zoneId: string): Promise<Table[]>;
  findAvailableForPartySize(locationId: string, partySize: number): Promise<Table[]>;
  combineTables(tableIds: string[]): Promise<void>;
  uncombineTables(tableIds: string[]): Promise<void>;
}

// ============= Services Repository =============

export interface ServicesRepository extends BaseRepository<Service> {
  findByLocation(locationId: string): Promise<Service[]>;
  findActive(locationId: string): Promise<Service[]>;
  findForDate(locationId: string, date: string): Promise<Service[]>;
}

export interface ServiceZoneCapacityRepository extends BaseRepository<ServiceZoneCapacity> {
  findByService(serviceId: string): Promise<ServiceZoneCapacity[]>;
  findByZone(zoneId: string): Promise<ServiceZoneCapacity[]>;
}

// ============= Closure Days Repository =============

export interface ClosureDaysRepository extends BaseRepository<ClosureDay> {
  findByLocation(locationId: string): Promise<ClosureDay[]>;
  findByDate(locationId: string, date: string): Promise<ClosureDay | null>;
  isClosedOn(locationId: string, date: string): Promise<boolean>;
}

// ============= Waitlist Repository =============

export interface WaitlistRepository extends BaseRepository<WaitlistEntry> {
  findByLocation(locationId: string): Promise<WaitlistEntry[]>;
  findActive(locationId: string): Promise<WaitlistEntry[]>;
  addToWaitlist(locationId: string, input: AddToWaitlistInput): Promise<WaitlistEntry>;
  markAsSeated(id: string): Promise<void>;
  markAsLeft(id: string): Promise<void>;
  markAsNotified(id: string): Promise<void>;
}

// ============= Messaging Repositories =============

export interface MessageTemplatesRepository extends BaseRepository<MessageTemplate> {
  findByType(type: MessageTemplate['type']): Promise<MessageTemplate[]>;
  findActiveByType(type: MessageTemplate['type'], channel: MessageTemplate['channel']): Promise<MessageTemplate | null>;
}

export interface MessageLogsRepository extends BaseRepository<MessageLog> {
  findByReservation(reservationId: string): Promise<MessageLog[]>;
  findByCustomer(customerId: string): Promise<MessageLog[]>;
  logMessage(log: Omit<MessageLog, 'id' | 'created_at'>): Promise<MessageLog>;
  markAsSent(id: string): Promise<void>;
  markAsDelivered(id: string): Promise<void>;
  markAsFailed(id: string, error: string): Promise<void>;
}

// ============= Promo Codes Repository =============

export interface PromoCodesRepository extends BaseRepository<PromoCode> {
  findByCode(code: string): Promise<PromoCode | null>;
  findActiveByCode(code: string): Promise<PromoCode | null>;
  findActive(locationId?: string): Promise<PromoCode[]>;
  validatePromoCode(code: string, locationId: string, partySize: number, serviceId: string): Promise<{ valid: boolean; reason?: string; discount?: number }>;
  incrementUsage(id: string): Promise<void>;
}

export interface PromoCodeUsageRepository extends BaseRepository<PromoCodeUsage> {
  findByPromoCode(promoCodeId: string): Promise<PromoCodeUsage[]>;
  findByCustomer(customerId: string): Promise<PromoCodeUsage[]>;
  recordUsage(promoCodeId: string, reservationId: string, customerId: string | null, discountAmount: number): Promise<PromoCodeUsage>;
}

// ============= Settings Repository =============

export interface SettingsRepository {
  findByLocation(locationId: string): Promise<ReservationSettings | null>;
  update(locationId: string, settings: Partial<ReservationSettings>): Promise<ReservationSettings>;
  getOrCreate(locationId: string): Promise<ReservationSettings>;
}

// ============= Tags Repository =============

export interface TagsRepository extends BaseRepository<CustomerTag> {
  findByName(name: string): Promise<CustomerTag | null>;
  findAll(): Promise<CustomerTag[]>;
}

// ============= Surveys Repository =============

export interface SurveysRepository extends BaseRepository<Survey> {
  findActive(locationId: string): Promise<Survey | null>;
  findByLocation(locationId: string): Promise<Survey[]>;
}

export interface SurveyResponsesRepository extends BaseRepository<SurveyResponse> {
  findBySurvey(surveyId: string): Promise<SurveyResponse[]>;
  findByReservation(reservationId: string): Promise<SurveyResponse | null>;
  submitResponse(response: Omit<SurveyResponse, 'id' | 'submitted_at'>): Promise<SurveyResponse>;
}

// ============= Integration Repositories =============

export interface GoogleReservationsRepository extends BaseRepository<GoogleReservationSource> {
  findByLocation(locationId: string): Promise<GoogleReservationSource | null>;
  updateSyncStatus(id: string, status: GoogleReservationSource['sync_status'], lastSyncAt: string): Promise<void>;
}

export interface PosIntegrationRepository extends BaseRepository<PosIntegration> {
  findByLocation(locationId: string): Promise<PosIntegration | null>;
  updateSyncStatus(id: string, lastSyncAt: string): Promise<void>;
}

// ============= Main Repository Interface =============

export interface ReservationsDataLayer {
  reservations: ReservationsRepository;
  customers: CustomersRepository;
  deposits: DepositsRepository;
  zones: ZonesRepository;
  tables: TablesRepository;
  services: ServicesRepository;
  serviceZoneCapacity: ServiceZoneCapacityRepository;
  closureDays: ClosureDaysRepository;
  waitlist: WaitlistRepository;
  messageTemplates: MessageTemplatesRepository;
  messageLogs: MessageLogsRepository;
  promoCodes: PromoCodesRepository;
  promoCodeUsage: PromoCodeUsageRepository;
  settings: SettingsRepository;
  tags: TagsRepository;
  surveys: SurveysRepository;
  surveyResponses: SurveyResponsesRepository;
  googleReservations: GoogleReservationsRepository;
  posIntegration: PosIntegrationRepository;
}
