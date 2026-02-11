/**
 * usePOSConnection - Detects if there's an active POS integration that has
 * been successfully synced at least once.
 * Returns { posConnected, provider, loading }
 * Used globally to decide whether to show real POS data or simulated demo data.
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface POSConnectionState {
  posConnected: boolean;
  provider: string | null;
  loading: boolean;
}

export function usePOSConnection(): POSConnectionState {
  const { session } = useAuth();
  const [state, setState] = useState<POSConnectionState>({
    posConnected: false,
    provider: null,
    loading: true,
  });

  useEffect(() => {
    // Don't query or subscribe until session is available
    if (!session) {
      setState({ posConnected: false, provider: null, loading: false });
      return;
    }

    let cancelled = false;

    async function check() {
      try {
        // Find all integration accounts and their integration status
        const { data: accounts } = await supabase
          .from('integration_accounts')
          .select('id, is_active, integration:integrations(provider, status)');

        if (cancelled) return;

        // Find an account whose integration is active
        const activeAccount = accounts?.find(
          (a: any) => a.is_active && a.integration?.status === 'active'
        );

        if (!activeAccount) {
          setState({ posConnected: false, provider: null, loading: false });
          return;
        }

        // Verify there's at least one successful sync run for this account
        const { data: syncRuns } = await supabase
          .from('integration_sync_runs')
          .select('id')
          .eq('integration_account_id', activeAccount.id)
          .eq('status', 'ok')
          .limit(1);

        if (cancelled) return;

        const hasSynced = syncRuns && syncRuns.length > 0;

        setState({
          posConnected: hasSynced,
          provider: hasSynced ? (activeAccount as any).integration?.provider : null,
          loading: false,
        });
      } catch {
        if (!cancelled) {
          setState({ posConnected: false, provider: null, loading: false });
        }
      }
    }

    check();

    // Listen for changes on integrations, accounts, and sync runs
    const channel = supabase
      .channel('pos-connection')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'integrations' }, () => {
        check();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'integration_accounts' }, () => {
        check();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'integration_sync_runs' }, () => {
        check();
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [session]);

  return state;
}
