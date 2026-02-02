/**
 * Reservations Module - Complete Type Definitions
 * Sistema completo de reservas con todas las features
 */

// ============= Core Entities =============

export interface Reservation {
  id: string;
  location_id: string;
  pos_table_id: string | null;
  guest_name: string;
  guest_phone: string | null;
  guest_email: string | null;
  party_size: number;
  reservation_date: string; // YYYY-MM-DD
  reservation_time: string; // HH:MM
  duration_minutes: number;
  status: ReservationStatus;
  confirmation_sent_at: string | null;
  reconfirmation_required: boolean;
  reconfirmed_at: string | null;
  notes: string | null;
  special_requests: string | null;
  created_at: string;
  updated_at: string;
  customer_profile_id: string | null;
  source: ReservationSource;
  zone_id: string | null;
  service_id: string | null;
  deposit_id: string | null;
  promo_code_id: string | null;
  auto_assigned: boolean;
}

export type ReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'reconfirmed'
  | 'seated'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type ReservationSource =
  | 'manual' // Telefono o presencial
  | 'online' // Widget online
  | 'google' // Google reservations
  | 'walk_in'; // Walk-in directo

// ============= Customer Management =============

export interface CustomerProfile {
  id: string;
  group_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  tags: string[]; // VIP, Regular, etc.
  total_visits: number;
  total_spent: number;
  total_no_shows: number;
  total_cancellations: number;
  last_visit_at: string | null;
  created_at: string;
  updated_at: string;
  max_party_size_limit: number | null; // Límite de comensales
  is_blocked: boolean;
  block_reason: string | null;
}

export interface CustomerTag {
  id: string;
  name: string;
  color: string;
  description: string | null;
  created_at: string;
}

// ============= Deposit & Payment =============

export interface Deposit {
  id: string;
  reservation_id: string;
  amount: number;
  currency: string;
  per_person_amount: number;
  status: DepositStatus;
  payment_method: PaymentMethod;
  payment_intent_id: string | null; // Stripe/payment provider ID
  charged_at: string | null;
  refunded_at: string | null;
  refund_amount: number | null;
  refund_reason: string | null;
  created_at: string;
  updated_at: string;
}

export type DepositStatus =
  | 'pending'
  | 'authorized'
  | 'charged'
  | 'refunded'
  | 'partially_refunded'
  | 'failed';

export type PaymentMethod = 'card' | 'cash' | 'other';

// ============= Zones & Tables =============

export interface Zone {
  id: string;
  location_id: string;
  name: string;
  description: string | null;
  capacity: number;
  position: { x: number; y: number }; // Para plano visual
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Table {
  id: string;
  location_id: string;
  zone_id: string | null;
  name: string;
  min_capacity: number;
  max_capacity: number;
  position: { x: number; y: number; width: number; height: number };
  shape: 'rectangle' | 'circle' | 'square';
  is_combinable: boolean; // Puede doblarse con otras mesas
  combined_with: string[]; // IDs de mesas combinadas
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============= Services & Turns =============

export interface Service {
  id: string;
  location_id: string;
  name: string; // Almuerzo, Cena, Brunch
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  days_of_week: number[]; // 0=domingo, 1=lunes, ..., 6=sábado
  max_covers: number | null; // Aforo total del servicio
  slot_duration_minutes: number;
  default_reservation_duration: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServiceZoneCapacity {
  id: string;
  service_id: string;
  zone_id: string;
  max_covers: number;
  created_at: string;
}

export interface TimeSlot {
  time: string; // HH:MM
  available_covers: number;
  booked_covers: number;
  reservations: Reservation[];
}

// ============= Availability & Capacity =============

export interface AvailabilityCheck {
  date: string;
  time: string;
  party_size: number;
  zone_id?: string;
  service_id?: string;
}

export interface AvailabilityResult {
  available: boolean;
  reason?: string;
  suggested_times?: string[];
  max_party_size?: number;
}

export interface CapacitySettings {
  id: string;
  location_id: string;
  service_id: string | null;
  zone_id: string | null;
  time_slot: string | null; // HH:MM específico
  max_covers: number;
  created_at: string;
}

// ============= Closure Days =============

export interface ClosureDay {
  id: string;
  location_id: string;
  date: string; // YYYY-MM-DD
  reason: string;
  is_recurring: boolean; // Si se repite anualmente
  created_at: string;
}

// ============= Waitlist =============

export interface WaitlistEntry {
  id: string;
  location_id: string;
  guest_name: string;
  guest_phone: string | null;
  guest_email: string | null;
  party_size: number;
  quoted_wait_minutes: number | null;
  status: WaitlistStatus;
  notes: string | null;
  notified_at: string | null;
  created_at: string;
  updated_at: string;
}

export type WaitlistStatus = 'waiting' | 'notified' | 'seated' | 'left' | 'cancelled';

// ============= Messaging =============

export interface MessageTemplate {
  id: string;
  location_id: string | null;
  type: MessageType;
  channel: MessageChannel;
  subject: string | null; // Para emails
  body: string; // Puede contener placeholders: {{guest_name}}, {{time}}, etc.
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type MessageType =
  | 'confirmation'
  | 'reminder'
  | 'reconfirmation'
  | 'cancellation'
  | 'waitlist_notification'
  | 'post_visit_survey'
  | 'no_show_follow_up';

export type MessageChannel = 'email' | 'sms' | 'both';

export interface MessageLog {
  id: string;
  reservation_id: string | null;
  waitlist_id: string | null;
  customer_profile_id: string | null;
  type: MessageType;
  channel: MessageChannel;
  recipient: string;
  subject: string | null;
  body: string;
  status: MessageStatus;
  sent_at: string | null;
  delivered_at: string | null;
  error: string | null;
  created_at: string;
}

export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';

// ============= Promo Codes =============

export interface PromoCode {
  id: string;
  location_id: string | null; // null = todos los locales
  code: string;
  description: string;
  discount_type: 'percentage' | 'fixed_amount' | 'free_deposit';
  discount_value: number;
  valid_from: string;
  valid_until: string;
  max_uses: number | null;
  current_uses: number;
  min_party_size: number | null;
  applicable_services: string[]; // IDs de servicios
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PromoCodeUsage {
  id: string;
  promo_code_id: string;
  reservation_id: string;
  customer_profile_id: string | null;
  discount_amount: number;
  used_at: string;
}

// ============= Analytics =============

export interface ReservationAnalytics {
  period: 'day' | 'week' | 'month';
  start_date: string;
  end_date: string;
  total_reservations: number;
  total_covers: number;
  confirmed_reservations: number;
  no_shows: number;
  no_show_rate: number;
  cancellations: number;
  cancellation_rate: number;
  avg_party_size: number;
  total_deposit_revenue: number;
  occupancy_rate: number;
  reservations_by_source: Record<ReservationSource, number>;
  reservations_by_hour: { hour: string; count: number; covers: number }[];
  top_customers: { id: string; name: string; visits: number }[];
  peak_hours: string[];
}

// ============= Settings =============

export interface ReservationSettings {
  id: string;
  location_id: string;
  
  // General
  default_reservation_duration: number;
  slot_duration_minutes: number;
  max_covers_per_slot: number | null;
  max_party_size: number;
  min_party_size: number;
  
  // Deposits
  require_deposit: boolean;
  deposit_amount_per_person: number;
  deposit_required_for_party_size: number | null; // Solo para grupos grandes
  
  // Confirmations
  auto_confirm: boolean;
  require_reconfirmation: boolean;
  reconfirmation_hours_before: number;
  
  // Reminders
  send_confirmation_email: boolean;
  send_reminder: boolean;
  reminder_hours_before: number;
  
  // Cancellations & No-shows
  cancellation_deadline_hours: number;
  charge_cancellation_fee: boolean;
  cancellation_fee_percentage: number;
  track_no_shows: boolean;
  block_after_no_shows: number | null;
  
  // Waitlist
  enable_waitlist: boolean;
  auto_assign_from_waitlist: boolean;
  
  // Messages
  confirmation_message: string | null;
  cancellation_policy: string | null;
  
  // Advanced
  enable_table_combining: boolean;
  enable_promo_codes: boolean;
  enable_google_reservations: boolean;
  
  created_at: string;
  updated_at: string;
}

// ============= Reports =============

export interface MonthlyReport {
  location_id: string;
  month: string; // YYYY-MM
  total_reservations: number;
  total_covers: number;
  total_revenue: number;
  deposit_revenue: number;
  no_shows: number;
  cancellations: number;
  top_performing_days: { date: string; reservations: number }[];
  top_customers: { name: string; visits: number; spent: number }[];
  created_at: string;
}

// ============= Surveys =============

export interface Survey {
  id: string;
  location_id: string;
  title: string;
  questions: SurveyQuestion[];
  is_active: boolean;
  send_after_hours: number; // Horas después de la visita
  redirect_to_google: boolean;
  redirect_to_tripadvisor: boolean;
  created_at: string;
  updated_at: string;
}

export interface SurveyQuestion {
  id: string;
  text: string;
  type: 'rating' | 'text' | 'multiple_choice';
  options?: string[];
  required: boolean;
}

export interface SurveyResponse {
  id: string;
  survey_id: string;
  reservation_id: string;
  customer_profile_id: string | null;
  answers: Record<string, any>;
  overall_rating: number | null;
  submitted_at: string;
}

// ============= Integration Adapters =============

export interface GoogleReservationSource {
  id: string;
  location_id: string;
  merchant_id: string;
  is_active: boolean;
  last_sync_at: string | null;
  sync_status: 'active' | 'error' | 'disabled';
  created_at: string;
}

export interface PosIntegration {
  id: string;
  location_id: string;
  pos_provider: 'internal' | 'external';
  sync_table_status: boolean;
  sync_prepayments: boolean;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
}

// ============= API Inputs =============

export interface CreateReservationInput {
  guest_name: string;
  guest_phone?: string;
  guest_email?: string;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  duration_minutes?: number;
  notes?: string;
  special_requests?: string;
  pos_table_id?: string;
  zone_id?: string;
  service_id?: string;
  customer_profile_id?: string;
  source?: ReservationSource;
  promo_code?: string;
}

export interface UpdateReservationInput {
  guest_name?: string;
  guest_phone?: string;
  guest_email?: string;
  party_size?: number;
  reservation_date?: string;
  reservation_time?: string;
  duration_minutes?: number;
  notes?: string;
  special_requests?: string;
  pos_table_id?: string;
  zone_id?: string;
  status?: ReservationStatus;
}

export interface AddToWaitlistInput {
  guest_name: string;
  guest_phone?: string;
  guest_email?: string;
  party_size: number;
  quoted_wait_minutes?: number;
  notes?: string;
}

export interface CreateCustomerInput {
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  tags?: string[];
}
