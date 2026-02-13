/**
 * useInventoryReadiness.test.ts — Unit tests for inventory readiness hook.
 *
 * Mocks supabase.from() to simulate v_stock_on_hand_by_location responses.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Mock supabase client
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockLimit = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
    })),
  },
}));

// Chain: supabase.from().select().eq().limit()
mockSelect.mockReturnValue({ eq: mockEq });
mockEq.mockReturnValue({ limit: mockLimit });

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

describe('useInventoryReadiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-establish the chain after clearAllMocks
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ limit: mockLimit });
  });

  it('returns isLive=false and reason="no_location_selected" when locationId is null', async () => {
    const { useInventoryReadiness } = await import('@/hooks/useInventoryReadiness');

    const { result } = renderHook(() => useInventoryReadiness(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLive).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.reason).toBe('no_location_selected');
  });

  it('returns isLive=false and reason="no_location_selected" when locationId is "all"', async () => {
    const { useInventoryReadiness } = await import('@/hooks/useInventoryReadiness');

    const { result } = renderHook(() => useInventoryReadiness('all'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLive).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.reason).toBe('no_location_selected');
  });

  it('returns isLive=true when v_stock_on_hand_by_location has rows', async () => {
    mockLimit.mockResolvedValue({
      data: [{ item_id: 'abc-123' }],
      error: null,
    });

    const { useInventoryReadiness } = await import('@/hooks/useInventoryReadiness');

    const { result } = renderHook(
      () => useInventoryReadiness('location-uuid-1'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isLive).toBe(true);
    expect(result.current.reason).toBe('inventory_live');
  });

  it('returns isLive=false when v_stock_on_hand_by_location has 0 rows', async () => {
    mockLimit.mockResolvedValue({
      data: [],
      error: null,
    });

    const { useInventoryReadiness } = await import('@/hooks/useInventoryReadiness');

    const { result } = renderHook(
      () => useInventoryReadiness('location-uuid-2'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isLive).toBe(false);
    expect(result.current.reason).toBe('no_inventory_movements');
  });

  it('returns isLive=false when supabase returns an error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockLimit.mockResolvedValue({
      data: null,
      error: { message: 'relation does not exist' },
    });

    const { useInventoryReadiness } = await import('@/hooks/useInventoryReadiness');

    const { result } = renderHook(
      () => useInventoryReadiness('location-uuid-3'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isLive).toBe(false);
    expect(result.current.reason).toBe('no_inventory_movements');

    consoleSpy.mockRestore();
  });
});
