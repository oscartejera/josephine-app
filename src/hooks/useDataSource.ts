/**
 * useDataSource — Centralized data source resolution.
 *
 * Calls the resolve_data_source RPC to determine whether the app should
 * use 'pos' or 'demo' data.  Falls back to the legacy usePOSConnection
 * heuristic when the RPC is unavailable (e.g. migration not yet applied).
 *
 * Returns:
 *  - dataSource: 'pos' | 'demo'
 *  - mode: 'auto' | 'manual'
 *  - reason: string explaining the decision
 *  - lastSyncedAt: Date | null
 *  - loading: boolean
 *  - blocked: boolean — true when manual=pos but sync is stale
 *  - refetch: () => void
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type DataSourceValue = 'pos' | 'demo';

export interface DataSourceState {
  dataSource: DataSourceValue;
  mode: 'auto' | 'manual';
  reason: string;
  lastSyncedAt: Date | null;
  loading: boolean;
  blocked: boolean;
  refetch: () => void;
}

export function useDataSource(): DataSourceState {
  const { profile, session } = useAuth();
  const [state, setState] = useState<Omit<DataSourceState, 'refetch'>>({
    dataSource: 'demo',
    mode: 'auto',
    reason: 'loading',
    lastSyncedAt: null,
    loading: true,
    blocked: false,
  });

  const resolve = useCallback(async () => {
    if (!session || !profile?.group_id) {
      setState({
        dataSource: 'demo',
        mode: 'auto',
        reason: 'no_session',
        lastSyncedAt: null,
        loading: false,
        blocked: false,
      });
      return;
    }

    try {
      const { data, error } = await supabase.rpc('resolve_data_source', {
        p_org_id: profile.group_id,
      });

      if (error) {
        // RPC not available (migration not applied yet) — fall back to legacy
        console.warn('resolve_data_source RPC unavailable, using legacy fallback:', error.message);
        await legacyFallback(setState);
        return;
      }

      const result = data as {
        data_source: string;
        mode: string;
        reason: string;
        last_synced_at: string | null;
      };

      setState({
        dataSource: (result.data_source === 'pos' ? 'pos' : 'demo') as DataSourceValue,
        mode: result.mode as 'auto' | 'manual',
        reason: result.reason,
        lastSyncedAt: result.last_synced_at ? new Date(result.last_synced_at) : null,
        loading: false,
        blocked: result.reason === 'manual_pos_blocked_no_sync',
      });
    } catch {
      await legacyFallback(setState);
    }
  }, [session, profile?.group_id]);

  useEffect(() => {
    resolve();

    // Subscribe to changes on integrations and org_settings
    const channel = supabase
      .channel('data-source-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'integrations' }, () => {
        resolve();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'org_settings' }, () => {
        resolve();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [resolve]);

  return { ...state, refetch: resolve };
}

/**
 * Legacy fallback: replicate usePOSConnection behaviour when the
 * resolve_data_source RPC is not yet deployed.
 */
async function legacyFallback(
  setState: React.Dispatch<React.SetStateAction<Omit<DataSourceState, 'refetch'>>>,
) {
  try {
    const { data: integrations } = await supabase
      .from('integrations')
      .select('id, provider, status, metadata')
      .eq('status', 'active');

    const synced = integrations?.find(
      (i) => (i.metadata as Record<string, unknown>)?.last_synced_at,
    );

    const syncedMeta = synced?.metadata as Record<string, unknown> | undefined;

    setState({
      dataSource: synced ? 'pos' : 'demo',
      mode: 'auto',
      reason: synced ? 'legacy_pos_connected' : 'legacy_no_pos',
      lastSyncedAt: syncedMeta?.last_synced_at ? new Date(syncedMeta.last_synced_at as string) : null,
      loading: false,
      blocked: false,
    });
  } catch {
    setState({
      dataSource: 'demo',
      mode: 'auto',
      reason: 'legacy_error',
      lastSyncedAt: null,
      loading: false,
      blocked: false,
    });
  }
}
