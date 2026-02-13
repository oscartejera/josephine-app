import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { DataSourceProvider } from '@/contexts/DataSourceContext';
import { useEffectiveDataSource } from '@/hooks/useEffectiveDataSource';

// ---------------------------------------------------------------------------
// Mock useDataSource — the raw RPC hook.
// We swap its return value per test to simulate different integration states.
// ---------------------------------------------------------------------------

const mockRefetch = vi.fn();

const mockUseDataSource = vi.fn(() => ({
  dataSource: 'demo' as const,
  mode: 'auto' as const,
  reason: 'auto_demo_no_sync',
  lastSyncedAt: null,
  loading: false,
  blocked: false,
  refetch: mockRefetch,
}));

vi.mock('@/hooks/useDataSource', () => ({
  useDataSource: () => mockUseDataSource(),
}));

// Also mock useAuth so useDataSource's internal import doesn't break
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    session: null,
    profile: null,
    user: null,
    loading: false,
    roles: [],
    isOwner: false,
    hasGlobalScope: false,
    accessibleLocationIds: [],
    refreshProfile: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Helper: wrapper with the provider
// ---------------------------------------------------------------------------

function Wrapper({ children }: { children: React.ReactNode }) {
  return <DataSourceProvider>{children}</DataSourceProvider>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useEffectiveDataSource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when used outside DataSourceProvider', () => {
    // Suppress console.error from React during expected throw
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useEffectiveDataSource());
    }).toThrow('useEffectiveDataSource must be used within a <DataSourceProvider>');

    spy.mockRestore();
  });

  it('returns dsUnified="demo" when integration has no active sync', () => {
    mockUseDataSource.mockReturnValue({
      dataSource: 'demo',
      mode: 'auto',
      reason: 'auto_demo_no_sync',
      lastSyncedAt: null,
      loading: false,
      blocked: false,
      refetch: mockRefetch,
    });

    const { result } = renderHook(() => useEffectiveDataSource(), {
      wrapper: Wrapper,
    });

    expect(result.current.dsUnified).toBe('demo');
    expect(result.current.reason).toBe('auto_demo_no_sync');
    expect(result.current.lastSyncedAt).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('returns dsUnified="pos" when integration is active with recent sync', () => {
    const recentSync = new Date();
    recentSync.setHours(recentSync.getHours() - 2); // 2 hours ago

    mockUseDataSource.mockReturnValue({
      dataSource: 'pos',
      mode: 'auto',
      reason: 'auto_pos_recent',
      lastSyncedAt: recentSync,
      loading: false,
      blocked: false,
      refetch: mockRefetch,
    });

    const { result } = renderHook(() => useEffectiveDataSource(), {
      wrapper: Wrapper,
    });

    expect(result.current.dsUnified).toBe('pos');
    expect(result.current.reason).toBe('auto_pos_recent');
    expect(result.current.lastSyncedAt).toEqual(recentSync);
  });

  it('returns dsUnified="demo" when integration is active but sync is stale/null', () => {
    const staleSync = new Date();
    staleSync.setDate(staleSync.getDate() - 3); // 3 days ago

    mockUseDataSource.mockReturnValue({
      dataSource: 'demo',
      mode: 'auto',
      reason: 'auto_demo_no_sync',
      lastSyncedAt: staleSync,
      loading: false,
      blocked: false,
      refetch: mockRefetch,
    });

    const { result } = renderHook(() => useEffectiveDataSource(), {
      wrapper: Wrapper,
    });

    expect(result.current.dsUnified).toBe('demo');
    expect(result.current.reason).toBe('auto_demo_no_sync');
  });

  it('exposes blocked=true when manual POS is requested but sync is stale', () => {
    mockUseDataSource.mockReturnValue({
      dataSource: 'demo',
      mode: 'manual',
      reason: 'manual_pos_blocked_no_sync',
      lastSyncedAt: null,
      loading: false,
      blocked: true,
      refetch: mockRefetch,
    });

    const { result } = renderHook(() => useEffectiveDataSource(), {
      wrapper: Wrapper,
    });

    expect(result.current.dsUnified).toBe('demo');
    expect(result.current.blocked).toBe(true);
    expect(result.current.mode).toBe('manual');
    expect(result.current.reason).toBe('manual_pos_blocked_no_sync');
  });

  it('exposes refetch function from the underlying hook', () => {
    mockUseDataSource.mockReturnValue({
      dataSource: 'demo',
      mode: 'auto',
      reason: 'auto_demo_no_sync',
      lastSyncedAt: null,
      loading: false,
      blocked: false,
      refetch: mockRefetch,
    });

    const { result } = renderHook(() => useEffectiveDataSource(), {
      wrapper: Wrapper,
    });

    result.current.refetch();
    expect(mockRefetch).toHaveBeenCalledOnce();
  });
});
