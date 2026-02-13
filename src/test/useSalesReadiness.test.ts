/**
 * useSalesReadiness.test.ts — Unit tests for sales readiness hook.
 *
 * Mocks supabase.rpc() to simulate get_sales_timeseries_unified responses.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Mock supabase client
// ---------------------------------------------------------------------------

const mockRpc = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mockRpc,
  },
}));

// ---------------------------------------------------------------------------
// Mock useApp (provides group.id for orgId)
// ---------------------------------------------------------------------------

vi.mock('@/contexts/AppContext', () => ({
  useApp: () => ({
    group: { id: 'org-uuid-1' },
    locations: [],
    selectedLocationId: 'loc-1',
    accessibleLocations: [],
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useSalesReadiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns status=demo when locationIds is empty (no RPC call)', async () => {
    const { useSalesReadiness } = await import('@/hooks/useSalesReadiness');

    const { result } = renderHook(
      () => useSalesReadiness({ locationIds: [], enabled: true }),
      { wrapper: createWrapper() },
    );

    expect(result.current.status).toBe('demo');
    expect(result.current.isLive).toBe(false);
    expect(result.current.reason).toBe('no_locations');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns status=demo when enabled=false (no RPC call)', async () => {
    const { useSalesReadiness } = await import('@/hooks/useSalesReadiness');

    const { result } = renderHook(
      () => useSalesReadiness({ locationIds: ['loc-1'], enabled: false }),
      { wrapper: createWrapper() },
    );

    expect(result.current.status).toBe('demo');
    expect(result.current.isLive).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns status=live when data_source=pos and timeseries has rows', async () => {
    mockRpc.mockResolvedValue({
      data: {
        data_source: 'pos',
        mode: 'auto',
        reason: 'pos_active',
        last_synced_at: '2026-02-13T10:00:00Z',
        hourly: [{ ts_hour: '2026-02-13T10:00:00', actual_sales: 100 }],
        daily: [{ date: '2026-02-13', actual_sales: 500 }],
        kpis: { actual_sales: 500 },
        busy_hours: [],
      },
      error: null,
    });

    const { useSalesReadiness } = await import('@/hooks/useSalesReadiness');

    const { result } = renderHook(
      () => useSalesReadiness({ locationIds: ['loc-1'] }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLive).toBe(true);
    });

    expect(result.current.status).toBe('live');
    expect(result.current.dataSource).toBe('pos');
    expect(result.current.hasRows).toBe(true);
    expect(result.current.lastSyncedAt).toBeInstanceOf(Date);
    expect(result.current.lastSyncedAt!.toISOString()).toBe('2026-02-13T10:00:00.000Z');
  });

  it('returns status=demo when data_source=demo (even with rows)', async () => {
    mockRpc.mockResolvedValue({
      data: {
        data_source: 'demo',
        mode: 'auto',
        reason: 'auto_no_integration',
        last_synced_at: null,
        hourly: [{ ts_hour: '2026-02-13T10:00:00', actual_sales: 200 }],
        daily: [{ date: '2026-02-13', actual_sales: 200 }],
        kpis: { actual_sales: 200 },
        busy_hours: [],
      },
      error: null,
    });

    const { useSalesReadiness } = await import('@/hooks/useSalesReadiness');

    const { result } = renderHook(
      () => useSalesReadiness({ locationIds: ['loc-1'] }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.dataSource).toBe('demo');
    });

    expect(result.current.status).toBe('demo');
    expect(result.current.isLive).toBe(false);
    expect(result.current.reason).toBe('auto_no_integration');
    expect(result.current.hasRows).toBe(true);
  });

  it('returns status=demo with reason=pos_no_rows when data_source=pos but no timeseries', async () => {
    mockRpc.mockResolvedValue({
      data: {
        data_source: 'pos',
        mode: 'auto',
        reason: 'pos_active',
        last_synced_at: '2026-02-13T08:00:00Z',
        hourly: [],
        daily: [],
        kpis: { actual_sales: 0 },
        busy_hours: [],
      },
      error: null,
    });

    const { useSalesReadiness } = await import('@/hooks/useSalesReadiness');

    const { result } = renderHook(
      () => useSalesReadiness({ locationIds: ['loc-1'] }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.dataSource).toBe('pos');
    });

    expect(result.current.status).toBe('demo');
    expect(result.current.isLive).toBe(false);
    expect(result.current.reason).toBe('pos_no_rows');
    expect(result.current.hasRows).toBe(false);
  });

  it('returns status=error when RPC throws', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'function does not exist' },
    });

    const { useSalesReadiness } = await import('@/hooks/useSalesReadiness');

    const { result } = renderHook(
      () => useSalesReadiness({ locationIds: ['loc-1'] }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });

    expect(result.current.isLive).toBe(false);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error!.message).toBe('function does not exist');
  });

  it('parses last_synced_at correctly as Date', async () => {
    const isoString = '2026-02-12T14:30:00.000Z';
    mockRpc.mockResolvedValue({
      data: {
        data_source: 'pos',
        mode: 'manual',
        reason: 'manual_override',
        last_synced_at: isoString,
        hourly: [{ ts_hour: '2026-02-12T14:00:00' }],
        daily: [],
        kpis: {},
        busy_hours: [],
      },
      error: null,
    });

    const { useSalesReadiness } = await import('@/hooks/useSalesReadiness');

    const { result } = renderHook(
      () => useSalesReadiness({ locationIds: ['loc-1'] }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLive).toBe(true);
    });

    expect(result.current.lastSyncedAt).toBeInstanceOf(Date);
    expect(result.current.lastSyncedAt!.toISOString()).toBe(isoString);
    expect(result.current.mode).toBe('manual');
  });

  it('returns null for lastSyncedAt when RPC returns null', async () => {
    mockRpc.mockResolvedValue({
      data: {
        data_source: 'demo',
        mode: 'auto',
        reason: 'no_integration',
        last_synced_at: null,
        hourly: [],
        daily: [],
        kpis: {},
        busy_hours: [],
      },
      error: null,
    });

    const { useSalesReadiness } = await import('@/hooks/useSalesReadiness');

    const { result } = renderHook(
      () => useSalesReadiness({ locationIds: ['loc-1'] }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.dataSource).toBe('demo');
    });

    expect(result.current.lastSyncedAt).toBeNull();
  });
});
