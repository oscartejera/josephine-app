/**
 * KDS State Machine Service
 * Gestiona transiciones de estados y validaciones
 */

import { supabase } from '@/integrations/supabase/client';
import type { KDSMonitor } from './types';

export class KDSStateMachineService {
  /**
   * Start preparing (pending → preparing)
   */
  async startLine(lineId: string, monitorId?: string): Promise<void> {
    const { error } = await supabase
      .from('ticket_lines')
      .update({
        prep_status: 'preparing',
        prep_started_at: new Date().toISOString(),
      })
      .eq('id', lineId);

    if (error) throw error;

    // Event is logged by trigger
  }

  /**
   * Finish preparing (preparing → ready, or ready → served if auto_serve)
   */
  async finishLine(
    lineId: string,
    monitor: KDSMonitor,
    monitorId?: string
  ): Promise<void> {
    const updates: any = {
      prep_status: 'ready',
      ready_at: new Date().toISOString(),
    };

    // Auto-serve if configured
    if (monitor.auto_serve_on_finish) {
      updates.prep_status = 'served';
    }

    const { error } = await supabase
      .from('ticket_lines')
      .update(updates)
      .eq('id', lineId);

    if (error) throw error;
  }

  /**
   * Serve (ready → served)
   */
  async serveLine(lineId: string, monitorId?: string): Promise<void> {
    const { error } = await supabase
      .from('ticket_lines')
      .update({
        prep_status: 'served',
      })
      .eq('id', lineId);

    if (error) throw error;
  }

  /**
   * Batch operations
   */
  async startAllLines(lineIds: string[]): Promise<void> {
    const { error } = await supabase
      .from('ticket_lines')
      .update({
        prep_status: 'preparing',
        prep_started_at: new Date().toISOString(),
      })
      .in('id', lineIds);

    if (error) throw error;
  }

  async finishAllLines(lineIds: string[], monitor: KDSMonitor): Promise<void> {
    const updates: any = {
      prep_status: 'ready',
      ready_at: new Date().toISOString(),
    };

    if (monitor.auto_serve_on_finish) {
      updates.prep_status = 'served';
    }

    const { error } = await supabase
      .from('ticket_lines')
      .update(updates)
      .in('id', lineIds);

    if (error) throw error;
  }

  async serveAllLines(lineIds: string[]): Promise<void> {
    const { error } = await supabase
      .from('ticket_lines')
      .update({
        prep_status: 'served',
      })
      .in('id', lineIds);

    if (error) throw error;
  }
}
