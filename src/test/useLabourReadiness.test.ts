/**
 * useLabourReadiness.test.ts — Unit tests for labour readiness hook.
 *
 * Mocks supabase.rpc() and AppContext to simulate get_labour_kpis responses.
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
// Mock useApp — default to 'pos' data source (tests override via variable)
// ---------------------------------------------------------------------------

let mockDataSource: 'pos' | 'simulated' = 'pos';

vi.mock('@/contexts/AppContext', () => ({
  useApp: () => ({
    dataSource: mockDataSource,
    loading: false,
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

const DEFAULT_ARGS = {
  selectedLocationId: 'loc-1' as string | 'all' | null,
  dateRange: { from: '2026-02-01', to: '2026-02-28' },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useLabourReadiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDataSource = 'pos'; // reset to pos
  });

  it('returns status=demo with reason=simulated when dataSource is simulated', async () => {
    mockDataSource = 'simulated';

    const { useLabourReadiness } = await import('@/hooks/useLabourReadiness');

    const { result } = renderHook(
      () => useLabourReadiness(DEFAULT_ARGS),
      { wrapper: createWrapper() },
    );

    expect(result.current.status).toBe('demo');
    expect(result.current.reason).toBe('simulated');
    expect(result.current.dataSource).toBe('simulated');
    // Should NOT call RPC when simulated — short-circuits
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns status=live when dataSource=pos and kpis has signal', async () => {
    mockRpc.mockResolvedValue({
      data: {
        actual_sales: 1500,
        forecast_sales: 1800,
        actual_labor_cost: 320,
        planned_labor_cost: 350,
        actual_labor_hours: 40,
        planned_labor_hours: 45,
      },
      error: null,
    });

    const { useLabourReadiness } = await import('@/hooks/useLabourReadiness');

    const { result } = renderHook(
      () => useLabourReadiness(DEFAULT_ARGS),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.status).toBe('live');
    });

    expect(result.current.dataSource).toBe('pos');
    expect(result.current.reason).toBeUndefined();
  });

  it('returns status=demo with reason=pos_no_rows when kpis has no signal', async () => {
    mockRpc.mockResolvedValue({
      data: {
        actual_sales: null,
        forecast_sales: null,
        actual_labor_cost: null,
        planned_labor_cost: null,
        actual_labor_hours: null,
        planned_labor_hours: null,
      },
      error: null,
    });

    const { useLabourReadiness } = await import('@/hooks/useLabourReadiness');

    const { result } = renderHook(
      () => useLabourReadiness(DEFAULT_ARGS),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.reason).toBe('pos_no_rows');
    });

    expect(result.current.status).toBe('demo');
    expect(result.current.dataSource).toBe('pos');
  });

  it('returns status=error when RPC throws', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'function get_labour_kpis does not exist' },
    });

    const { useLabourReadiness } = await import('@/hooks/useLabourReadiness');

    const { result } = renderHook(
      () => useLabourReadiness(DEFAULT_ARGS),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });

    expect(result.current.reason).toBe('rpc_error');
    expect(result.current.errorMessage).toBe('function get_labour_kpis does not exist');
  });

  it('includes dataSource in queryKey (verified via RPC call params)', async () => {
    mockRpc.mockResolvedValue({
      data: { actual_sales: 100, actual_labor_cost: 50, actual_labor_hours: 10 },
      error: null,
    });

    const { useLabourReadiness } = await import('@/hooks/useLabourReadiness');

    renderHook(
      () => useLabourReadiness(DEFAULT_ARGS),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledTimes(1);
    });

    expect(mockRpc).toHaveBeenCalledWith('get_labour_kpis', {
      date_from: '2026-02-01',
      date_to: '2026-02-28',
      selected_location_id: 'loc-1',
      p_data_source: 'pos',
    });
  });

  it('exposes refetch function', async () => {
    mockRpc.mockResolvedValue({
      data: { actual_sales: 100, actual_labor_cost: 50, actual_labor_hours: 10 },
      error: null,
    });

    const { useLabourReadiness } = await import('@/hooks/useLabourReadiness');

    const { result } = renderHook(
      () => useLabourReadiness(DEFAULT_ARGS),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.status).toBe('live');
    });

    expect(typeof result.current.refetch).toBe('function');
    // Should not throw when called
    result.current.refetch();
  });

  it('passes null for selected_location_id when "all"', async () => {
    mockRpc.mockResolvedValue({
      data: { actual_sales: 100, actual_labor_cost: 50, actual_labor_hours: 10 },
      error: null,
    });

    const { useLabourReadiness } = await import('@/hooks/useLabourReadiness');

    renderHook(
      () => useLabourReadiness({
        selectedLocationId: 'all',
        dateRange: { from: '2026-02-01', to: '2026-02-28' },
      }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledTimes(1);
    });

    expect(mockRpc).toHaveBeenCalledWith('get_labour_kpis', expect.objectContaining({
      selected_location_id: null,
    }));
  });

  it('returns live when kpis has zero values (not null)', async () => {
    // Zero is valid data — could be a real day with no sales/hours
    mockRpc.mockResolvedValue({
      data: {
        actual_sales: 0,
        forecast_sales: 0,
        actual_labor_cost: 0,
        planned_labor_cost: 0,
        actual_labor_hours: 0,
        planned_labor_hours: 0,
      },
      error: null,
    });

    const { useLabourReadiness } = await import('@/hooks/useLabourReadiness');

    const { result } = renderHook(
      () => useLabourReadiness(DEFAULT_ARGS),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.status).toBe('live');
    });

    // Zero is NOT null — it means data exists, just happens to be zero
    expect(result.current.reason).toBeUndefined();
  });
});
