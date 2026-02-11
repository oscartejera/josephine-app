/**
 * usePOSConnection - Detects if there's an active POS integration that has
 * been successfully synced at least once.
 * Returns { posConnected, provider, loading }
 * Used globally to decide whether to show real POS data or simulated demo data.
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface POSConnectionState {
  posConnected: boolean;
  provider: string | null;
  loading: boolean;
}

export function usePOSConnection(): POSConnectionState {
  const [state, setState] = useState<POSConnectionState>({
    posConnected: false,
    provider: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        // Find active integrations that have been synced at least once.
        // We check metadata->last_synced_at instead of querying integration_sync_runs
        // because integration_sync_runs has RLS enabled without a SELECT policy,
        // making it inaccessible from the frontend.
        const { data: integrations } = await supabase
          .from('integrations')
          .select('id, provider, status, metadata')
          .eq('status', 'active');

        if (cancelled) return;

        // Find an integration that has been synced at least once
        const syncedIntegration = integrations?.find(
          (i: any) => i.metadata?.last_synced_at
        );

        if (!syncedIntegration) {
          setState({ posConnected: false, provider: null, loading: false });
          return;
        }

        setState({
          posConnected: true,
          provider: syncedIntegration.provider,
          loading: false,
        });
      } catch {
        if (!cancelled) {
          setState({ posConnected: false, provider: null, loading: false });
        }
      }
    }

    check();

    // Listen for changes on integrations
    const channel = supabase
      .channel('pos-connection')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'integrations' }, () => {
        check();
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return state;
}
