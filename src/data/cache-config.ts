/**
 * Centralized query cache configuration.
 *
 * Different data types deserve different freshness guarantees.
 * Import the appropriate preset for each hook's useQuery call.
 *
 * Usage:
 *   import { CACHE } from '@/data/cache-config';
 *   useQuery({ queryKey: [...], queryFn: ..., ...CACHE.ANALYTICS })
 */

/** KPI cards, dashboard metrics — changes with every transaction */
const REALTIME = {
    staleTime: 2 * 60 * 1000,    // 2 min
    gcTime: 10 * 60 * 1000,      // 10 min
} as const;

/** Sales timeseries, labour trends — historical, moderate freshness */
const ANALYTICS = {
    staleTime: 5 * 60 * 1000,    // 5 min
    gcTime: 15 * 60 * 1000,      // 15 min
} as const;

/** Menu engineering, forecasts — computationally expensive, changes slowly */
const COMPUTED = {
    staleTime: 10 * 60 * 1000,   // 10 min
    gcTime: 20 * 60 * 1000,      // 20 min
} as const;

/** Recipes, inventory items, budget config — rarely changes mid-session */
const CONFIG = {
    staleTime: 30 * 60 * 1000,   // 30 min
    gcTime: 60 * 60 * 1000,      // 60 min
} as const;

/** Locations, org settings, team roster — almost never changes */
const STATIC = {
    staleTime: 60 * 60 * 1000,   // 60 min
    gcTime: 120 * 60 * 1000,     // 2 hours
} as const;

export const CACHE = {
    REALTIME,
    ANALYTICS,
    COMPUTED,
    CONFIG,
    STATIC,
} as const;
