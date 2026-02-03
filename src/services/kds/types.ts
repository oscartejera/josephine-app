/**
 * KDS Ágora Types
 * Tipos específicos para el sistema KDS completo
 */

export interface KDSMonitor {
  id: string;
  location_id: string;
  name: string;
  type: 'fast_food' | 'restaurant' | 'expeditor' | 'customer_display';
  destinations: string[]; // ['kitchen', 'bar', 'prep']
  courses: number[] | null; // null = all courses
  primary_statuses: string[]; // ['pending', 'preparing']
  secondary_statuses: string[]; // ['ready', 'served']
  view_mode: 'rows_interactive' | 'classic' | 'mixed';
  rows_count: number;
  newest_side: 'right' | 'left';
  auto_serve_on_finish: boolean;
  history_window_minutes: number;
  show_start_btn: boolean;
  show_finish_btn: boolean;
  show_serve_btn: boolean;
  printer_id: string | null;
  print_on_line_complete: boolean;
  print_on_order_complete: boolean;
  show_print_button: boolean;
  styles_rules: StyleRule[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StyleRule {
  trigger: 'idle_minutes' | 'is_rush' | 'is_marched' | 'overdue' | 'prewarn';
  value?: number; // Para idle_minutes, overdue, prewarn
  target: 'ticket' | 'order' | 'line' | 'header' | 'border' | 'accent';
  actions: StyleAction[];
}

export interface StyleAction {
  type: 'background' | 'border' | 'accent' | 'blink' | 'underline' | 'strike';
  color?: string;
  intensity?: 'low' | 'medium' | 'high';
}

export interface TicketOrderFlag {
  id: string;
  ticket_id: string;
  course: number;
  is_marched: boolean;
  marched_at: string | null;
  marched_by: string | null;
  created_at: string;
}

export interface KDSEvent {
  id: string;
  location_id: string;
  ticket_id: string;
  ticket_line_id: string | null;
  event_type: 'sent' | 'start' | 'finish' | 'serve' | 'march' | 'unmarch' | 'add_items' | 'print' | 'recall';
  user_id: string | null;
  monitor_id: string | null;
  payload: Record<string, any>;
  created_at: string;
}

export interface KDSTicketLine {
  id: string;
  ticket_id: string;
  product_id: string | null;
  item_name: string;
  quantity: number;
  unit_price: number;
  notes: string | null;
  prep_status: 'pending' | 'preparing' | 'ready' | 'served';
  prep_started_at: string | null;
  ready_at: string | null;
  sent_at: string | null;
  destination: 'kitchen' | 'bar' | 'prep';
  target_prep_time: number | null;
  is_rush: boolean;
  course: number;
  modifiers: KDSModifier[];
}

export interface KDSModifier {
  id: string;
  modifier_name: string;
  option_name: string;
  price_delta: number;
  type: 'add' | 'remove' | 'substitute';
}

export interface KDSOrder {
  ticket_id: string;
  table_name: string | null;
  table_number: string | null;
  server_name: string | null;
  opened_at: string;
  covers: number;
  orders: KDSCourseOrder[]; // Grouped by course
}

export interface KDSCourseOrder {
  course: number;
  is_marched: boolean;
  marched_at: string | null;
  items: KDSTicketLine[];
  all_items_ready: boolean;
}

export interface ProductAggregation {
  product_name: string;
  total_quantity: number;
  pending_quantity: number;
  preparing_quantity: number;
  ready_quantity: number;
}
