/**
 * KDS Monitors Service
 * CRUD y gestión de monitores configurables
 */

import { supabase } from '@/integrations/supabase/client';
import type { KDSMonitor } from './types';

export class KDSMonitorsService {
  async getActiveMonitors(locationId: string): Promise<KDSMonitor[]> {
    const { data, error } = await supabase
      .from('kds_monitors')
      .select('*')
      .eq('location_id', locationId)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return (data || []) as KDSMonitor[];
  }

  async getMonitorById(monitorId: string): Promise<KDSMonitor | null> {
    const { data, error } = await supabase
      .from('kds_monitors')
      .select('*')
      .eq('id', monitorId)
      .single();

    if (error) return null;
    return data as KDSMonitor;
  }

  async createMonitor(monitor: Partial<KDSMonitor>): Promise<KDSMonitor> {
    const { data, error } = await supabase
      .from('kds_monitors')
      .insert(monitor)
      .select()
      .single();

    if (error) throw error;
    return data as KDSMonitor;
  }

  async updateMonitor(monitorId: string, updates: Partial<KDSMonitor>): Promise<void> {
    const { error } = await supabase
      .from('kds_monitors')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', monitorId);

    if (error) throw error;
  }

  async deleteMonitor(monitorId: string): Promise<void> {
    const { error } = await supabase
      .from('kds_monitors')
      .delete()
      .eq('id', monitorId);

    if (error) throw error;
  }
}
