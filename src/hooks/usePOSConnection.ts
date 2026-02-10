/**
 * usePOSConnection - Detects if there's an active POS integration connected.
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
        // Look for any integration with an active account
        const { data: accounts } = await supabase
          .from('integration_accounts')
          .select('id, integration:integrations(provider, status)')
          .limit(1);

        if (cancelled) return;

        const active = accounts?.find(
          (a: any) => a.integration?.status === 'active'
        );

        setState({
          posConnected: !!active,
          provider: active ? (active as any).integration?.provider : null,
          loading: false,
        });
      } catch {
        if (!cancelled) {
          setState({ posConnected: false, provider: null, loading: false });
        }
      }
    }

    check();

    // Listen for changes on integrations table
    const channel = supabase
      .channel('pos-connection')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'integrations' }, () => {
        check();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'integration_accounts' }, () => {
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
