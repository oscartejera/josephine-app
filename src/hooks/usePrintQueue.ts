import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PrintJob {
  id: string;
  location_id: string;
  ticket_id: string;
  destination: 'kitchen' | 'bar' | 'prep' | 'receipt';
  items_json: { name: string; qty: number; notes?: string }[];
  status: 'pending' | 'printed' | 'acknowledged' | 'failed';
  created_at: string;
  printed_at: string | null;
  acknowledged_at: string | null;
  // Joined data
  table_name?: string;
}

export function usePrintQueue(locationId: string) {
  const { session } = useAuth();
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  const fetchJobs = useCallback(async () => {
    if (!locationId) return;

    try {
      const { data, error } = await supabase
        .from('pos_print_queue')
        .select(`
          *,
          tickets:ticket_id (table_name)
        `)
        .eq('location_id', locationId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching print queue:', error);
        return;
      }

      const mapped: PrintJob[] = (data || []).map((job: any) => ({
        id: job.id,
        location_id: job.location_id,
        ticket_id: job.ticket_id,
        destination: job.destination,
        items_json: job.items_json || [],
        status: job.status,
        created_at: job.created_at,
        printed_at: job.printed_at,
        acknowledged_at: job.acknowledged_at,
        table_name: job.tickets?.table_name,
      }));

      setJobs(mapped);
    } catch (error) {
      console.error('Error in fetchJobs:', error);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  const markAsPrinted = useCallback(async (jobId: string) => {
    const { error } = await supabase
      .from('pos_print_queue')
      .update({ 
        status: 'printed', 
        printed_at: new Date().toISOString() 
      })
      .eq('id', jobId);

    if (error) {
      console.error('Error marking as printed:', error);
      return false;
    }
    
    fetchJobs();
    return true;
  }, [fetchJobs]);

  const markAsAcknowledged = useCallback(async (jobId: string) => {
    const { error } = await supabase
      .from('pos_print_queue')
      .update({ 
        status: 'acknowledged', 
        acknowledged_at: new Date().toISOString() 
      })
      .eq('id', jobId);

    if (error) {
      console.error('Error marking as acknowledged:', error);
      return false;
    }
    
    fetchJobs();
    return true;
  }, [fetchJobs]);

  const markAsFailed = useCallback(async (jobId: string) => {
    const { error } = await supabase
      .from('pos_print_queue')
      .update({ status: 'failed' })
      .eq('id', jobId);

    if (error) {
      console.error('Error marking as failed:', error);
      return false;
    }
    
    fetchJobs();
    return true;
  }, [fetchJobs]);

  const retryJob = useCallback(async (jobId: string) => {
    const { error } = await supabase
      .from('pos_print_queue')
      .update({ 
        status: 'pending',
        printed_at: null,
        acknowledged_at: null
      })
      .eq('id', jobId);

    if (error) {
      console.error('Error retrying job:', error);
      return false;
    }
    
    fetchJobs();
    return true;
  }, [fetchJobs]);

  const deleteJob = useCallback(async (jobId: string) => {
    const { error } = await supabase
      .from('pos_print_queue')
      .delete()
      .eq('id', jobId);

    if (error) {
      console.error('Error deleting job:', error);
      return false;
    }
    
    fetchJobs();
    return true;
  }, [fetchJobs]);

  // Initial fetch
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Realtime subscription
  useEffect(() => {
    if (!locationId || !session) return;

    const channel = supabase
      .channel(`print-queue-${locationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pos_print_queue',
          filter: `location_id=eq.${locationId}`
        },
        () => {
          fetchJobs();
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [locationId, fetchJobs, session]);

  const pendingCount = jobs.filter(j => j.status === 'pending').length;

  return {
    jobs,
    loading,
    isConnected,
    pendingCount,
    markAsPrinted,
    markAsAcknowledged,
    markAsFailed,
    retryJob,
    deleteJob,
    refetch: fetchJobs,
  };
}
